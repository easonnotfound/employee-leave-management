/**
 * 员工请假管理系统 - 后端API服务
 * 功能：连接MySQL数据库，提供RESTful API
 * 作者：员工请假系统开发团队
 * 版本：v1.0
 */

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const moment = require('moment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// ========================================
// 中间件配置
// ========================================

// 安全中间件
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

// CORS配置 - 允许前端访问
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// 压缩响应
app.use(compression());

// 请求日志
app.use(morgan('combined'));

// 解析JSON和URL编码数据
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP 100个请求
    message: {
        error: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});
app.use('/api/', limiter);

// ========================================
// 数据库配置
// ========================================

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'employee_leave_system',
    charset: 'utf8mb4',
    timezone: '+08:00',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

console.log('🔗 数据库连接配置:', {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: '***masked***',
    database: dbConfig.database
});

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ 数据库连接成功');
        console.log(`📍 数据库: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        console.error('请检查：');
        console.error('1. MySQL服务是否启动');
        console.error('2. 数据库配置是否正确');
        console.error('3. 数据库是否已创建');
        return false;
    }
}

// ========================================
// 工具函数
// ========================================

/**
 * 生成请假申请编号
 */
function generateApplicationId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getTime()).slice(-6);
    return `LA${year}${month}${day}${time}`;
}

/**
 * 记录操作日志
 */
async function logOperation(userId, operationType, targetTable, targetId, operationData, req) {
    try {
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        
        await pool.execute(`
            INSERT INTO operation_logs 
            (user_id, operation_type, target_table, target_id, operation_data, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, operationType, targetTable, targetId, JSON.stringify(operationData), ip, userAgent]);
    } catch (error) {
        console.error('记录操作日志失败:', error);
    }
}

/**
 * 错误处理中间件
 */
function errorHandler(err, req, res, next) {
    console.error('API错误:', err);
    
    // 数据库错误
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
            success: false,
            message: '数据已存在，请检查输入',
            code: 'DUPLICATE_ENTRY'
        });
    }
    
    // 其他错误
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 'INTERNAL_SERVER_ERROR'
    });
}

// ========================================
// API路由
// ========================================

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '员工请假管理系统API运行正常',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// 1. 员工身份验证
app.post('/api/auth/verify', async (req, res) => {
    try {
        const { identifier } = req.body;
        
        if (!identifier || !identifier.trim()) {
            return res.status(400).json({
                success: false,
                message: '请输入员工姓名或工号'
            });
        }

        const [employees] = await pool.execute(`
            SELECT * FROM v_employee_details 
            WHERE (name = ? OR id = ?) AND status = 'active'
        `, [identifier.trim(), identifier.trim()]);

        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message: '未找到员工信息，请检查姓名或工号是否正确'
            });
        }

        const employee = employees[0];
        
        // 记录登录日志
        await logOperation(employee.id, 'login', 'employees', employee.id, { identifier }, req);

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
                employment: {
                    hireDate: employee.hire_date,
                    workYears: employee.work_years
                },
                leave: {
                    remainingAnnualLeave: employee.remaining_annual_leave,
                    usedSickLeave: employee.sick_leave_used,
                    usedPersonalLeave: employee.personal_leave_used,
                    availableSickLeave: employee.remaining_sick_leave,
                    availablePersonalLeave: employee.remaining_personal_leave
                },
                contact: {
                    phone: employee.phone,
                    emergencyContact: employee.emergency_contact,
                    emergencyPhone: employee.emergency_phone
                }
            }
        });
    } catch (error) {
        console.error('验证员工身份失败:', error);
        res.status(500).json({
            success: false,
            message: '验证过程中发生错误，请重试'
        });
    }
});

// 2. 提交请假申请
app.post('/api/leave/apply', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
        // 添加详细日志记录
        console.log('🔍 收到请假申请请求:', JSON.stringify(req.body, null, 2));
        
        const {
            employeeId,
            leaveType,
            startDate,
            endDate,
            days,
            reason,
            advanceNoticeDays,
            applicationTime,
            approvalProcess
        } = req.body;

        // 详细字段检查日志
        console.log('📋 字段检查:');
        console.log('employeeId:', employeeId, '(类型:', typeof employeeId, ')');
        console.log('leaveType:', leaveType, '(类型:', typeof leaveType, ')');
        console.log('startDate:', startDate, '(类型:', typeof startDate, ')');
        console.log('endDate:', endDate, '(类型:', typeof endDate, ')');
        console.log('days:', days, '(类型:', typeof days, ')');
        console.log('reason:', reason, '(类型:', typeof reason, ')');

        // 验证必填字段
        if (!employeeId || !leaveType || !startDate || !endDate || !days || !reason) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                success: false,
                message: '请填写完整的请假信息'
            });
        }

        // 验证员工是否存在
        const [employeeCheck] = await connection.execute(
            'SELECT id FROM employees WHERE id = ? AND status = "active"',
            [employeeId]
        );

        if (employeeCheck.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({
                success: false,
                message: '员工不存在或已离职'
            });
        }

        // 检查假期余额（年假）
        if (leaveType === '年假') {
            const [quotaCheck] = await connection.execute(`
                SELECT remaining_annual_leave 
                FROM v_employee_details 
                WHERE id = ?
            `, [employeeId]);

            if (quotaCheck.length > 0 && quotaCheck[0].remaining_annual_leave < days) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    success: false,
                    message: `年假余额不足，剩余${quotaCheck[0].remaining_annual_leave}天，申请${days}天`
                });
            }
        }

        // 生成申请编号
        const applicationId = generateApplicationId();

        // 插入请假申请
        await connection.execute(`
            INSERT INTO leave_applications 
            (id, employee_id, leave_type, start_date, end_date, days, reason, 
             advance_notice_days, application_time, approved_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            applicationId, employeeId, leaveType, startDate, endDate, 
            days, reason, advanceNoticeDays, applicationTime,
            JSON.stringify(approvalProcess?.approvers || [])
        ]);

        // 插入审批流程
        if (approvalProcess && approvalProcess.approvers) {
            for (const approver of approvalProcess.approvers) {
                await connection.execute(`
                    INSERT INTO approval_process 
                    (application_id, approver_level, approver_name, approval_order, reason)
                    VALUES (?, ?, ?, ?, ?)
                `, [applicationId, approver.level, approver.name, approver.order, approver.reason || '']);
            }
        }

        // 记录操作日志
        await logOperation(employeeId, 'create', 'leave_applications', applicationId, req.body, req);

        await connection.commit();
        connection.release();

        res.json({
            success: true,
            message: '请假申请提交成功',
            applicationId,
            data: {
                id: applicationId,
                employeeId,
                leaveType,
                startDate,
                endDate,
                days,
                status: 'pending'
            }
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('提交请假申请失败:', error);
        res.status(500).json({
            success: false,
            message: '提交申请失败，请重试'
        });
    }
});

// 3. 获取请假记录
app.get('/api/leave/records', async (req, res) => {
    try {
        const { employeeId, status, limit = 50, offset = 0 } = req.query;

        let whereClause = '1=1';
        let params = [];

        if (employeeId) {
            whereClause += ' AND employee_id = ?';
            params.push(employeeId);
        }

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        const [records] = await pool.execute(`
            SELECT * FROM v_leave_application_details 
            WHERE ${whereClause}
            ORDER BY application_time DESC 
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        // 获取总数
        const [countResult] = await pool.execute(`
            SELECT COUNT(*) as total FROM leave_applications 
            WHERE ${whereClause}
        `, params);

        res.json({
            success: true,
            records,
            pagination: {
                total: countResult[0].total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: countResult[0].total > parseInt(offset) + parseInt(limit)
            }
        });
    } catch (error) {
        console.error('获取请假记录失败:', error);
        res.status(500).json({
            success: false,
            message: '获取记录失败，请重试'
        });
    }
});

// 4. 获取所有员工信息（管理员）
app.get('/api/admin/employees', async (req, res) => {
    try {
        const [employees] = await pool.execute(`
            SELECT * FROM v_employee_details 
            WHERE status = 'active'
            ORDER BY department_name, name
        `);

        res.json({
            success: true,
            employees: employees.map(emp => ({
                basic: {
                    id: emp.id,
                    name: emp.name,
                    department: emp.department_name,
                    position: emp.position,
                    supervisor: emp.supervisor,
                    workType: emp.work_type
                },
                employment: {
                    hireDate: emp.hire_date,
                    workYears: emp.work_years
                },
                leave: {
                    remainingAnnualLeave: emp.remaining_annual_leave,
                    usedSickLeave: emp.sick_leave_used,
                    usedPersonalLeave: emp.personal_leave_used
                }
            }))
        });
    } catch (error) {
        console.error('获取员工信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取员工信息失败'
        });
    }
});

// 5. 获取统计数据
app.get('/api/admin/stats', async (req, res) => {
    try {
        // 总员工数
        const [totalEmployees] = await pool.execute(
            'SELECT COUNT(*) as count FROM employees WHERE status = "active"'
        );

        // 今日请假人数
        const [todayLeaves] = await pool.execute(`
            SELECT COUNT(*) as count FROM leave_applications 
            WHERE CURDATE() BETWEEN start_date AND end_date AND status = 'approved'
        `);

        // 待审批数量
        const [pendingApprovals] = await pool.execute(
            'SELECT COUNT(*) as count FROM leave_applications WHERE status = "pending"'
        );

        // 本月请假统计
        const [monthlyStats] = await pool.execute(`
            SELECT 
                leave_type,
                COUNT(*) as count,
                SUM(days) as total_days
            FROM leave_applications 
            WHERE YEAR(start_date) = YEAR(CURDATE()) 
                AND MONTH(start_date) = MONTH(CURDATE())
                AND status = 'approved'
            GROUP BY leave_type
        `);

        res.json({
            success: true,
            stats: {
                totalEmployees: totalEmployees[0].count,
                todayLeaves: todayLeaves[0].count,
                pendingApprovals: pendingApprovals[0].count,
                monthlyStats
            }
        });
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计数据失败'
        });
    }
});

// 6. 审批请假申请
app.post('/api/admin/approve/:applicationId', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
        const { applicationId } = req.params;
        const { action, comment, approverId } = req.body; // action: 'approve' | 'reject'

        if (!['approve', 'reject'].includes(action)) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                success: false,
                message: '无效的审批操作'
            });
        }

        // 检查申请是否存在
        const [applications] = await connection.execute(
            'SELECT * FROM leave_applications WHERE id = ?',
            [applicationId]
        );

        if (applications.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({
                success: false,
                message: '请假申请不存在'
            });
        }

        const application = applications[0];

        if (application.status !== 'pending') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                success: false,
                message: '该申请已被处理'
            });
        }

        // 更新申请状态
        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        await connection.execute(`
            UPDATE leave_applications 
            SET status = ?, approved_at = NOW(), rejected_reason = ?
            WHERE id = ?
        `, [newStatus, action === 'reject' ? comment : null, applicationId]);

        // 记录操作日志
        await logOperation(approverId || 'admin', action, 'leave_applications', applicationId, { action, comment }, req);

        await connection.commit();
        connection.release();

        res.json({
            success: true,
            message: `请假申请已${action === 'approve' ? '批准' : '拒绝'}`,
            data: {
                applicationId,
                status: newStatus,
                processedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('审批请假申请失败:', error);
        res.status(500).json({
            success: false,
            message: '审批操作失败'
        });
    }
});

// 7. 获取系统配置
app.get('/api/admin/config', async (req, res) => {
    try {
        const [configs] = await pool.execute('SELECT * FROM system_configs');
        
        const configObj = {};
        configs.forEach(config => {
            configObj[config.config_key] = config.config_value;
        });

        res.json({
            success: true,
            config: configObj
        });
    } catch (error) {
        console.error('获取系统配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取系统配置失败'
        });
    }
});

// ========================================
// 错误处理和启动
// ========================================

// 处理未找到的路由
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API端点不存在',
        code: 'NOT_FOUND'
    });
});

// 全局错误处理
app.use(errorHandler);

// 优雅关闭
process.on('SIGTERM', async () => {
    console.log('收到SIGTERM信号，正在关闭服务器...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('收到SIGINT信号，正在关闭服务器...');
    await pool.end();
    process.exit(0);
});

// 启动服务器
async function startServer() {
    // 测试数据库连接
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
        console.error('❌ 无法启动服务器：数据库连接失败');
        process.exit(1);
    }

    app.listen(PORT, HOST, () => {
        console.log('🚀 员工请假管理系统后端API启动成功!');
        console.log(`📍 服务地址: http://${HOST}:${PORT}`);
        console.log(`📍 前端连接地址: http://${HOST}:${PORT}/api`);
        console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
        console.log(`⚡ API健康检查: http://${HOST}:${PORT}/api/health`);
        console.log('');
        console.log('📋 可用的API端点:');
        console.log('   POST /api/auth/verify        - 员工身份验证');
        console.log('   POST /api/leave/apply        - 提交请假申请');
        console.log('   GET  /api/leave/records      - 获取请假记录');
        console.log('   GET  /api/admin/employees    - 获取员工信息');
        console.log('   GET  /api/admin/stats        - 获取统计数据');
        console.log('   POST /api/admin/approve/:id  - 审批请假申请');
        console.log('   GET  /api/admin/config       - 获取系统配置');
        console.log('');
        console.log('🔗 确保前端配置连接到: http://localhost:3000/api');
        console.log('💡 使用 Ctrl+C 停止服务器');
    });
}

// 启动应用
startServer().catch(error => {
    console.error('❌ 启动服务器失败:', error);
    process.exit(1);
});

module.exports = app; 