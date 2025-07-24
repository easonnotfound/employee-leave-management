@echo off
echo 测试MySQL安装...
echo.

echo 1. 检查MySQL服务状态
sc query MySQL80 >nul 2>&1
if not errorlevel 1 (
    echo ✅ MySQL80服务运行正常
    goto service_ok
)

sc query MySQL >nul 2>&1
if not errorlevel 1 (
    echo ✅ MySQL服务运行正常
    goto service_ok
)

sc query mysql >nul 2>&1
if not errorlevel 1 (
    echo ✅ mysql服务运行正常
    goto service_ok
)

echo ⚠️ MySQL服务未找到，尝试启动...
net start MySQL80 >nul 2>&1
if not errorlevel 1 (
    echo ✅ MySQL80服务启动成功
    goto service_ok
)

echo ❌ MySQL服务未找到或启动失败
echo 💡 请检查MySQL是否正确安装
goto test_command

:service_ok
echo ✅ MySQL服务运行正常

:test_command
echo.
echo 2. 测试MySQL命令行工具
mysql --version
if errorlevel 1 (
    echo ❌ MySQL命令行工具未安装或未添加到PATH
    echo 💡 请检查安装是否完成
) else (
    echo ✅ MySQL安装成功！
)

echo.
echo 3. 如果上面显示成功，请按任意键继续部署数据库
pause 