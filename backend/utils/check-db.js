/**
 * 数据库连接检查工具
 * 用于验证数据库配置和连接状态
 */

const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee_leave_system',
    charset: 'utf8mb4'
};

/**
 * 检查数据库连接
 */
async function checkDatabaseConnection() {
    console.log('🔍 检查数据库连接...');
    console.log(`📍 目标: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ 数据库连接成功!');
        
        // 检查表是否存在
        const tables = ['departments', 'employees', 'leave_quotas', 'leave_applications'];
        for (const table of tables) {
            const [rows] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
            if (rows.length > 0) {
                console.log(`✅ 表 ${table} 存在`);
            } else {
                console.log(`❌ 表 ${table} 不存在`);
            }
        }
        
        // 检查员工数据
        const [employees] = await connection.execute('SELECT COUNT(*) as count FROM employees');
        console.log(`👥 员工数据: ${employees[0].count} 条记录`);
        
        // 检查视图
        const [views] = await connection.execute("SHOW TABLES WHERE Table_type = 'VIEW'");
        console.log(`👁️ 视图数量: ${views.length}`);
        
        await connection.end();
        
        console.log('\n🎉 数据库检查完成，一切正常！');
        return true;
        
    } catch (error) {
        console.error('❌ 数据库连接失败:');
        console.error(`错误: ${error.message}`);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('💡 解决方案: 请检查用户名和密码');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('💡 解决方案: 请确保MySQL服务已启动');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('💡 解决方案: 数据库不存在，请先运行初始化脚本');
            console.error('   运行: mysql -u root -p < database/init.sql');
        }
        
        return false;
    }
}

/**
 * 检查所需的环境变量
 */
function checkEnvironmentVariables() {
    console.log('🔍 检查环境变量...');
    
    const requiredVars = [
        'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'
    ];
    
    const missing = [];
    
    for (const varName of requiredVars) {
        const value = process.env[varName];
        if (!value) {
            missing.push(varName);
        } else {
            console.log(`✅ ${varName}: ${varName === 'DB_PASSWORD' ? '***' : value}`);
        }
    }
    
    if (missing.length > 0) {
        console.log(`❌ 缺少环境变量: ${missing.join(', ')}`);
        console.log('💡 请创建 .env 文件并设置这些变量');
        return false;
    }
    
    console.log('✅ 环境变量检查通过');
    return true;
}

// 主执行函数
async function main() {
    console.log('🚀 员工请假系统 - 数据库连接检查工具\n');
    
    // 检查环境变量
    const envOk = checkEnvironmentVariables();
    console.log('');
    
    if (!envOk) {
        console.log('⚠️ 环境变量配置不完整，但仍尝试连接数据库...\n');
    }
    
    // 检查数据库连接
    const dbOk = await checkDatabaseConnection();
    
    console.log('\n' + '='.repeat(50));
    if (dbOk) {
        console.log('🎉 系统准备就绪，可以启动后端服务！');
        console.log('💡 运行: npm run dev');
        process.exit(0);
    } else {
        console.log('❌ 系统尚未准备就绪，请解决上述问题');
        console.log('💡 需要帮助？请查看 README.md');
        process.exit(1);
    }
}

// 如果直接运行此文件
if (require.main === module) {
    // 加载环境变量
    require('dotenv').config();
    main().catch(console.error);
}

module.exports = { checkDatabaseConnection, checkEnvironmentVariables }; 