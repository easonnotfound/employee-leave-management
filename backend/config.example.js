/**
 * 配置示例文件
 * 使用方法：
 * 1. 复制此文件为 config.js
 * 2. 修改数据库密码等敏感信息
 * 3. 在 server.js 中引入使用
 */

module.exports = {
    // 数据库配置
    database: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'your_mysql_password_here', // 请修改为实际密码
        database: 'employee_leave_system',
        charset: 'utf8mb4',
        timezone: '+08:00'
    },
    
    // 服务器配置
    server: {
        port: 3000,
        host: 'localhost',
        env: 'development'
    },
    
    // AI配置
    ai: {
        apiKey: 'sk-VXX8gTqtw2nQ0kzYq7VG4h1f9IBaB6kJd0xfUoPK9P83IsON',
        baseURL: 'https://yunwu.ai/v1',
        model: 'claude-sonnet-4-20250514'
    },
    
    // 安全配置
    security: {
        rateLimitWindowMs: 15 * 60 * 1000, // 15分钟
        rateLimitMaxRequests: 100,
        corsOrigin: '*'
    }
}; 