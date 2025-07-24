@echo off
chcp 65001
echo 🚀 员工请假管理系统启动脚本
echo ===================================
echo.

:: 检查Node.js是否安装
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装 Node.js 16+ 版本
    echo 💡 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查MySQL是否运行
echo 🔍 检查MySQL服务状态...
sc query MySQL80 >nul 2>&1
if not errorlevel 1 (
    echo ✅ MySQL80服务运行正常
    goto mysql_ok
)

sc query MySQL >nul 2>&1
if not errorlevel 1 (
    echo ✅ MySQL服务运行正常
    goto mysql_ok
)

sc query mysql >nul 2>&1
if not errorlevel 1 (
    echo ✅ mysql服务运行正常
    goto mysql_ok
)

echo ⚠️ MySQL服务未启动，正在尝试启动...
net start MySQL80 >nul 2>&1
if not errorlevel 1 (
    echo ✅ MySQL80服务启动成功
    goto mysql_ok
)

net start MySQL >nul 2>&1
if not errorlevel 1 (
    echo ✅ MySQL服务启动成功
    goto mysql_ok
)

net start mysql >nul 2>&1
if not errorlevel 1 (
    echo ✅ mysql服务启动成功
    goto mysql_ok
)

echo ❌ 无法启动MySQL服务，请手动启动
echo 💡 或在服务管理器中启动MySQL服务
echo 💡 常见服务名：MySQL80、MySQL、mysql
pause
exit /b 1

:mysql_ok

:: 进入后端目录
cd /d "%~dp0backend"

:: 检查是否已安装依赖
if not exist "node_modules" (
    echo 📦 首次运行，正在安装后端依赖...
    npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
)

:: 检查数据库连接
echo 🔍 检查数据库连接...
node utils/check-db.js
if errorlevel 1 (
    echo ❌ 数据库连接失败
    echo 💡 请先运行数据库初始化脚本：
    echo    mysql -u root -p ^< database/schema.sql
    pause
    exit /b 1
)

:: 启动后端服务
echo 🚀 启动后端服务...
echo 📍 后端地址: http://localhost:3000
echo 📍 前端地址: 直接打开 index.html 或运行 python -m http.server 8080
echo.
echo 💡 按 Ctrl+C 停止服务
echo ===================================
npm run dev 