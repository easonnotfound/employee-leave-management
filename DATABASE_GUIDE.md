# MySQL数据库操作完整指南

## 🔧 连接MySQL数据库

### 方法1：使用您的MySQL命令行
```bash
# 在Windows命令提示符中运行
F:\MySQL\bin\mysql.exe -u root -p123456 employee_leave_system
```

### 方法2：使用MySQL Workbench或其他图形化工具
- Host: localhost
- Port: 3306
- Username: root
- Password: 123456
- Database: employee_leave_system

---

## 📊 常用查询操作

### 1. 基础查询
```sql
-- 查看所有表
SHOW TABLES;

-- 查看表结构
DESCRIBE employees;
DESCRIBE leave_applications;

-- 查看表数据量
SELECT 
    'employees' as table_name, COUNT(*) as count FROM employees
UNION ALL
SELECT 
    'departments' as table_name, COUNT(*) as count FROM departments
UNION ALL
SELECT 
    'leave_applications' as table_name, COUNT(*) as count FROM leave_applications;
```

### 2. 员工信息查询
```sql
-- 查看所有员工基本信息
SELECT 
    e.id as 工号,
    e.name as 姓名,
    d.name as 部门,
    e.position as 职位,
    e.hire_date as 入职日期,
    e.status as 状态
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
ORDER BY e.id;

-- 查看特定员工详细信息
SELECT * FROM employees WHERE id = 'TEC20220';

-- 查看某部门所有员工
SELECT 
    e.id, e.name, e.position, e.hire_date
FROM employees e
WHERE e.department_id = 1 AND e.status = 'active';
```

### 3. 请假记录查询
```sql
-- 查看所有请假记录
SELECT 
    la.id as 申请编号,
    e.name as 员工姓名,
    la.leave_type as 请假类型,
    la.start_date as 开始日期,
    la.end_date as 结束日期,
    la.days as 天数,
    la.status as 状态,
    la.application_time as 申请时间
FROM leave_applications la
LEFT JOIN employees e ON la.employee_id = e.id
ORDER BY la.application_time DESC;

-- 查看特定员工的请假记录
SELECT * FROM leave_applications 
WHERE employee_id = 'TEC20220'
ORDER BY application_time DESC;

-- 查看待审批的请假申请
SELECT 
    la.id, e.name, la.leave_type, la.start_date, la.end_date, la.days
FROM leave_applications la
LEFT JOIN employees e ON la.employee_id = e.id
WHERE la.status = 'pending';
```

### 4. 统计查询
```sql
-- 各部门员工统计
SELECT 
    d.name as 部门,
    COUNT(e.id) as 员工数量
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
GROUP BY d.id, d.name
ORDER BY COUNT(e.id) DESC;

-- 请假类型统计
SELECT 
    leave_type as 请假类型,
    COUNT(*) as 申请次数,
    SUM(days) as 总天数
FROM leave_applications
WHERE status = 'approved'
GROUP BY leave_type;

-- 本月请假统计
SELECT 
    e.name as 员工姓名,
    la.leave_type as 请假类型,
    SUM(la.days) as 本月请假天数
FROM leave_applications la
LEFT JOIN employees e ON la.employee_id = e.id
WHERE YEAR(la.start_date) = YEAR(CURDATE()) 
    AND MONTH(la.start_date) = MONTH(CURDATE())
    AND la.status = 'approved'
GROUP BY e.id, la.leave_type;
```

---

## ✏️ 数据修改操作

### 1. 员工信息管理
```sql
-- 添加新员工
INSERT INTO employees (id, name, department_id, position, hire_date, phone, status)
VALUES ('EMP001', '新员工', 1, '开发工程师', '2024-07-24', '13800000000', 'active');

-- 为新员工添加年假配额
INSERT INTO leave_quotas (employee_id, year, annual_leave_total, annual_leave_used, sick_leave_used, personal_leave_used)
VALUES ('EMP001', 2024, 5, 0, 0, 0);

-- 更新员工信息
UPDATE employees 
SET position = '高级开发工程师', phone = '13900000000'
WHERE id = 'EMP001';

-- 员工离职（软删除）
UPDATE employees 
SET status = 'resigned', updated_at = NOW()
WHERE id = 'EMP001';
```

### 2. 请假申请管理
```sql
-- 手动添加请假申请
INSERT INTO leave_applications 
(id, employee_id, leave_type, start_date, end_date, days, reason, application_time, status)
VALUES 
('LA2024072401', 'TEC20220', '年假', '2024-08-01', '2024-08-03', 3, '个人事务', NOW(), 'pending');

-- 审批请假申请（批准）
UPDATE leave_applications 
SET status = 'approved', approved_at = NOW()
WHERE id = 'LA2024072401';

-- 审批请假申请（拒绝）
UPDATE leave_applications 
SET status = 'rejected', approved_at = NOW(), rejected_reason = '工作安排冲突'
WHERE id = 'LA2024072401';

-- 删除请假记录
DELETE FROM leave_applications WHERE id = 'LA2024072401';
```

### 3. 部门管理
```sql
-- 添加新部门
INSERT INTO departments (name, director_name, description)
VALUES ('研发部', '张总监', '负责产品研发工作');

-- 更新部门信息
UPDATE departments 
SET director_name = '李总监', description = '负责核心技术研发'
WHERE name = '研发部';
```

### 4. 年假配额管理
```sql
-- 查看员工年假使用情况
SELECT 
    e.name as 员工姓名,
    lq.annual_leave_total as 年假总额,
    lq.annual_leave_used as 已用年假,
    (lq.annual_leave_total - lq.annual_leave_used) as 剩余年假
FROM leave_quotas lq
LEFT JOIN employees e ON lq.employee_id = e.id
WHERE lq.year = 2024;

-- 重置员工年假配额
UPDATE leave_quotas 
SET annual_leave_used = 0, sick_leave_used = 0, personal_leave_used = 0
WHERE year = 2024 AND employee_id = 'TEC20220';

-- 批量更新年假总额（根据工作年限）
UPDATE leave_quotas lq
JOIN employees e ON lq.employee_id = e.id
SET lq.annual_leave_total = 
    CASE 
        WHEN TIMESTAMPDIFF(YEAR, e.hire_date, CURDATE()) >= 5 THEN 15
        WHEN TIMESTAMPDIFF(YEAR, e.hire_date, CURDATE()) >= 3 THEN 10
        WHEN TIMESTAMPDIFF(YEAR, e.hire_date, CURDATE()) >= 1 THEN 5
        ELSE 0
    END
WHERE lq.year = 2024;
```

---

## 🛡️ 安全操作建议

### 1. 备份数据
```sql
-- 创建表备份
CREATE TABLE employees_backup AS SELECT * FROM employees;
CREATE TABLE leave_applications_backup AS SELECT * FROM leave_applications;
```

### 2. 事务操作
```sql
-- 使用事务确保数据一致性
START TRANSACTION;

-- 执行多个相关操作
INSERT INTO leave_applications (...);
UPDATE leave_quotas SET annual_leave_used = annual_leave_used + 3 WHERE ...;

-- 确认无误后提交
COMMIT;

-- 如果有错误则回滚
-- ROLLBACK;
```

### 3. 权限管理
```sql
-- 创建只读用户（可选）
CREATE USER 'readonly'@'localhost' IDENTIFIED BY 'password';
GRANT SELECT ON employee_leave_system.* TO 'readonly'@'localhost';
```

---

## 📱 推荐的图形化管理工具

1. **MySQL Workbench** (官方免费)
   - 下载：https://dev.mysql.com/downloads/workbench/
   - 功能：完整的数据库管理界面

2. **phpMyAdmin** (Web界面)
   - 安装：通过XAMPP等集成环境
   - 功能：浏览器访问的数据库管理

3. **Navicat** (商业软件)
   - 功能：专业的数据库管理工具

4. **DBeaver** (免费开源)
   - 下载：https://dbeaver.io/
   - 功能：通用数据库工具

---

## 🎯 快速操作脚本

我已经为您创建了以下工具脚本：
- `backend/utils/view-database.js` - 查看数据库状态
- `backend/utils/db-editor.js` - 数据库编辑操作
- `backend/utils/check-db.js` - 数据库连接检查

使用方法：
```bash
cd "D:\cursor\员工请假\backend"
node utils/view-database.js    # 查看数据库
node utils/check-db.js         # 检查连接
```