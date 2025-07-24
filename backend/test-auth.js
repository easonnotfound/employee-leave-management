/**
 * 测试员工身份验证功能
 */
const mysql = require('mysql2/promise');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'employee_leave_system',
    charset: 'utf8mb4'
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 员工身份验证API
app.post('/api/auth/verify', async (req, res) => {
    console.log('🔍 收到身份验证请求:', JSON.stringify(req.body, null, 2));
    
    try {
        const { identifier } = req.body;
        
        if (!identifier || !identifier.trim()) {
            return res.status(400).json({
                success: false,
                message: '请输入员工姓名或工号'
            });
        }

        console.log('📋 查询员工:', identifier.trim());
        
        const [employees] = await pool.execute(`
            SELECT * FROM v_employee_details 
            WHERE (name = ? OR id = ?) AND status = '在职'
        `, [identifier.trim(), identifier.trim()]);

        console.log('📊 查询结果数量:', employees.length);
        
        if (employees.length === 0) {
            console.log('❌ 未找到员工');
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
                    position: employee.position,
                    supervisor: employee.supervisor,
                    workType: employee.work_type
                },
                leave: {
                    remainingAnnualLeave: employee.remaining_annual_leave,
                    annualLeaveTotal: employee.annual_leave_total,
                    annualLeaveUsed: employee.annual_leave_used,
                    usedSickLeave: employee.sick_leave_used,
                    usedPersonalLeave: employee.personal_leave_used,
                    remainingSickLeave: employee.remaining_sick_leave,
                    remainingPersonalLeave: employee.remaining_personal_leave
                },
                profile: {
                    hireDate: employee.hire_date,
                    workYears: employee.work_years,
                    phone: employee.phone,
                    emergencyContact: employee.emergency_contact,
                    emergencyPhone: employee.emergency_phone
                }
            }
        });
    } catch (error) {
        console.error('❌ 验证失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 测试服务器启动在端口 ${PORT}`);
    console.log(`请测试: curl -X POST http://localhost:${PORT}/api/auth/verify -H "Content-Type: application/json" -d "{\\"identifier\\":\\"钱进\\"}"`);
});