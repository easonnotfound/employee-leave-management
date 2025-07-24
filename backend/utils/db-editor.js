

/**
 * 数据库修改操作工具
 * 提供增删改查的实用方法
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'employee_leave_system',
    charset: 'utf8mb4'
};

class DatabaseEditor {
    constructor() {
        this.connection = null;
    }

    async connect() {
        this.connection = await mysql.createConnection(dbConfig);
        console.log('✅ 数据库连接成功！');
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            console.log('🔌 数据库连接已关闭');
        }
    }

    // ==================== 查询操作 ====================
    
    // 查看指定员工信息
    async getEmployee(employeeId) {
        const [result] = await this.connection.execute(`
            SELECT e.*, d.name as department_name, lq.remaining_annual_leave
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN v_employee_details lq ON e.id = lq.id
            WHERE e.id = ?
        `, [employeeId]);
        
        if (result.length > 0) {
            console.log('👤 员工详细信息:');
            console.table(result[0]);
        } else {
            console.log(`❌ 未找到员工: ${employeeId}`);
        }
        return result[0];
    }

    // 查看部门所有员工
    async getDepartmentEmployees(departmentId) {
        const [result] = await this.connection.execute(`
            SELECT e.id, e.name, e.position, e.hire_date, d.name as department
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE e.department_id = ? AND e.status = 'active'
        `, [departmentId]);
        
        console.log(`🏢 部门 ${departmentId} 的员工:`)
        console.table(result);
        return result;
    }

    // ==================== 修改操作 ====================
    
    // 添加新员工
    async addEmployee(data) {
        const { id, name, department_id, position, hire_date, phone } = data;
        
        try {
            // 添加员工基本信息
            await this.connection.execute(`
                INSERT INTO employees (id, name, department_id, position, hire_date, phone, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')
            `, [id, name, department_id, position, hire_date, phone || null]);
            
            // 添加假期配额（根据入职年份）
            const currentYear = new Date().getFullYear();
            await this.connection.execute(`
                INSERT INTO leave_quotas (employee_id, year, annual_leave_total, annual_leave_used, sick_leave_used, personal_leave_used)
                VALUES (?, ?, 5, 0, 0, 0)
            `, [id, currentYear]);
            
            console.log(`✅ 员工 ${name} (${id}) 添加成功！`);
            await this.getEmployee(id);
            
        } catch (error) {
            console.error(`❌ 添加员工失败:`, error.message);
        }
    }

    // 更新员工信息
    async updateEmployee(employeeId, updateData) {
        const allowedFields = ['name', 'position', 'phone', 'emergency_contact', 'emergency_phone'];
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) {
            console.log('❌ 没有有效的更新字段');
            return;
        }
        
        try {
            const [result] = await this.connection.execute(`
                UPDATE employees SET ${updates.join(', ')}, updated_at = NOW()
                WHERE id = ?
            `, [...values, employeeId]);
            
            if (result.affectedRows > 0) {
                console.log(`✅ 员工 ${employeeId} 信息更新成功！`);
                await this.getEmployee(employeeId);
            } else {
                console.log(`❌ 未找到员工: ${employeeId}`);
            }
        } catch (error) {
            console.error(`❌ 更新失败:`, error.message);
        }
    }

    // 添加测试请假记录
    async addTestLeaveApplication(employeeId, leaveType = '年假') {
        const applicationId = `LA${Date.now()}`;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 7); // 一周后开始
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 2); // 请假3天
        
        try {
            await this.connection.execute(`
                INSERT INTO leave_applications 
                (id, employee_id, leave_type, start_date, end_date, days, reason, application_time, status)
                VALUES (?, ?, ?, ?, ?, 3, '个人事务', NOW(), 'pending')
            `, [applicationId, employeeId, leaveType, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);
            
            console.log(`✅ 为员工 ${employeeId} 创建测试请假记录: ${applicationId}`);
            
            // 显示创建的记录
            const [record] = await this.connection.execute(`
                SELECT la.*, e.name as employee_name
                FROM leave_applications la
                LEFT JOIN employees e ON la.employee_id = e.id
                WHERE la.id = ?
            `, [applicationId]);
            
            console.table(record);
            
        } catch (error) {
            console.error(`❌ 创建请假记录失败:`, error.message);
        }
    }

    // 审批请假申请
    async approveLeaveApplication(applicationId, action = 'approved', comment = '') {
        try {
            const status = action === 'approve' ? 'approved' : 'rejected';
            await this.connection.execute(`
                UPDATE leave_applications 
                SET status = ?, approved_at = NOW(), rejected_reason = ?
                WHERE id = ?
            `, [status, action === 'reject' ? comment : null, applicationId]);
            
            console.log(`✅ 请假申请 ${applicationId} 已${status === 'approved' ? '批准' : '拒绝'}`);
            
        } catch (error) {
            console.error(`❌ 审批失败:`, error.message);
        }
    }

    // ==================== 删除操作 ====================
    
    // 删除员工（软删除）
    async deactivateEmployee(employeeId) {
        try {
            const [result] = await this.connection.execute(`
                UPDATE employees SET status = 'inactive', updated_at = NOW()
                WHERE id = ?
            `, [employeeId]);
            
            if (result.affectedRows > 0) {
                console.log(`✅ 员工 ${employeeId} 已停用`);
            } else {
                console.log(`❌ 未找到员工: ${employeeId}`);
            }
        } catch (error) {
            console.error(`❌ 停用员工失败:`, error.message);
        }
    }

    // 删除请假记录
    async deleteLeaveApplication(applicationId) {
        try {
            const [result] = await this.connection.execute(`
                DELETE FROM leave_applications WHERE id = ?
            `, [applicationId]);
            
            if (result.affectedRows > 0) {
                console.log(`✅ 请假记录 ${applicationId} 已删除`);
            } else {
                console.log(`❌ 未找到请假记录: ${applicationId}`);
            }
        } catch (error) {
            console.error(`❌ 删除失败:`, error.message);
        }
    }

    // ==================== 批量操作 ====================
    
    // 批量更新年假配额
    async updateAnnualLeaveQuotas(year = new Date().getFullYear()) {
        try {
            // 为所有活跃员工更新年假配额
            await this.connection.execute(`
                INSERT INTO leave_quotas (employee_id, year, annual_leave_total, annual_leave_used, sick_leave_used, personal_leave_used)
                SELECT id, ?, 
                    CASE 
                        WHEN TIMESTAMPDIFF(YEAR, hire_date, CURDATE()) >= 5 THEN 15
                        WHEN TIMESTAMPDIFF(YEAR, hire_date, CURDATE()) >= 3 THEN 10
                        WHEN TIMESTAMPDIFF(YEAR, hire_date, CURDATE()) >= 1 THEN 5
                        ELSE 0
                    END,
                    0, 0, 0
                FROM employees 
                WHERE status = 'active' 
                    AND id NOT IN (SELECT employee_id FROM leave_quotas WHERE year = ?)
            `, [year, year]);
            
            console.log(`✅ ${year}年度年假配额更新完成`);
            
        } catch (error) {
            console.error(`❌ 更新年假配额失败:`, error.message);
        }
    }
}

// 示例用法
async function demoOperations() {
    const db = new DatabaseEditor();
    await db.connect();
    
    try {
        console.log('='.repeat(60));
        console.log('🎯 数据库操作演示');
        console.log('='.repeat(60));
        
        // 1. 查看员工信息
        console.log('\n1️⃣ 查看员工信息:');
        await db.getEmployee('TEC20220');
        
        // 2. 查看部门员工
        console.log('\n2️⃣ 查看技术部员工:');
        await db.getDepartmentEmployees(1);
        
        // 3. 添加测试请假记录
        console.log('\n3️⃣ 为张伟添加测试请假记录:');
        await db.addTestLeaveApplication('TEC20220');
        
        console.log('\n✅ 演示完成！');
        console.log('💡 您可以修改代码来执行具体的操作');
        
    } catch (error) {
        console.error('❌ 演示失败:', error.message);
    } finally {
        await db.disconnect();
    }
}

// 如果直接运行
if (require.main === module) {
    demoOperations();
}

module.exports = DatabaseEditor;