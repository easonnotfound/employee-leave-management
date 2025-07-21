/**
 * 员工数据管理模块
 * 处理员工基础信息、身份验证和假期数据计算
 */

// 员工基础数据 - 来自employee_data.xlsx
const EMPLOYEE_DATA = [
    {
        id: 'TEC20220',
        name: '张伟',
        department: '技术部',
        position: '高级工程师',
        hireDate: '2022-03-01',
        workType: '弹性工作制',
        supervisor: '李技术总监',
        annualLeave: 8,
        usedSickLeave: 2,
        usedPersonalLeave: 1,
        phone: '13800138001',
        emergencyContact: '张太太',
        emergencyPhone: '13800138002'
    },
    {
        id: 'TEC20230',
        name: '王强',
        department: '技术部',
        position: '中级工程师',
        hireDate: '2023-01-01',
        workType: '弹性工作制',
        supervisor: '李技术总监',
        annualLeave: 5,
        usedSickLeave: 0,
        usedPersonalLeave: 0,
        phone: '13800138003',
        emergencyContact: '王妈妈',
        emergencyPhone: '13800138004'
    },
    {
        id: 'SAL20210',
        name: '李娜',
        department: '销售部',
        position: '销售经理',
        hireDate: '2021-06-01',
        workType: '标准工作制',
        supervisor: '陈销售总监',
        annualLeave: 12,
        usedSickLeave: 3,
        usedPersonalLeave: 2,
        phone: '13800138005',
        emergencyContact: '李先生',
        emergencyPhone: '13800138006'
    },
    {
        id: 'PRD20220',
        name: '赵敏',
        department: '产品部',
        position: '产品经理',
        hireDate: '2022-09-01',
        workType: '弹性工作制',
        supervisor: '刘产品总监',
        annualLeave: 10,
        usedSickLeave: 1,
        usedPersonalLeave: 1,
        phone: '13800138007',
        emergencyContact: '赵先生',
        emergencyPhone: '13800138008'
    },
    {
        id: 'MKT20230',
        name: '孙丽',
        department: '市场部',
        position: '市场专员',
        hireDate: '2023-08-01',
        workType: '标准工作制',
        supervisor: '周市场总监',
        annualLeave: 3,
        usedSickLeave: 0,
        usedPersonalLeave: 1,
        phone: '13800138009',
        emergencyContact: '孙爸爸',
        emergencyPhone: '13800138010'
    },
    {
        id: 'OPS20200',
        name: '吴军',
        department: '运营部',
        position: '客服主管',
        hireDate: '2020-05-01',
        workType: '标准工作制',
        supervisor: '马运营经理',
        annualLeave: 15,
        usedSickLeave: 4,
        usedPersonalLeave: 2,
        phone: '13800138011',
        emergencyContact: '吴太太',
        emergencyPhone: '13800138012'
    },
    {
        id: 'HR202100',
        name: '郑红',
        department: '人事部',
        position: 'HR专员',
        hireDate: '2021-02-01',
        workType: '标准工作制',
        supervisor: '林HR经理',
        annualLeave: 10,
        usedSickLeave: 2,
        usedPersonalLeave: 1,
        phone: '13800138013',
        emergencyContact: '郑妈妈',
        emergencyPhone: '13800138014'
    },
    {
        id: 'FIN20200',
        name: '钱进',
        department: '财务部',
        position: '会计',
        hireDate: '2020-09-01',
        workType: '标准工作制',
        supervisor: '钱财务经理',
        annualLeave: 12,
        usedSickLeave: 5,
        usedPersonalLeave: 3,
        phone: '13800138015',
        emergencyContact: '钱太太',
        emergencyPhone: '13800138016'
    }
];

/**
 * 员工数据管理类
 */
class EmployeeDataManager {
    constructor() {
        this.employees = EMPLOYEE_DATA;
        this.currentEmployee = null;
    }

    /**
     * 通过姓名查找员工
     * @param {string} name - 员工姓名
     * @returns {Object|null} 员工信息对象或null
     */
    findEmployeeByName(name) {
        return this.employees.find(employee => 
            employee.name === name.trim()
        ) || null;
    }

    /**
     * 通过工号查找员工
     * @param {string} id - 员工工号
     * @returns {Object|null} 员工信息对象或null
     */
    findEmployeeById(id) {
        return this.employees.find(employee => 
            employee.id === id.trim().toUpperCase()
        ) || null;
    }

    /**
     * 验证员工身份
     * @param {string} identifier - 姓名或工号
     * @returns {Object} 验证结果
     */
    authenticateEmployee(identifier) {
        const trimmedIdentifier = identifier.trim();
        
        // 首先尝试按姓名查找
        let employee = this.findEmployeeByName(trimmedIdentifier);
        
        if (employee) {
            this.currentEmployee = employee;
            return {
                success: true,
                method: 'name',
                employee: employee,
                message: `欢迎 ${employee.name}，验证成功！`
            };
        }

        // 如果姓名查找失败，尝试工号查找
        employee = this.findEmployeeById(trimmedIdentifier);
        
        if (employee) {
            this.currentEmployee = employee;
            return {
                success: true,
                method: 'id',
                employee: employee,
                message: `工号验证成功，欢迎 ${employee.name}！`
            };
        }

        // 验证失败
        return {
            success: false,
            method: null,
            employee: null,
            message: '未找到员工信息，请检查姓名或工号是否正确'
        };
    }

    /**
     * 获取当前认证的员工信息
     * @returns {Object|null} 当前员工信息
     */
    getCurrentEmployee() {
        return this.currentEmployee;
    }

    /**
     * 计算员工工作年限
     * @param {string} hireDate - 入职日期 (YYYY-MM-DD)
     * @returns {number} 工作年限
     */
    calculateWorkYears(hireDate) {
        const hire = new Date(hireDate);
        const now = new Date();
        const diffTime = now - hire;
        const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
        return Math.floor(diffYears);
    }

    /**
     * 计算员工应享年假天数（基于工作年限）
     * @param {Object} employee - 员工对象
     * @returns {number} 应享年假天数
     */
    calculateEntitledAnnualLeave(employee) {
        const workYears = this.calculateWorkYears(employee.hireDate);
        
        if (workYears < 1) return 0;
        if (workYears < 3) return 5;
        if (workYears < 5) return 10;
        return 15;
    }

    /**
     * 计算员工剩余年假天数
     * @param {Object} employee - 员工对象
     * @returns {number} 剩余年假天数
     */
    calculateRemainingAnnualLeave(employee) {
        const entitled = this.calculateEntitledAnnualLeave(employee);
        // 注意：这里使用员工数据中的annualLeave作为已使用的年假
        // 实际应该是 entitled - used，但根据现有数据结构，annualLeave表示剩余
        return Math.max(0, employee.annualLeave);
    }

    /**
     * 获取员工完整信息摘要
     * @param {Object} employee - 员工对象
     * @returns {Object} 员工信息摘要
     */
    getEmployeeSummary(employee) {
        if (!employee) return null;

        const workYears = this.calculateWorkYears(employee.hireDate);
        const entitledLeave = this.calculateEntitledAnnualLeave(employee);
        const remainingLeave = this.calculateRemainingAnnualLeave(employee);

        return {
            basic: {
                name: employee.name,
                id: employee.id,
                department: employee.department,
                position: employee.position,
                supervisor: employee.supervisor,
                workType: employee.workType
            },
            employment: {
                hireDate: employee.hireDate,
                workYears: workYears,
                workYearsText: `${workYears}年${Math.floor((new Date() - new Date(employee.hireDate)) / (1000 * 60 * 60 * 24) % 365.25 / 30)}个月`
            },
            leave: {
                entitledAnnualLeave: entitledLeave,
                remainingAnnualLeave: remainingLeave,
                usedSickLeave: employee.usedSickLeave,
                usedPersonalLeave: employee.usedPersonalLeave,
                availableSickLeave: Math.max(0, 30 - employee.usedSickLeave), // 年度病假限额30天
                availablePersonalLeave: Math.max(0, 10 - employee.usedPersonalLeave) // 年度事假限额10天
            },
            contact: {
                phone: employee.phone,
                emergencyContact: employee.emergencyContact,
                emergencyPhone: employee.emergencyPhone
            }
        };
    }

    /**
     * 获取所有员工基础信息（用于管理员后台）
     * @returns {Array} 所有员工信息数组
     */
    getAllEmployees() {
        return this.employees.map(employee => this.getEmployeeSummary(employee));
    }

    /**
     * 根据部门获取员工列表
     * @param {string} department - 部门名称
     * @returns {Array} 该部门的员工列表
     */
    getEmployeesByDepartment(department) {
        return this.employees
            .filter(employee => employee.department === department)
            .map(employee => this.getEmployeeSummary(employee));
    }

    /**
     * 获取部门列表
     * @returns {Array} 唯一的部门名称数组
     */
    getDepartments() {
        return [...new Set(this.employees.map(employee => employee.department))];
    }

    /**
     * 验证员工是否有足够的假期余额
     * @param {Object} employee - 员工对象
     * @param {string} leaveType - 请假类型
     * @param {number} days - 请假天数
     * @returns {Object} 验证结果
     */
    validateLeaveBalance(employee, leaveType, days) {
        const summary = this.getEmployeeSummary(employee);
        
        switch (leaveType) {
            case '年假':
                const remaining = summary.leave.remainingAnnualLeave;
                return {
                    valid: remaining >= days,
                    remaining: remaining,
                    message: remaining >= days 
                        ? `年假余额充足，剩余${remaining}天` 
                        : `年假余额不足，仅剩${remaining}天，申请${days}天`
                };
                
            case '病假':
                const availableSick = summary.leave.availableSickLeave;
                return {
                    valid: availableSick >= days,
                    remaining: availableSick,
                    message: availableSick >= days 
                        ? `病假额度充足，剩余${availableSick}天` 
                        : `病假额度不足，仅剩${availableSick}天，申请${days}天`
                };
                
            case '事假':
                const availablePersonal = summary.leave.availablePersonalLeave;
                return {
                    valid: availablePersonal >= days,
                    remaining: availablePersonal,
                    message: availablePersonal >= days 
                        ? `事假额度充足，剩余${availablePersonal}天` 
                        : `事假额度不足，仅剩${availablePersonal}天，申请${days}天`
                };
                
            case '婚假':
            case '产假':
            case '陪产假':
            case '丧假':
            case '调休假':
                // 特殊假期不受年度限制
                return {
                    valid: true,
                    remaining: '不限',
                    message: `${leaveType}不受年度额度限制`
                };
                
            default:
                return {
                    valid: false,
                    remaining: 0,
                    message: '未知的请假类型'
                };
        }
    }

    /**
     * 重置当前员工状态
     */
    resetCurrentEmployee() {
        this.currentEmployee = null;
    }
}

// 创建全局员工数据管理器实例
window.employeeManager = new EmployeeDataManager();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EmployeeDataManager, EMPLOYEE_DATA };
} 