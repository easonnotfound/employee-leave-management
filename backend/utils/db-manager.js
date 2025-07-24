/**
 * 数据库查看和修改工具
 * 使用Node.js连接MySQL数据库进行操作
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库配置
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'employee_leave_system',
    charset: 'utf8mb4'
};

class DatabaseManager {
    constructor() {
        this.connection = null;
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection(dbConfig);
            console.log('✅ 数据库连接成功！');
            return true;
        } catch (error) {
            console.error('❌ 数据库连接失败:', error.message);
            return false;
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            console.log('🔌 数据库连接已关闭');
        }
    }

    // 查看所有表
    async showTables() {
        console.log('\n📋 数据库表列表:');
        console.log('='.repeat(50));
        const [tables] = await this.connection.execute('SHOW TABLES');
        tables.forEach((table, index) => {
            console.log(`${index + 1}. ${Object.values(table)[0]}`);
        });
    }

    // 查看表结构
    async describeTable(tableName) {
        console.log(`\n🏗️ 表 ${tableName} 结构:`);
        console.log('='.repeat(50));
        const [columns] = await this.connection.execute(`DESCRIBE ${tableName}`);
        columns.forEach(col => {
            console.log(`${col.Field.padEnd(20)} | ${col.Type.padEnd(15)} | ${col.Null} | ${col.Key} | ${col.Default || 'NULL'}`);
        });
    }

    // 查看员工数据
    async showEmployees() {
        console.log('\n👥 员工信息:');
        console.log('='.repeat(80));
        const [employees] = await this.connection.execute(`
            SELECT id, name, department_name, position, remaining_annual_leave 
            FROM v_employee_details 
            LIMIT 10
        `);
        
        console.log('工号\t\t姓名\t部门\t\t职位\t\t剩余年假');
        console.log('-'.repeat(80));
        employees.forEach(emp => {
            console.log(`${emp.id}\t${emp.name}\t${emp.department_name}\t${emp.position}\t${emp.remaining_annual_leave}天`);
        });
    }

    // 查看请假记录
    async showLeaveRecords(limit = 5) {
        console.log(`\n📝 最近 ${limit} 条请假记录:`);
        console.log('='.repeat(100));
        const [records] = await this.connection.execute(`
            SELECT id, employee_name, leave_type, start_date, end_date, days, status
            FROM v_leave_application_details 
            ORDER BY application_time DESC 
            LIMIT ?
        `, [limit]);
        
        console.log('申请编号\t\t\t员工姓名\t请假类型\t开始日期\t结束日期\t天数\t状态');
        console.log('-'.repeat(100));
        records.forEach(record => {
            console.log(`${record.id}\t${record.employee_name}\t${record.leave_type}\t${record.start_date}\t${record.end_date}\t${record.days}\t${record.status}`);
        });
    }

    // 添加新员工
    async addEmployee(employeeData) {
        const { id, name, department_id, position, hire_date } = employeeData;
        try {
            await this.connection.execute(`
                INSERT INTO employees (id, name, department_id, position, hire_date, status)
                VALUES (?, ?, ?, ?, ?, 'active')
            `, [id, name, department_id, position, hire_date]);
            
            console.log(`✅ 员工 ${name} (${id}) 添加成功！`);
        } catch (error) {
            console.error(`❌ 添加员工失败:`, error.message);
        }
    }

    // 更新员工信息
    async updateEmployee(employeeId, updateData) {
        const fields = Object.keys(updateData);
        const values = Object.values(updateData);
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        
        try {
            const [result] = await this.connection.execute(`
                UPDATE employees SET ${setClause} WHERE id = ?
            `, [...values, employeeId]);
            
            if (result.affectedRows > 0) {
                console.log(`✅ 员工 ${employeeId} 信息更新成功！`);
            } else {
                console.log(`⚠️ 未找到员工 ${employeeId}`);
            }
        } catch (error) {
            console.error(`❌ 更新员工信息失败:`, error.message);
        }
    }

    // 删除请假记录
    async deleteLeaveRecord(applicationId) {
        try {
            const [result] = await this.connection.execute(`
                DELETE FROM leave_applications WHERE id = ?
            `, [applicationId]);
            
            if (result.affectedRows > 0) {
                console.log(`✅ 请假记录 ${applicationId} 删除成功！`);
            } else {
                console.log(`⚠️ 未找到请假记录 ${applicationId}`);
            }
        } catch (error) {
            console.error(`❌ 删除请假记录失败:`, error.message);
        }
    }

    // 统计信息
    async showStatistics() {
        console.log('\n📊 系统统计信息:');
        console.log('='.repeat(50));
        
        // 员工总数
        const [empCount] = await this.connection.execute(
            'SELECT COUNT(*) as count FROM employees WHERE status = "active"'
        );
        console.log(`👥 活跃员工数: ${empCount[0].count}`);
        
        // 今日请假人数
        const [todayLeave] = await this.connection.execute(`
            SELECT COUNT(*) as count FROM leave_applications 
            WHERE CURDATE() BETWEEN start_date AND end_date AND status = 'approved'
        `);
        console.log(`🏃 今日请假人数: ${todayLeave[0].count}`);
        
        // 待审批数量
        const [pending] = await this.connection.execute(
            'SELECT COUNT(*) as count FROM leave_applications WHERE status = "pending"'
        );
        console.log(`⏳ 待审批申请: ${pending[0].count}`);
        
        // 本月请假统计
        const [monthlyStats] = await this.connection.execute(`
            SELECT leave_type, COUNT(*) as count, SUM(days) as total_days
            FROM leave_applications 
            WHERE YEAR(start_date) = YEAR(CURDATE()) 
                AND MONTH(start_date) = MONTH(CURDATE())
                AND status = 'approved'
            GROUP BY leave_type
        `);
        
        console.log('\n📈 本月请假统计:');
        monthlyStats.forEach(stat => {
            console.log(`  ${stat.leave_type}: ${stat.count}次, 共${stat.total_days}天`);
        });
    }
}

// 主要操作函数
async function main() {
    const db = new DatabaseManager();
    
    if (await db.connect()) {
        try {
            // 显示基本信息
            await db.showTables();
            await db.showEmployees();
            await db.showLeaveRecords();
            await db.showStatistics();
            
            console.log('\n🎯 数据库查看完成！');
            console.log('\n💡 使用方法:');
            console.log('1. 查看表结构: await db.describeTable("employees")');
            console.log('2. 添加员工: await db.addEmployee({id:"EMP001", name:"张三", department_id:1, position:"开发", hire_date:"2024-01-01"})');
            console.log('3. 更新员工: await db.updateEmployee("EMP001", {position:"高级开发"})');
            console.log('4. 删除请假: await db.deleteLeaveRecord("LA202407240001")');
            
        } catch (error) {
            console.error('❌ 操作失败:', error.message);
        } finally {
            await db.disconnect();
        }
    }
}

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}

module.exports = DatabaseManager;