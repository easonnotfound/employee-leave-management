@echo off
echo 测试MySQL安装...
echo.

echo 1. 检查MySQL服务状态
sc query MySQL80
if errorlevel 1 (
    echo MySQL服务未找到，尝试启动...
    net start MySQL80
)

echo.
echo 2. 测试MySQL命令行工具
mysql --version
if errorlevel 1 (
    echo MySQL命令行工具未安装或未添加到PATH
    echo 请检查安装是否完成
) else (
    echo MySQL安装成功！
)

echo.
echo 3. 如果上面显示成功，请按任意键继续部署数据库
pause 