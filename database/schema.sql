-- ========================================
-- 员工请假管理系统 - MySQL数据库表结构设计
-- 创建日期: 2024-12-21
-- 版本: v1.0 
-- 用途: 生产环境数据库，支持实时数据存储和查询
-- ========================================

-- 创建数据库（支持中文字符）
CREATE DATABASE IF NOT EXISTS employee_leave_system 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE employee_leave_system;

-- ========================================
-- 1. 部门表 (departments)
-- ========================================
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '部门ID',
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '部门名称',
    director_name VARCHAR(50) COMMENT '部门总监姓名',
    description TEXT COMMENT '部门描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB COMMENT='部门信息表';

-- ========================================
-- 2. 员工表 (employees)
-- ========================================
CREATE TABLE employees (
    id VARCHAR(20) PRIMARY KEY COMMENT '员工编号',
    name VARCHAR(50) NOT NULL COMMENT '员工姓名',
    department_id INT NOT NULL COMMENT '部门ID',
    position VARCHAR(50) NOT NULL COMMENT '职位',
    hire_date DATE NOT NULL COMMENT '入职日期',
    work_type ENUM('标准工作制', '弹性工作制') DEFAULT '标准工作制' COMMENT '工作制度',
    supervisor VARCHAR(50) COMMENT '直属主管',
    phone VARCHAR(20) COMMENT '联系电话',
    emergency_contact VARCHAR(50) COMMENT '紧急联系人',
    emergency_phone VARCHAR(20) COMMENT '紧急联系人电话',
    status ENUM('active', 'inactive', 'resigned') DEFAULT 'active' COMMENT '员工状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 外键约束
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    
    -- 索引优化
    INDEX idx_department (department_id),
    INDEX idx_name (name),
    INDEX idx_status (status),
    INDEX idx_hire_date (hire_date)
) ENGINE=InnoDB COMMENT='员工基础信息表';

-- ========================================
-- 3. 假期配额表 (leave_quotas)
-- ========================================
CREATE TABLE leave_quotas (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '配额ID',
    employee_id VARCHAR(20) NOT NULL COMMENT '员工编号',
    year YEAR NOT NULL COMMENT '年度',
    annual_leave_total INT DEFAULT 0 COMMENT '年假总额度',
    annual_leave_used INT DEFAULT 0 COMMENT '已用年假',
    sick_leave_used INT DEFAULT 0 COMMENT '已用病假',
    personal_leave_used INT DEFAULT 0 COMMENT '已用事假',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 外键约束
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- 唯一约束：每个员工每年只能有一条记录
    UNIQUE KEY uk_employee_year (employee_id, year),
    
    -- 索引优化
    INDEX idx_year (year),
    INDEX idx_employee_year (employee_id, year)
) ENGINE=InnoDB COMMENT='员工假期配额表';

-- ========================================
-- 4. 请假申请表 (leave_applications)
-- ========================================
CREATE TABLE leave_applications (
    id VARCHAR(30) PRIMARY KEY COMMENT '申请编号',
    employee_id VARCHAR(20) NOT NULL COMMENT '申请人员工编号',
    leave_type ENUM('年假', '病假', '事假', '婚假', '产假', '陪产假', '丧假', '调休假') NOT NULL COMMENT '请假类型',
    start_date DATE NOT NULL COMMENT '开始日期',
    end_date DATE NOT NULL COMMENT '结束日期',
    days INT NOT NULL COMMENT '请假天数',
    reason TEXT NOT NULL COMMENT '请假原因',
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending' COMMENT '申请状态',
    advance_notice_days INT COMMENT '提前申请天数',
    application_time TIMESTAMP NOT NULL COMMENT '申请时间',
    approved_by JSON COMMENT '审批人列表(JSON格式)',
    approved_at TIMESTAMP NULL COMMENT '审批完成时间',
    rejected_reason TEXT COMMENT '拒绝原因',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 外键约束
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- 数据约束
    CHECK (days > 0),
    CHECK (end_date >= start_date),
    
    -- 索引优化
    INDEX idx_employee (employee_id),
    INDEX idx_status (status),
    INDEX idx_leave_type (leave_type),
    INDEX idx_application_time (application_time),
    INDEX idx_date_range (start_date, end_date),
    INDEX idx_employee_status (employee_id, status)
) ENGINE=InnoDB COMMENT='请假申请表';

-- ========================================
-- 5. 审批流程表 (approval_process)
-- ========================================
CREATE TABLE approval_process (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '审批ID',
    application_id VARCHAR(30) NOT NULL COMMENT '申请编号',
    approver_level VARCHAR(50) NOT NULL COMMENT '审批层级',
    approver_name VARCHAR(50) NOT NULL COMMENT '审批人姓名',
    approval_order INT NOT NULL COMMENT '审批顺序',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审批状态',
    approval_time TIMESTAMP NULL COMMENT '审批时间',
    comments TEXT COMMENT '审批意见',
    reason TEXT COMMENT '审批原因说明',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 外键约束
    FOREIGN KEY (application_id) REFERENCES leave_applications(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- 索引优化
    INDEX idx_application (application_id),
    INDEX idx_status (status),
    INDEX idx_order (approval_order),
    INDEX idx_app_order (application_id, approval_order)
) ENGINE=InnoDB COMMENT='审批流程明细表';

-- ========================================
-- 6. 系统配置表 (system_configs)
-- ========================================
CREATE TABLE system_configs (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '配置ID',
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    description TEXT COMMENT '配置说明',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB COMMENT='系统配置表';

-- ========================================
-- 7. 操作日志表 (operation_logs)
-- ========================================
CREATE TABLE operation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
    user_id VARCHAR(20) COMMENT '操作用户ID',
    operation_type ENUM('create', 'update', 'delete', 'approve', 'reject', 'login') NOT NULL COMMENT '操作类型',
    target_table VARCHAR(50) NOT NULL COMMENT '目标表名',
    target_id VARCHAR(50) NOT NULL COMMENT '目标记录ID',
    operation_data JSON COMMENT '操作数据(JSON格式)',
    ip_address VARCHAR(45) COMMENT 'IP地址',
    user_agent TEXT COMMENT '用户代理',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    -- 索引优化
    INDEX idx_user (user_id),
    INDEX idx_type (operation_type),
    INDEX idx_target (target_table, target_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB COMMENT='操作日志表';

-- ========================================
-- 插入初始数据
-- ========================================

-- 插入部门数据
INSERT INTO departments (name, director_name, description) VALUES
('技术部', '李技术总监', '负责产品技术开发和维护'),
('销售部', '陈销售总监', '负责产品销售和客户关系维护'),
('产品部', '刘产品总监', '负责产品设计和需求管理'),
('市场部', '周市场总监', '负责市场推广和品牌宣传'),
('运营部', '马运营经理', '负责日常运营和客户服务'),
('人事部', '林HR经理', '负责人力资源管理'),
('财务部', '钱财务经理', '负责财务管理和会计核算');

-- 插入员工数据
INSERT INTO employees (id, name, department_id, position, hire_date, work_type, supervisor, phone, emergency_contact, emergency_phone) VALUES
('TEC20220', '张伟', 1, '高级工程师', '2022-03-01', '弹性工作制', '李技术总监', '13800138001', '张太太', '13800138002'),
('TEC20230', '王强', 1, '中级工程师', '2023-01-01', '弹性工作制', '李技术总监', '13800138003', '王妈妈', '13800138004'),
('SAL20210', '李娜', 2, '销售经理', '2021-06-01', '标准工作制', '陈销售总监', '13800138005', '李先生', '13800138006'),
('PRD20220', '赵敏', 3, '产品经理', '2022-09-01', '弹性工作制', '刘产品总监', '13800138007', '赵先生', '13800138008'),
('MKT20230', '孙丽', 4, '市场专员', '2023-08-01', '标准工作制', '周市场总监', '13800138009', '孙爸爸', '13800138010'),
('OPS20200', '吴军', 5, '客服主管', '2020-05-01', '标准工作制', '马运营经理', '13800138011', '吴太太', '13800138012'),
('HR202100', '郑红', 6, 'HR专员', '2021-02-01', '标准工作制', '林HR经理', '13800138013', '郑妈妈', '13800138014'),
('FIN20200', '钱进', 7, '会计', '2020-09-01', '标准工作制', '钱财务经理', '13800138015', '钱太太', '13800138016');

-- 插入2024年假期配额数据（基于工作年限计算）
INSERT INTO leave_quotas (employee_id, year, annual_leave_total, annual_leave_used, sick_leave_used, personal_leave_used) VALUES
('TEC20220', 2024, 10, 2, 2, 1),  -- 张伟：工作2年多，年假10天
('TEC20230', 2024, 5, 0, 0, 0),   -- 王强：工作1年，年假5天
('SAL20210', 2024, 15, 3, 3, 2),  -- 李娜：工作3年多，年假15天
('PRD20220', 2024, 10, 0, 1, 1),  -- 赵敏：工作2年多，年假10天
('MKT20230', 2024, 5, 2, 0, 1),   -- 孙丽：工作1年多，年假5天
('OPS20200', 2024, 15, 0, 4, 2),  -- 吴军：工作4年多，年假15天
('HR202100', 2024, 15, 5, 2, 1),  -- 郑红：工作3年多，年假15天
('FIN20200', 2024, 15, 3, 5, 3);  -- 钱进：工作4年多，年假15天

-- 插入系统配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
('max_annual_leave_days', '15', '年假最大天数'),
('max_sick_leave_days', '30', '病假年度最大天数'),
('max_personal_leave_days', '10', '事假年度最大天数'),
('approval_timeout_days', '3', '审批超时天数'),
('ai_api_key', 'sk-VXX8gTqtw2nQ0kzYq7VG4h1f9IBaB6kJd0xfUoPK9P83IsON', '云雾AI API密钥'),
('ai_base_url', 'https://yunwu.ai/v1', '云雾AI API地址'),
('system_version', '1.0.0', '系统版本号'),
('company_name', '科技有限公司', '公司名称');

-- ========================================
-- 创建视图 - 员工完整信息视图
-- ========================================
CREATE VIEW v_employee_details AS
SELECT 
    e.id,
    e.name,
    e.position,
    d.name as department_name,
    e.hire_date,
    e.work_type,
    e.supervisor,
    e.phone,
    e.emergency_contact,
    e.emergency_phone,
    e.status,
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

-- ========================================
-- 创建视图 - 请假申请详情视图
-- ========================================
CREATE VIEW v_leave_application_details AS
SELECT 
    la.id,
    la.employee_id,
    e.name as employee_name,
    d.name as department_name,
    e.position,
    la.leave_type,
    la.start_date,
    la.end_date,
    la.days,
    la.reason,
    la.status,
    la.advance_notice_days,
    la.application_time,
    la.approved_by,
    la.approved_at,
    la.rejected_reason,
    CASE 
        WHEN la.status = 'pending' THEN '待审批'
        WHEN la.status = 'approved' THEN '已批准'
        WHEN la.status = 'rejected' THEN '已拒绝'
        WHEN la.status = 'cancelled' THEN '已取消'
        ELSE la.status
    END as status_text
FROM leave_applications la
JOIN employees e ON la.employee_id = e.id
JOIN departments d ON e.department_id = d.id;

-- ========================================
-- 创建存储过程 - 计算年假配额
-- ========================================
DELIMITER //

CREATE PROCEDURE CalculateAnnualLeaveQuota(
    IN p_employee_id VARCHAR(20),
    IN p_year YEAR,
    OUT p_quota INT
)
BEGIN
    DECLARE v_hire_date DATE;
    DECLARE v_work_years INT;
    
    -- 获取员工入职日期
    SELECT hire_date INTO v_hire_date 
    FROM employees 
    WHERE id = p_employee_id;
    
    -- 计算工作年限
    SET v_work_years = TIMESTAMPDIFF(YEAR, v_hire_date, CONCAT(p_year, '-12-31'));
    
    -- 根据工作年限计算年假配额
    IF v_work_years < 1 THEN
        SET p_quota = 0;
    ELSEIF v_work_years < 3 THEN
        SET p_quota = 5;
    ELSEIF v_work_years < 5 THEN
        SET p_quota = 10;
    ELSE
        SET p_quota = 15;
    END IF;
END //

DELIMITER ;

-- ========================================
-- 创建触发器 - 自动更新假期使用情况
-- ========================================
DELIMITER //

CREATE TRIGGER tr_update_leave_quota_after_approval
AFTER UPDATE ON leave_applications
FOR EACH ROW
BEGIN
    -- 当请假申请被批准时，更新假期使用情况
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        CASE NEW.leave_type
            WHEN '年假' THEN
                UPDATE leave_quotas 
                SET annual_leave_used = annual_leave_used + NEW.days
                WHERE employee_id = NEW.employee_id AND year = YEAR(NEW.start_date);
            WHEN '病假' THEN
                UPDATE leave_quotas 
                SET sick_leave_used = sick_leave_used + NEW.days
                WHERE employee_id = NEW.employee_id AND year = YEAR(NEW.start_date);
            WHEN '事假' THEN
                UPDATE leave_quotas 
                SET personal_leave_used = personal_leave_used + NEW.days
                WHERE employee_id = NEW.employee_id AND year = YEAR(NEW.start_date);
        END CASE;
    END IF;
    
    -- 当请假申请被取消或拒绝时，恢复假期使用情况
    IF (NEW.status = 'rejected' OR NEW.status = 'cancelled') AND OLD.status = 'approved' THEN
        CASE NEW.leave_type
            WHEN '年假' THEN
                UPDATE leave_quotas 
                SET annual_leave_used = annual_leave_used - NEW.days
                WHERE employee_id = NEW.employee_id AND year = YEAR(NEW.start_date);
            WHEN '病假' THEN
                UPDATE leave_quotas 
                SET sick_leave_used = sick_leave_used - NEW.days
                WHERE employee_id = NEW.employee_id AND year = YEAR(NEW.start_date);
            WHEN '事假' THEN
                UPDATE leave_quotas 
                SET personal_leave_used = personal_leave_used - NEW.days
                WHERE employee_id = NEW.employee_id AND year = YEAR(NEW.start_date);
        END CASE;
    END IF;
END //

DELIMITER ;

-- ========================================
-- 创建性能优化索引
-- ========================================

-- 为频繁查询创建复合索引
ALTER TABLE leave_applications ADD INDEX idx_employee_date_status (employee_id, start_date, status);
ALTER TABLE leave_applications ADD INDEX idx_date_status (start_date, end_date, status);

-- ========================================
-- 数据完整性检查
-- ========================================

-- 检查员工数据
SELECT '员工数据检查' as check_name, COUNT(*) as count FROM employees WHERE status = 'active';

-- 检查部门数据
SELECT '部门数据检查' as check_name, COUNT(*) as count FROM departments;

-- 检查假期配额数据
SELECT '假期配额检查' as check_name, COUNT(*) as count FROM leave_quotas WHERE year = YEAR(CURDATE());

-- ========================================
-- 完成提示
-- ========================================
SELECT 
    '数据库初始化完成!' as message,
    CONCAT('共创建 ', 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'employee_leave_system'),
        ' 个表') as tables_created,
    CONCAT('共插入 ', 
        (SELECT COUNT(*) FROM employees),
        ' 个员工') as employees_inserted,
    NOW() as created_at; 