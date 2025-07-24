# 员工请假管理系统 - 安装部署指南

## 📋 系统要求

### 必须组件
- **MySQL 8.0+** - 数据库服务器
- **Node.js 16+** - 后端运行环境
- **现代浏览器** - Chrome、Firefox、Safari、Edge

### 推荐配置
- **RAM**: 4GB 以上
- **存储**: 500MB 可用空间
- **网络**: 互联网连接（AI功能需要）

## 🚀 快速安装（Windows）

### 方法一：一键启动脚本（推荐）

1. **准备MySQL数据库**
   ```bash
   # 确保MySQL服务已启动
   net start mysql
   
   # 登录MySQL创建数据库
   mysql -u root -p
   ```

2. **初始化数据库**
   ```sql
   # 在MySQL命令行中执行完整的数据库初始化
   source database/schema.sql;
   # 或退出MySQL后执行
   mysql -u root -p < database/schema.sql
   ```
   
   **重要提示：请使用 database/schema.sql 进行完整的数据库初始化，它包含：**
   - 完整的表结构和约束
   - 必要的视图和存储过程
   - 触发器和索引优化
   - 测试数据和配置信息

3. **运行启动脚本**
   ```bash
   # 双击运行 start.bat 文件
   # 或在命令行中执行
   start.bat
   ```

4. **访问系统**
   - 后端服务: http://localhost:3000
   - 前端系统: 直接打开 `index.html` 文件

### 方法二：手动安装

#### 步骤1：安装MySQL
```bash
# Windows: 下载并安装MySQL 8.0+
# 下载地址: https://dev.mysql.com/downloads/installer/

# 设置root密码并记住
# 启动MySQL服务
net start mysql
```

#### 步骤2：创建数据库
```bash
# 登录MySQL
mysql -u root -p

# 创建数据库和表结构
mysql> source database/init.sql;
# 或
mysql> \. database/init.sql

# 验证安装
mysql> USE employee_leave_system;
mysql> SELECT COUNT(*) FROM employees;
# 应该返回8条记录
```

#### 步骤3：安装Node.js依赖
```bash
# 进入后端目录
cd backend

# 安装依赖包
npm install

# 检查数据库连接
npm run check-db
```

#### 步骤4：配置环境变量（可选）
```bash
# 复制配置模板
copy backend\.env.template backend\.env

# 编辑 backend\.env 文件，修改数据库密码
# DB_PASSWORD=你的MySQL密码
```

#### 步骤5：启动后端服务
```bash
cd backend
npm run dev
```

#### 步骤6：启动前端服务
```bash
# 方法1: 直接打开文件
双击 index.html

# 方法2: 本地Web服务器（推荐）
python -m http.server 8080
# 然后访问 http://localhost:8080
```

## 🐧 Linux/macOS 安装

### 安装MySQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql

# macOS
brew install mysql
brew services start mysql

# CentOS/RHEL
sudo yum install mysql-server
sudo systemctl start mysqld
```

### 安装Node.js
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node

# CentOS/RHEL
sudo yum install nodejs npm
```

### 部署步骤
```bash
# 1. 初始化数据库
mysql -u root -p < database/init.sql

# 2. 安装后端依赖
cd backend
npm install

# 3. 检查数据库连接
npm run check-db

# 4. 启动后端服务
npm run dev

# 5. 启动前端（新终端）
cd ..
python3 -m http.server 8080
```

## 🔧 配置说明

### 数据库配置
默认配置文件: `backend/server.js`
```javascript
const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '', // ⚠️ 请填写你的MySQL密码
    database: 'employee_leave_system'
};
```

### 端口配置
- **后端端口**: 3000 （可在 `backend/server.js` 中修改）
- **前端端口**: 8080 （使用Web服务器时）
- **API地址**: http://localhost:3000/api

### AI API配置
系统已配置云雾AI，无需额外设置。如需更换：
```javascript
// 在 js/employee-data.js 中修改
const API_CONFIG = {
    baseURL: 'http://localhost:3000/api' // 后端API地址
};
```

## ✅ 验证安装

### 1. 检查数据库
```bash
# 进入MySQL
mysql -u root -p

# 检查数据库和表
USE employee_leave_system;
SHOW TABLES;
SELECT COUNT(*) FROM employees;
```

### 2. 检查后端服务
```bash
# 访问健康检查接口
curl http://localhost:3000/api/health

# 应该返回成功响应
{
  "success": true,
  "message": "员工请假管理系统API运行正常",
  "version": "1.0.0"
}
```

### 3. 检查前端功能
1. 打开前端页面
2. 输入测试员工: `张伟` 或 `TEC20220`
3. 验证是否能成功登录并看到员工信息

## 🎯 测试数据

系统预置了以下测试员工数据：

| 姓名 | 工号 | 部门 | 职位 |
|------|------|------|------|
| 张伟 | TEC20220 | 技术部 | 高级工程师 |
| 王强 | TEC20230 | 技术部 | 中级工程师 |
| 李娜 | SAL20210 | 销售部 | 销售经理 |
| 赵敏 | PRD20220 | 产品部 | 产品经理 |
| 孙丽 | MKT20230 | 市场部 | 市场专员 |
| 吴军 | OPS20200 | 运营部 | 客服主管 |
| 郑红 | HR202100 | 人事部 | HR专员 |
| 钱进 | FIN20200 | 财务部 | 会计 |

## 🛠️ 故障排除

### 常见问题

#### 1. 数据库连接失败
```
Error: ER_ACCESS_DENIED_ERROR
```
**解决方案**: 检查MySQL用户名和密码是否正确

#### 2. 数据库不存在
```
Error: ER_BAD_DB_ERROR
```
**解决方案**: 运行数据库初始化脚本
```bash
mysql -u root -p < database/init.sql
```

#### 3. 端口被占用
```
Error: EADDRINUSE :::3000
```
**解决方案**: 
- 关闭占用端口的程序
- 或修改 `backend/server.js` 中的端口号

#### 4. 前端无法连接后端
**检查项目**:
1. 后端服务是否启动 (http://localhost:3000/api/health)
2. 防火墙是否阻止了3000端口
3. 前端API配置是否正确

#### 5. MySQL服务未启动
```bash
# Windows
net start mysql

# Linux
sudo systemctl start mysql

# macOS
brew services start mysql
```

### 获取帮助

如果遇到问题：
1. 查看后端控制台日志
2. 检查浏览器开发者工具的Console和Network选项卡
3. 运行数据库检查工具: `cd backend && npm run check-db`

## 📊 性能优化

### 生产环境建议
1. **数据库优化**: 配置MySQL连接池
2. **静态文件**: 使用Nginx提供静态文件服务
3. **HTTPS**: 配置SSL证书
4. **监控**: 添加日志和监控系统

### 扩展功能
- 添加用户权限管理
- 集成企业微信/钉钉
- 添加邮件通知功能
- 实现移动端适配

---

🎉 **安装完成！** 现在您可以开始使用员工请假管理系统了。 