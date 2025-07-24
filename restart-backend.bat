#!/bin/bash
echo "🔄 强制重启后端服务器..."

# 查找并终止占用3000端口的进程
echo "查找占用3000端口的进程..."
netstat -ano | findstr :3000

echo ""
echo "终止Node.js进程..."
taskkill /F /IM node.exe /T 2>nul

echo ""
echo "等待3秒..."
timeout /t 3 /nobreak >nul

echo ""
echo "启动新的后端服务器..."
cd /d "D:\cursor\员工请假\backend"
npm run dev