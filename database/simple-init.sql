-- Simple Employee Leave System Database Initialization
-- Uses English for compatibility

USE employee_leave_system;

-- 1. Departments table
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    director_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Employees table  
CREATE TABLE employees (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    department_id INT NOT NULL,
    position VARCHAR(50) NOT NULL,
    hire_date DATE NOT NULL,
    work_type ENUM('standard', 'flexible') DEFAULT 'standard',
    supervisor VARCHAR(50),
    phone VARCHAR(20),
    emergency_contact VARCHAR(50),
    emergency_phone VARCHAR(20),
    status ENUM('active', 'inactive', 'resigned') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 3. Leave quotas table
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

-- 4. Leave applications table
CREATE TABLE leave_applications (
    id VARCHAR(30) PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL,
    leave_type ENUM('annual', 'sick', 'personal', 'marriage', 'maternity', 'paternity', 'funeral', 'compensatory') NOT NULL,
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

-- Insert departments
INSERT INTO departments (name, director_name) VALUES
('Technology', 'Li Tech Director'),
('Sales', 'Chen Sales Director'), 
('Product', 'Liu Product Director'),
('Marketing', 'Zhou Marketing Director'),
('Operations', 'Ma Operations Manager'),
('HR', 'Lin HR Manager'),
('Finance', 'Qian Finance Manager');

-- Insert employees
INSERT INTO employees VALUES
('TEC20220', 'Zhang Wei', 1, 'Senior Engineer', '2022-03-01', 'flexible', 'Li Tech Director', '13800138001', 'Zhang Wife', '13800138002', 'active', NOW()),
('TEC20230', 'Wang Qiang', 1, 'Engineer', '2023-01-01', 'flexible', 'Li Tech Director', '13800138003', 'Wang Mother', '13800138004', 'active', NOW()),
('SAL20210', 'Li Na', 2, 'Sales Manager', '2021-06-01', 'standard', 'Chen Sales Director', '13800138005', 'Li Husband', '13800138006', 'active', NOW()),
('PRD20220', 'Zhao Min', 3, 'Product Manager', '2022-09-01', 'flexible', 'Liu Product Director', '13800138007', 'Zhao Husband', '13800138008', 'active', NOW()),
('MKT20230', 'Sun Li', 4, 'Marketing Specialist', '2023-08-01', 'standard', 'Zhou Marketing Director', '13800138009', 'Sun Father', '13800138010', 'active', NOW()),
('OPS20200', 'Wu Jun', 5, 'Customer Service Manager', '2020-05-01', 'standard', 'Ma Operations Manager', '13800138011', 'Wu Wife', '13800138012', 'active', NOW()),
('HR202100', 'Zheng Hong', 6, 'HR Specialist', '2021-02-01', 'standard', 'Lin HR Manager', '13800138013', 'Zheng Mother', '13800138014', 'active', NOW()),
('FIN20200', 'Qian Jin', 7, 'Accountant', '2020-09-01', 'standard', 'Qian Finance Manager', '13800138015', 'Qian Wife', '13800138016', 'active', NOW());

-- Insert leave quotas for 2024
INSERT INTO leave_quotas (employee_id, year, annual_leave_total, annual_leave_used, sick_leave_used, personal_leave_used) VALUES
('TEC20220', 2024, 10, 2, 2, 1),
('TEC20230', 2024, 5, 0, 0, 0), 
('SAL20210', 2024, 15, 3, 3, 2),
('PRD20220', 2024, 10, 0, 1, 1),
('MKT20230', 2024, 5, 2, 0, 1),
('OPS20200', 2024, 15, 0, 4, 2),
('HR202100', 2024, 15, 5, 2, 1),
('FIN20200', 2024, 15, 3, 5, 3);

-- Create view for employee details
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

-- Completion message
SELECT 'Database initialized successfully!' as status, COUNT(*) as employee_count FROM employees; 