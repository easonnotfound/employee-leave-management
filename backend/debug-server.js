/**
 * 临时调试服务器 - 端口3002
 * 用于验证数据库查询和员工验证功能
 */
const mysql = require('mysql2/promise');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 数据库配置
const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'employee_leave_system',
    charset: 'utf8mb4'
};

const pool = mysql.createPool(dbConfig);

// 员工身份验证API
app.post('/api/auth/verify', async (req, res) => {
    console.log('🔍 收到验证请求:', JSON.stringify(req.body, null, 2));
    
    try {
        const { identifier } = req.body;
        
        if (!identifier || !identifier.trim()) {
            console.log('❌ 缺少identifier参数');
            return res.status(400).json({
                success: false,
                message: '请输入员工姓名或工号'
            });
        }

        console.log('📋 查询员工:', identifier.trim());
        console.log('使用SQL: SELECT * FROM v_employee_details WHERE (name = ? OR id = ?) AND status = \"在职\"');
        
        const [employees] = await pool.execute(`
            SELECT * FROM v_employee_details 
            WHERE (name = ? OR id = ?) AND status = '在职'
        `, [identifier.trim(), identifier.trim()]);

        console.log('📊 查询结果数量:', employees.length);
        
        if (employees.length === 0) {
            console.log('❌ 未找到员工');
            
            // 额外调试 - 查看所有员工名字
            console.log('🔍 查看数据库中所有员工名字:');
            const [allEmployees] = await pool.execute('SELECT name, status FROM employees LIMIT 10');
            allEmployees.forEach(emp => console.log('  ', emp.name, emp.status));
            
            return res.status(404).json({
                success: false,
                message: '未找到员工信息，请检查姓名或工号是否正确'
            });
        }

        const employee = employees[0];
        console.log('✅ 找到员工:', employee.name, '部门:', employee.department_name);
        
        res.json({
            success: true,
            message: `欢迎 ${employee.name}，验证成功！`,
            employee: {
                basic: {
                    id: employee.id,
                    name: employee.name,
                    department: employee.department_name,
                    position: employee.position
                },
                leave: {
                    remainingAnnualLeave: employee.remaining_annual_leave || 0
                }
            }
        });
    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        console.error('错误栈:', error.stack);
        res.status(500).json({
            success: false,
            message: '服务器内部错误: ' + error.message
        });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '调试服务器运行正常',
        timestamp: new Date().toISOString()
    });
});

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`🚀 调试服务器启动在端口 ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log(`测试命令: curl -X POST http://localhost:${PORT}/api/auth/verify -H "Content-Type: application/json" -d "{\\"identifier\\":\\"钱进\\"}"`);
});