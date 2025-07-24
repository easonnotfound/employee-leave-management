/**
 * 简化版数据库查看工具
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

async function viewDatabase() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ 数据库连接成功！\n');
        
        // 1. 查看所有表
        console.log('📋 数据库表结构:');
        console.log('='.repeat(50));
        const [tables] = await connection.execute('SHOW TABLES');
        tables.forEach((table, index) => {
            console.log(`${index + 1}. ${Object.values(table)[0]}`);
        });
        
        // 2. 查看员工数据
        console.log('\n👥 员工信息:');
        console.log('='.repeat(80));
        const [employees] = await connection.execute(`
            SELECT e.id, e.name, d.name as department, e.position, e.hire_date
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            ORDER BY e.id
        `);
        
        console.log('工号\t\t姓名\t\t部门\t\t职位\t\t入职日期');
        console.log('-'.repeat(80));
        employees.forEach(emp => {
            console.log(`${emp.id}\t${emp.name}\t\t${emp.department}\t${emp.position}\t${emp.hire_date}`);
        });
        
        // 3. 查看请假记录
        console.log('\n📝 请假申请记录:');
        console.log('='.repeat(100));
        const [records] = await connection.execute(`
            SELECT la.id, e.name as employee_name, la.leave_type, la.start_date, la.end_date, la.days, la.status
            FROM leave_applications la
            LEFT JOIN employees e ON la.employee_id = e.id
            ORDER BY la.application_time DESC
            LIMIT 10
        `);
        
        if (records.length > 0) {
            console.log('申请编号\t\t\t员工姓名\t请假类型\t开始日期\t结束日期\t天数\t状态');
            console.log('-'.repeat(100));
            records.forEach(record => {
                console.log(`${record.id}\t${record.employee_name}\t${record.leave_type}\t${record.start_date}\t${record.end_date}\t${record.days}\t${record.status}`);
            });
        } else {
            console.log('暂无请假记录');
        }
        
        // 4. 统计信息
        console.log('\n📊 系统统计:');
        console.log('='.repeat(50));
        
        const [empCount] = await connection.execute('SELECT COUNT(*) as count FROM employees WHERE status = "active"');
        console.log(`👥 活跃员工数: ${empCount[0].count}`);
        
        const [deptCount] = await connection.execute('SELECT COUNT(*) as count FROM departments');
        console.log(`🏢 部门数量: ${deptCount[0].count}`);
        
        const [leaveCount] = await connection.execute('SELECT COUNT(*) as count FROM leave_applications');
        console.log(`📝 请假记录数: ${leaveCount[0].count}`);
        
        // 5. 部门信息
        console.log('\n🏢 部门信息:');
        console.log('='.repeat(60));
        const [departments] = await connection.execute('SELECT * FROM departments ORDER BY id');
        console.log('ID\t部门名称\t\t总监');
        console.log('-'.repeat(60));
        departments.forEach(dept => {
            console.log(`${dept.id}\t${dept.name}\t\t${dept.director_name}`);
        });
        
    } catch (error) {
        console.error('❌ 数据库操作失败:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 数据库连接已关闭');
        }
    }
}

viewDatabase();