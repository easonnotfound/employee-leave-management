/**
 * 员工数据管理模块 - 重构为API调用版本
 * 连接后端MySQL数据库，实现实时数据同步
 * 版本：v2.0 - 数据库集成版本
 */

// API配置
const API_CONFIG = {
    baseURL: 'http://localhost:3000/api',
    timeout: 10000,
    retryCount: 3
};

/**
 * API请求工具类
 */
class APIClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    /**
     * 发送API请求
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            console.log(`🌐 API请求: ${config.method} ${url}`);
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ API响应成功:`, data);
            return data;
        } catch (error) {
            console.error(`❌ API请求失败 ${config.method} ${url}:`, error.message);
            
            // 检查是否是网络连接问题
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error(`无法连接到后端服务器 (${this.baseURL})，请确保后端服务已启动:\n1. 运行: cd backend && npm run dev\n2. 检查: http://localhost:3000/api/health`);
            }
            
            throw error;
        }
    }

    /**
     * GET请求
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url);
    }

    /**
     * POST请求
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: data
        });
    }

    /**
     * PUT请求
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data
        });
    }

    /**
     * DELETE请求
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
}

/**
 * 员工数据管理类 - API版本
 */
class EmployeeDataManager {
    constructor() {
        this.apiClient = new APIClient(API_CONFIG.baseURL);
        this.currentEmployee = null;
        this.employeeCache = new Map(); // 员工数据缓存
        this.cacheExpiry = 5 * 60 * 1000; // 缓存5分钟
    }

    /**
     * 检查后端服务器状态
     */
    async checkServerStatus() {
        try {
            const response = await this.apiClient.get('/health');
            return {
                available: true,
                message: response.message,
                version: response.version
            };
        } catch (error) {
            return {
                available: false,
                message: error.message
            };
        }
    }

    /**
     * 验证员工身份 - 调用后端API
     */
    async authenticateEmployee(identifier) {
        try {
            // 先检查服务器状态
            const serverStatus = await this.checkServerStatus();
            if (!serverStatus.available) {
                return {
                    success: false,
                    message: `后端服务不可用: ${serverStatus.message}`,
                    suggestion: '请检查后端服务器是否启动 (运行: cd backend && npm run dev)'
                };
            }

            console.log(`🔍 验证员工身份: ${identifier}`);
            const response = await this.apiClient.post('/auth/verify', { identifier });
            
            if (response.success) {
                this.currentEmployee = response.employee;
                console.log('✅ 员工验证成功:', this.currentEmployee);
                
                // 缓存员工信息
                this.employeeCache.set(response.employee.basic.id, {
                    data: response.employee,
                    timestamp: Date.now()
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ 员工身份验证失败:', error);
            return {
                success: false,
                message: `验证失败: ${error.message}`,
                suggestion: '请检查网络连接和后端服务状态'
            };
        }
    }

    /**
     * 提交请假申请到数据库
     */
    async submitLeaveApplication(leaveData) {
        try {
            console.log('📝 提交请假申请:', leaveData);
            const response = await this.apiClient.post('/leave/apply', leaveData);
            
            if (response.success) {
                console.log('✅ 请假申请提交成功:', response.applicationId);
            }
            
            return response;
        } catch (error) {
            console.error('❌ 提交请假申请失败:', error);
            return {
                success: false,
                message: `提交失败: ${error.message}`
            };
        }
    }

    /**
     * 获取请假记录
     */
    async getLeaveRecords(filters = {}) {
        try {
            console.log('📋 获取请假记录:', filters);
            const response = await this.apiClient.get('/leave/records', filters);
            
            if (response.success) {
                console.log(`✅ 获取到 ${response.records.length} 条请假记录`);
            }
            
            return response;
        } catch (error) {
            console.error('❌ 获取请假记录失败:', error);
            return {
                success: false,
                message: `获取失败: ${error.message}`,
                records: []
            };
        }
    }

    /**
     * 获取所有员工信息（管理员）
     */
    async getAllEmployees() {
        try {
            console.log('👥 获取所有员工信息');
            const response = await this.apiClient.get('/admin/employees');
            
            if (response.success) {
                console.log(`✅ 获取到 ${response.employees.length} 个员工信息`);
                
                // 缓存所有员工信息
                response.employees.forEach(emp => {
                    this.employeeCache.set(emp.basic.id, {
                        data: emp,
                        timestamp: Date.now()
                    });
                });
                
                return response.employees;
            }
            
            return [];
        } catch (error) {
            console.error('❌ 获取员工信息失败:', error);
            return [];
        }
    }

    /**
     * 获取统计数据
     */
    async getAdminStats() {
        try {
            console.log('📊 获取统计数据');
            const response = await this.apiClient.get('/admin/stats');
            
            if (response.success) {
                console.log('✅ 统计数据获取成功:', response.stats);
                return response.stats;
            }
            
            return null;
        } catch (error) {
            console.error('❌ 获取统计数据失败:', error);
            return null;
        }
    }

    /**
     * 审批请假申请
     */
    async approveLeaveApplication(applicationId, action, comment, approverId) {
        try {
            console.log(`✅ 审批请假申请: ${applicationId} - ${action}`);
            const response = await this.apiClient.post(`/admin/approve/${applicationId}`, {
                action,
                comment,
                approverId
            });
            
            if (response.success) {
                console.log('✅ 审批操作成功');
            }
            
            return response;
        } catch (error) {
            console.error('❌ 审批操作失败:', error);
            return {
                success: false,
                message: `审批失败: ${error.message}`
            };
        }
    }

    /**
     * 获取当前认证的员工信息
     */
    getCurrentEmployee() {
        return this.currentEmployee;
    }

    /**
     * 获取员工摘要（保持兼容性）
     */
    getEmployeeSummary(employee) {
        if (!employee) return null;
        return employee; // 后端已格式化为正确的结构
    }

    /**
     * 从缓存获取员工信息
     */
    getEmployeeFromCache(employeeId) {
        const cached = this.employeeCache.get(employeeId);
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.employeeCache.clear();
        console.log('🗑️ 员工数据缓存已清除');
    }

    /**
     * 验证假期余额（快速前端验证，实际由后端验证）
     */
    validateLeaveBalance(employee, leaveType, days) {
        if (!employee || !employee.leave) {
            return {
                valid: false,
                message: '员工信息不完整'
            };
        }

        const leave = employee.leave;
        
        switch (leaveType) {
            case '年假':
                const remaining = leave.remainingAnnualLeave || 0;
                return {
                    valid: remaining >= days,
                    remaining: remaining,
                    message: remaining >= days 
                        ? `年假余额充足，剩余${remaining}天` 
                        : `年假余额不足，仅剩${remaining}天，申请${days}天`
                };
                
            case '病假':
                const availableSick = leave.availableSickLeave || 30;
                return {
                    valid: availableSick >= days,
                    remaining: availableSick,
                    message: availableSick >= days 
                        ? `病假额度充足，剩余${availableSick}天` 
                        : `病假额度不足，仅剩${availableSick}天，申请${days}天`
                };
                
            case '事假':
                const availablePersonal = leave.availablePersonalLeave || 10;
                return {
                    valid: availablePersonal >= days,
                    remaining: availablePersonal,
                    message: availablePersonal >= days 
                        ? `事假额度充足，剩余${availablePersonal}天` 
                        : `事假额度不足，仅剩${availablePersonal}天，申请${days}天`
                };
                
            default:
                // 特殊假期不受年度限制
                return {
                    valid: true,
                    remaining: '不限',
                    message: `${leaveType}不受年度额度限制，将由后端进行最终验证`
                };
        }
    }

    /**
     * 重置当前员工状态
     */
    resetCurrentEmployee() {
        this.currentEmployee = null;
        console.log('🔄 当前员工状态已重置');
    }

    /**
     * 获取连接状态信息
     */
    async getConnectionInfo() {
        const serverStatus = await this.checkServerStatus();
        return {
            apiBaseURL: API_CONFIG.baseURL,
            serverAvailable: serverStatus.available,
            serverMessage: serverStatus.message,
            cacheSize: this.employeeCache.size,
            currentEmployee: this.currentEmployee?.basic?.name || null
        };
    }
}

// 创建全局员工数据管理器实例
window.employeeManager = new EmployeeDataManager();

// 初始化时检查后端连接状态
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 员工数据管理器初始化...');
    
    const connectionInfo = await window.employeeManager.getConnectionInfo();
    console.log('📡 连接信息:', connectionInfo);
    
    if (!connectionInfo.serverAvailable) {
        console.warn('⚠️ 后端服务器未连接:', connectionInfo.serverMessage);
        console.info('💡 请启动后端服务器: cd backend && npm run dev');
    } else {
        console.log('✅ 后端服务器连接正常');
    }
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EmployeeDataManager, APIClient };
} 