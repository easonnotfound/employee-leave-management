-- ========================================
-- 员工请假管理系统 - 快速初始化脚本
-- 用于快速部署和演示
-- ========================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS employee_leave_system 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE employee_leave_system;

-- 1. 部门表
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    director_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 员工表
CREATE TABLE employees (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    department_id INT NOT NULL,
    position VARCHAR(50) NOT NULL,
    hire_date DATE NOT NULL,
    work_type ENUM('标准工作制', '弹性工作制') DEFAULT '标准工作制',
    supervisor VARCHAR(50),
    phone VARCHAR(20),
    emergency_contact VARCHAR(50),
    emergency_phone VARCHAR(20),
    status ENUM('active', 'inactive', 'resigned') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 3. 假期配额表
CREATE TABLE leave_quotas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL,
    year YEAR NOT NULL,
    annual_leave_total INT DEFAULT 0,
    annual_leave_used INT DEFAULT 0,
    sick_leave_used INT DEFAULT 0,
    personal_leave_used INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE KEY uk_employee_year (employee_id, year)
);

-- 4. 请假申请表
CREATE TABLE leave_applications (
    id VARCHAR(30) PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL,
    leave_type ENUM('年假', '病假', '事假', '婚假', '产假', '陪产假', '丧假', '调休假') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    advance_notice_days INT,
    application_time TIMESTAMP NOT NULL,
    approved_by JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    CHECK (days > 0),
    CHECK (end_date >= start_date)
);

-- 5. 系统配置表
CREATE TABLE system_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT
);

-- 插入基础数据
INSERT INTO departments (name, director_name) VALUES
('技术部', '李技术总监'),
('销售部', '陈销售总监'),
('产品部', '刘产品总监'),
('市场部', '周市场总监'),
('运营部', '马运营经理'),
('人事部', '林HR经理'),
('财务部', '钱财务经理');

-- 插入员工数据
INSERT INTO employees VALUES
('TEC20220', '张伟', 1, '高级工程师', '2022-03-01', '弹性工作制', '李技术总监', '13800138001', '张太太', '13800138002', 'active', NOW()),
('TEC20230', '王强', 1, '中级工程师', '2023-01-01', '弹性工作制', '李技术总监', '13800138003', '王妈妈', '13800138004', 'active', NOW()),
('SAL20210', '李娜', 2, '销售经理', '2021-06-01', '标准工作制', '陈销售总监', '13800138005', '李先生', '13800138006', 'active', NOW()),
('PRD20220', '赵敏', 3, '产品经理', '2022-09-01', '弹性工作制', '刘产品总监', '13800138007', '赵先生', '13800138008', 'active', NOW()),
('MKT20230', '孙丽', 4, '市场专员', '2023-08-01', '标准工作制', '周市场总监', '13800138009', '孙爸爸', '13800138010', 'active', NOW()),
('OPS20200', '吴军', 5, '客服主管', '2020-05-01', '标准工作制', '马运营经理', '13800138011', '吴太太', '13800138012', 'active', NOW()),
('HR202100', '郑红', 6, 'HR专员', '2021-02-01', '标准工作制', '林HR经理', '13800138013', '郑妈妈', '13800138014', 'active', NOW()),
('FIN20200', '钱进', 7, '会计', '2020-09-01', '标准工作制', '钱财务经理', '13800138015', '钱太太', '13800138016', 'active', NOW());

-- 插入假期配额
INSERT INTO leave_quotas (employee_id, year, annual_leave_total, annual_leave_used, sick_leave_used, personal_leave_used) VALUES
('TEC20220', 2024, 10, 2, 2, 1),
('TEC20230', 2024, 5, 0, 0, 0),
('SAL20210', 2024, 15, 3, 3, 2),
('PRD20220', 2024, 10, 0, 1, 1),
('MKT20230', 2024, 5, 2, 0, 1),
('OPS20200', 2024, 15, 0, 4, 2),
('HR202100', 2024, 15, 5, 2, 1),
('FIN20200', 2024, 15, 3, 5, 3);

-- 创建视图
CREATE VIEW v_employee_details AS
SELECT 
    e.*,
    d.name as department_name,
    COALESCE(lq.annual_leave_total, 0) as annual_leave_total,
    COALESCE(lq.annual_leave_used, 0) as annual_leave_used,
    COALESCE(lq.annual_leave_total - lq.annual_leave_used, 0) as remaining_annual_leave,
    COALESCE(lq.sick_leave_used, 0) as sick_leave_used,
    COALESCE(lq.personal_leave_used, 0) as personal_leave_used,
    COALESCE(30 - lq.sick_leave_used, 30) as remaining_sick_leave,
    COALESCE(10 - lq.personal_leave_used, 10) as remaining_personal_leave,
    TIMESTAMPDIFF(YEAR, e.hire_date, CURDATE()) as work_years
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN leave_quotas lq ON e.id = lq.employee_id AND lq.year = YEAR(CURDATE());

-- 完成提示
SELECT 
    '🎉 数据库初始化完成!' as status,
    COUNT(*) as employee_count,
    '请启动后端服务：cd backend && npm run dev' as next_step
FROM employees; 