/**
 * 请假规则引擎
 * 实现公司请假制度的所有规则判断和审批流程
 */

/**
 * 请假类型配置
 */
const LEAVE_TYPES = {
    '年假': {
        id: 'annual',
        name: '年假',
        maxDays: null, // 根据工作年限计算
        requireAdvanceNotice: 3,
        requireDocument: false,
        paymentRate: 1.0,
        description: '根据工作年限享受的带薪年假'
    },
    '病假': {
        id: 'sick',
        name: '病假',
        maxDays: 30,
        requireAdvanceNotice: 0,
        requireDocument: true,
        paymentRate: 1.0, // 前5天全薪，之后80%
        description: '因病需要休息的假期，需提供医疗证明'
    },
    '事假': {
        id: 'personal',
        name: '事假',
        maxDays: 10,
        requireAdvanceNotice: 1,
        requireDocument: false,
        paymentRate: 0.0,
        description: '因个人事务需要请假，无薪假期'
    },
    '婚假': {
        id: 'marriage',
        name: '婚假',
        maxDays: 5, // 法定3天 + 公司福利2天
        requireAdvanceNotice: 5,
        requireDocument: true,
        paymentRate: 1.0,
        description: '结婚专属假期，需提供结婚证明'
    },
    '产假': {
        id: 'maternity',
        name: '产假',
        maxDays: 158, // 按国家法定标准
        requireAdvanceNotice: 30,
        requireDocument: true,
        paymentRate: 1.0,
        description: '女性生育假期，按国家法定标准执行'
    },
    '陪产假': {
        id: 'paternity',
        name: '陪产假',
        maxDays: 15,
        requireAdvanceNotice: 5,
        requireDocument: true,
        paymentRate: 1.0,
        description: '男性陪伴配偶生育的假期'
    },
    '丧假': {
        id: 'bereavement',
        name: '丧假',
        maxDays: 3, // 直系亲属3天，其他亲属1天
        requireAdvanceNotice: 0,
        requireDocument: true,
        paymentRate: 1.0,
        description: '因亲属去世需要办理后事的假期'
    },
    '调休假': {
        id: 'compensatory',
        name: '调休假',
        maxDays: null,
        requireAdvanceNotice: 1,
        requireDocument: false,
        paymentRate: 1.0,
        description: '因加班产生的补休假期，需在3个月内使用'
    }
};

/**
 * 审批层级配置
 */
const APPROVAL_LEVELS = {
    SUPERVISOR: '直属主管',
    DEPARTMENT_DIRECTOR: '部门总监',
    HR_MANAGER: 'HR经理',
    CEO: 'CEO'
};

/**
 * 特殊期间配置
 */
const SPECIAL_PERIODS = {
    TECH_SPRINT: '技术项目冲刺期',
    SALES_KEY_PERIOD: '销售关键客户期',
    FINANCE_MONTH_END: '财务月末结算期',
    PRODUCT_LAUNCH: '产品发布期'
};

/**
 * 请假规则引擎类
 */
class LeaveRulesEngine {
    constructor() {
        this.leaveTypes = LEAVE_TYPES;
        this.approvalLevels = APPROVAL_LEVELS;
        this.specialPeriods = SPECIAL_PERIODS;
    }

    /**
     * 获取所有请假类型
     * @returns {Object} 请假类型配置
     */
    getLeaveTypes() {
        return this.leaveTypes;
    }

    /**
     * 获取特定请假类型的配置
     * @param {string} leaveType - 请假类型
     * @returns {Object|null} 请假类型配置或null
     */
    getLeaveTypeConfig(leaveType) {
        return this.leaveTypes[leaveType] || null;
    }

    /**
     * 验证请假申请是否符合基本规则
     * @param {Object} leaveRequest - 请假申请对象
     * @returns {Object} 验证结果
     */
    validateLeaveRequest(leaveRequest) {
        const {
            employee,
            leaveType,
            startDate,
            endDate,
            days,
            reason,
            advanceNoticeDays
        } = leaveRequest;

        const config = this.getLeaveTypeConfig(leaveType);
        if (!config) {
            return {
                valid: false,
                errors: ['无效的请假类型'],
                warnings: []
            };
        }

        const errors = [];
        const warnings = [];

        // 验证请假天数
        if (config.maxDays && days > config.maxDays) {
            errors.push(`${leaveType}年度限额为${config.maxDays}天，申请${days}天超出限制`);
        }

        // 验证提前申请时间
        const requiredAdvanceNotice = this.getRequiredAdvanceNotice(employee, leaveType);
        if (advanceNoticeDays < requiredAdvanceNotice) {
            if (leaveType === '病假' || leaveType === '丧假') {
                warnings.push(`${leaveType}可以事后补办手续`);
            } else {
                errors.push(`${leaveType}需要提前${requiredAdvanceNotice}天申请，当前仅提前${advanceNoticeDays}天`);
            }
        }

        // 验证假期余额
        const balanceCheck = window.employeeManager.validateLeaveBalance(employee, leaveType, days);
        if (!balanceCheck.valid) {
            errors.push(balanceCheck.message);
        }

        // 验证特殊期间
        const specialPeriodCheck = this.checkSpecialPeriods(employee, startDate, endDate);
        if (specialPeriodCheck.hasConflict) {
            warnings.push(...specialPeriodCheck.warnings);
        }

        // 验证工作交接要求
        const handoverCheck = this.checkHandoverRequirements(employee, leaveType, days);
        if (handoverCheck.required) {
            warnings.push(...handoverCheck.requirements);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            config
        };
    }

    /**
     * 计算所需的提前申请天数
     * @param {Object} employee - 员工对象
     * @param {string} leaveType - 请假类型
     * @returns {number} 所需提前申请天数
     */
    getRequiredAdvanceNotice(employee, leaveType) {
        const config = this.getLeaveTypeConfig(leaveType);
        let baseRequirement = config.requireAdvanceNotice;

        // 技术部门在项目冲刺期需要额外提前申请
        if (employee.department === '技术部' && leaveType === '年假') {
            baseRequirement = Math.max(baseRequirement, 5);
        }

        return baseRequirement;
    }

    /**
     * 确定审批流程
     * @param {Object} leaveRequest - 请假申请对象
     * @returns {Object} 审批流程配置
     */
    determineApprovalProcess(leaveRequest) {
        const { employee, leaveType, days } = leaveRequest;
        const approvers = [];
        let finalApprover = null;

        // 基础审批流程
        approvers.push({
            level: this.approvalLevels.SUPERVISOR,
            name: employee.supervisor,
            required: true,
            order: 1
        });

        // 根据请假天数确定审批层级
        if (days >= 2) {
            approvers.push({
                level: this.approvalLevels.DEPARTMENT_DIRECTOR,
                name: this.getDepartmentDirector(employee.department),
                required: true,
                order: 2
            });
        }

        if (days > 5) {
            approvers.push({
                level: this.approvalLevels.HR_MANAGER,
                name: 'HR经理',
                required: true,
                order: 3
            });
        }

        if (days > 10) {
            finalApprover = {
                level: this.approvalLevels.CEO,
                name: 'CEO',
                required: true,
                order: 4
            };
            approvers.push(finalApprover);
        }

        // 特殊部门规则
        const specialApprovers = this.getSpecialApprovers(employee, leaveType, days);
        if (specialApprovers.length > 0) {
            approvers.push(...specialApprovers);
        }

        // 排序审批流程
        approvers.sort((a, b) => a.order - b.order);

        return {
            approvers,
            totalLevels: approvers.length,
            estimatedProcessingDays: Math.ceil(approvers.length * 0.5),
            autoApprovalEligible: days === 1 && leaveType === '年假',
            finalApprover
        };
    }

    /**
     * 获取部门总监名称
     * @param {string} department - 部门名称
     * @returns {string} 部门总监名称
     */
    getDepartmentDirector(department) {
        const directorMap = {
            '技术部': '技术总监',
            '销售部': '销售总监',
            '产品部': '产品总监',
            '市场部': '市场总监',
            '运营部': '运营总监',
            '人事部': 'HR总监',
            '财务部': '财务总监'
        };
        return directorMap[department] || '部门总监';
    }

    /**
     * 获取特殊审批人
     * @param {Object} employee - 员工对象
     * @param {string} leaveType - 请假类型
     * @param {number} days - 请假天数
     * @returns {Array} 特殊审批人列表
     */
    getSpecialApprovers(employee, leaveType, days) {
        const specialApprovers = [];

        // 技术部冲刺期特殊审批
        if (employee.department === '技术部' && days > 2) {
            specialApprovers.push({
                level: '技术总监特批',
                name: '技术总监',
                required: true,
                order: 2.5,
                reason: '技术项目冲刺期特殊审批'
            });
        }

        // 销售部关键期特殊审批
        if (employee.department === '销售部' && days > 1) {
            specialApprovers.push({
                level: '销售总监评估',
                name: '销售总监',
                required: true,
                order: 2.5,
                reason: '评估对客户业务影响'
            });
        }

        // 财务部月末特殊审批
        if (employee.department === '财务部') {
            specialApprovers.push({
                level: '财务总监特批',
                name: '财务总监',
                required: true,
                order: 2.5,
                reason: '财务结算期特殊审批'
            });
        }

        // 产品部发布期特殊审批
        if (employee.department === '产品部' && days > 1) {
            specialApprovers.push({
                level: '产品总监特批',
                name: '产品总监',
                required: true,
                order: 2.5,
                reason: '产品发布期特殊审批'
            });
        }

        return specialApprovers;
    }

    /**
     * 检查特殊期间冲突
     * @param {Object} employee - 员工对象
     * @param {string} startDate - 开始日期
     * @param {string} endDate - 结束日期
     * @returns {Object} 冲突检查结果
     */
    checkSpecialPeriods(employee, startDate, endDate) {
        const warnings = [];
        let hasConflict = false;

        // 这里可以集成实际的项目日历或关键期间数据
        // 目前使用示例逻辑

        const start = new Date(startDate);
        const end = new Date(endDate);
        const currentMonth = start.getMonth() + 1;
        const currentDay = start.getDate();

        // 财务部月末检查（每月25-31日）
        if (employee.department === '财务部' && currentDay >= 25) {
            warnings.push('请假期间包含月末财务结算期，可能影响工作安排');
            hasConflict = true;
        }

        // 技术部季度末检查（每季度最后一个月）
        if (employee.department === '技术部' && [3, 6, 9, 12].includes(currentMonth)) {
            warnings.push('请假期间可能与季度技术项目冲刺期重叠');
            hasConflict = true;
        }

        // 销售部季度初检查（每季度第一个月）
        if (employee.department === '销售部' && [1, 4, 7, 10].includes(currentMonth)) {
            warnings.push('请假期间为销售关键客户维护期，建议调整时间');
            hasConflict = true;
        }

        return {
            hasConflict,
            warnings
        };
    }

    /**
     * 检查工作交接要求
     * @param {Object} employee - 员工对象
     * @param {string} leaveType - 请假类型
     * @param {number} days - 请假天数
     * @returns {Object} 交接要求检查结果
     */
    checkHandoverRequirements(employee, leaveType, days) {
        const requirements = [];
        let required = false;

        if (days >= 2) {
            required = true;

            // 通用交接要求
            requirements.push('指定临时负责人并完成工作交接');
            requirements.push('更新工作清单和重要事项提醒');

            // 部门特定交接要求
            switch (employee.department) {
                case '技术部':
                    requirements.push('提交代码并更新技术文档');
                    requirements.push('说明项目进度和风险点');
                    requirements.push('设置紧急联系方式和处理授权');
                    break;

                case '销售部':
                    requirements.push('更新客户沟通状态和重要商机跟进安排');
                    requirements.push('制定客户紧急联系预案');
                    break;

                case '财务部':
                    requirements.push('完成当前财务处理工作');
                    requirements.push('交接未完成的账务处理事项');
                    break;

                case '产品部':
                    requirements.push('更新产品开发进度和需求文档');
                    requirements.push('安排产品相关会议的替代参与人');
                    break;

                default:
                    requirements.push('完成部门常规工作交接');
            }
        }

        return {
            required,
            requirements
        };
    }

    /**
     * 计算请假工资
     * @param {Object} leaveRequest - 请假申请对象
     * @param {number} dailySalary - 日工资
     * @returns {Object} 工资计算结果
     */
    calculateSalary(leaveRequest, dailySalary) {
        const { leaveType, days } = leaveRequest;
        const config = this.getLeaveTypeConfig(leaveType);
        
        let totalSalary = 0;
        let details = [];

        if (leaveType === '病假') {
            // 病假特殊计算：前5天全薪，之后80%
            const fullPayDays = Math.min(days, 5);
            const reducedPayDays = Math.max(0, days - 5);
            
            const fullPayAmount = fullPayDays * dailySalary;
            const reducedPayAmount = reducedPayDays * dailySalary * 0.8;
            
            totalSalary = fullPayAmount + reducedPayAmount;
            
            if (fullPayDays > 0) {
                details.push(`前${fullPayDays}天全薪：${fullPayAmount.toFixed(2)}元`);
            }
            if (reducedPayDays > 0) {
                details.push(`后${reducedPayDays}天80%薪资：${reducedPayAmount.toFixed(2)}元`);
            }
        } else {
            // 其他假期按配置的薪资比例计算
            totalSalary = days * dailySalary * config.paymentRate;
            
            if (config.paymentRate === 1.0) {
                details.push(`${days}天全薪：${totalSalary.toFixed(2)}元`);
            } else if (config.paymentRate === 0.0) {
                details.push(`${days}天无薪假期：0元`);
            } else {
                details.push(`${days}天${(config.paymentRate * 100)}%薪资：${totalSalary.toFixed(2)}元`);
            }
        }

        return {
            totalSalary: parseFloat(totalSalary.toFixed(2)),
            dailySalary,
            days,
            paymentRate: config.paymentRate,
            details
        };
    }

    /**
     * 生成请假申请摘要
     * @param {Object} leaveRequest - 请假申请对象
     * @returns {Object} 请假申请摘要
     */
    generateLeaveSummary(leaveRequest) {
        const validation = this.validateLeaveRequest(leaveRequest);
        const approvalProcess = this.determineApprovalProcess(leaveRequest);
        const handoverRequirements = this.checkHandoverRequirements(
            leaveRequest.employee, 
            leaveRequest.leaveType, 
            leaveRequest.days
        );

        return {
            ...leaveRequest,
            validation,
            approvalProcess,
            handoverRequirements,
            config: this.getLeaveTypeConfig(leaveRequest.leaveType),
            generatedAt: new Date().toISOString(),
            status: validation.valid ? 'ready_for_approval' : 'requires_revision'
        };
    }

    /**
     * 获取请假类型的详细说明
     * @param {string} leaveType - 请假类型
     * @returns {Object} 详细说明
     */
    getLeaveTypeDetails(leaveType) {
        const config = this.getLeaveTypeConfig(leaveType);
        if (!config) return null;

        const details = {
            ...config,
            requirements: [],
            restrictions: []
        };

        // 添加具体要求
        if (config.requireAdvanceNotice > 0) {
            details.requirements.push(`需提前${config.requireAdvanceNotice}天申请`);
        }

        if (config.requireDocument) {
            switch (leaveType) {
                case '病假':
                    details.requirements.push('1-3天需提供医院证明，3天以上需住院证明');
                    break;
                case '婚假':
                    details.requirements.push('需提供结婚证明');
                    break;
                case '产假':
                case '陪产假':
                    details.requirements.push('需提供生育证明');
                    break;
                case '丧假':
                    details.requirements.push('需提供亲属关系证明和死亡证明');
                    break;
            }
        }

        // 添加限制条件
        if (config.maxDays) {
            details.restrictions.push(`年度限额${config.maxDays}天`);
        }

        if (leaveType === '调休假') {
            details.restrictions.push('需在3个月内使用');
        }

        return details;
    }
}

// 创建全局请假规则引擎实例
window.leaveRulesEngine = new LeaveRulesEngine();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LeaveRulesEngine, LEAVE_TYPES, APPROVAL_LEVELS };
} 