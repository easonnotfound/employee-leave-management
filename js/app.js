/**
 * 员工请假管理系统 - 主应用逻辑
 * 集成云雾AI API、页面交互、请假流程等核心功能
 */

// 云雾AI API配置
const AI_CONFIG = {
    apiKey: 'sk-VXX8gTqtw2nQ0kzYq7VG4h1f9IBaB6kJd0xfUoPK9P83IsON',
    baseURL: 'https://yunwu.ai/v1',
    model: 'claude-sonnet-4-20250514', // 可以根据需要调整模型
    maxTokens: 2000,
    temperature: 0.7
};

/**
 * 时间处理工具类
 */
class TimeUtils {
    /**
     * 获取当前精确时间
     */
    static getCurrentTime() {
        return new Date();
    }

    /**
     * 格式化日期为YYYY-MM-DD格式
     */
    static formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 格式化时间为中文格式
     */
    static formatDateTime(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    /**
     * 计算两个日期之间的天数（包含首尾）
     */
    static calculateDays(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // 设置时间为当天开始，避免时区问题
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        
        const timeDiff = end.getTime() - start.getTime();
        const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        return dayDiff + 1; // 包含首尾两天
    }

    /**
     * 验证日期是否合理
     */
    static validateLeaveDate(startDate, endDate) {
        const now = this.getCurrentTime();
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const errors = [];
        
        // 验证日期格式
        if (isNaN(start.getTime())) {
            errors.push('开始日期格式不正确');
        }
        if (isNaN(end.getTime())) {
            errors.push('结束日期格式不正确');
        }
        
        if (errors.length > 0) {
            return { valid: false, errors };
        }
        
        // 验证日期逻辑
        if (end < start) {
            errors.push('结束日期不能早于开始日期');
        }
        
        // 检查是否申请的是过去的日期（允许今天）
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        
        if (start < today) {
            errors.push('不能申请过去的日期');
        }
        
        // 检查请假天数是否合理（最多365天）
        const days = this.calculateDays(startDate, endDate);
        if (days > 365) {
            errors.push('单次请假不能超过365天');
        }
        
        return {
            valid: errors.length === 0,
            errors,
            days
        };
    }

    /**
     * 计算提前申请天数
     */
    static calculateAdvanceNoticeDays(startDate) {
        const now = this.getCurrentTime();
        const start = new Date(startDate);
        
        now.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        
        const timeDiff = start.getTime() - now.getTime();
        return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }
}

/**
 * 主应用类
 */
class LeaveManagementApp {
    constructor() {
        this.currentView = 'employee'; // 'employee' | 'admin'
        this.currentEmployee = null;
        this.leaveRequest = null;
        this.chatHistory = [];
        this.leaveRecords = this.loadLeaveRecords();
        
        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.bindEvents();
        this.initializeUI();
        this.loadEmployeeCards();
        this.checkLibrariesLoaded();
    }

    /**
     * 检查第三方库是否正确加载
     */
    checkLibrariesLoaded() {
        // 延迟检查，确保库有时间加载
        setTimeout(() => {
            const missingLibs = [];
            
            if (typeof html2canvas === 'undefined') {
                missingLibs.push('html2canvas');
            }
            
            if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
                missingLibs.push('jsPDF');
            }
            
            if (missingLibs.length > 0) {
                console.warn('以下库未正确加载:', missingLibs.join(', '));
                console.warn('图片/PDF下载功能可能无法正常使用');
                
                // 在控制台提供帮助信息
                console.info('如果遇到下载问题，请：');
                console.info('1. 检查网络连接');
                console.info('2. 刷新页面重试');
                console.info('3. 使用其他浏览器');
            } else {
                console.info('✅ 所有第三方库已正确加载');
                console.info('jsPDF版本:', window.jspdf.version || '未知');
            }
        }, 2000);
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 导航按钮事件
        document.getElementById('employeeBtn').addEventListener('click', () => {
            this.switchView('employee');
        });

        document.getElementById('adminBtn').addEventListener('click', () => {
            this.switchView('admin');
        });

        // 身份验证事件
        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuthentication();
        });

        // 聊天事件
        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.getElementById('chatResetBtn').addEventListener('click', () => {
            this.resetChat();
        });

        // 请假单操作事件
        document.getElementById('editBtn')?.addEventListener('click', () => {
            this.toggleEditMode();
        });

        document.getElementById('saveBtn')?.addEventListener('click', () => {
            this.saveEditedForm();
        });

        document.getElementById('downloadImageBtn')?.addEventListener('click', () => {
            this.downloadAsImage();
        });

        document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
            this.downloadAsPdf();
        });

        // 管理员后台事件
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchAdminTab(e.target.dataset.tab);
            });
        });
    }

    /**
     * 初始化UI状态
     */
    initializeUI() {
        this.showSection('authSection');
        this.hideSection('chatSection');
        this.hideSection('previewSection');
        this.switchView('employee');
    }

    /**
     * 切换视图（员工/管理员）
     */
    switchView(view) {
        this.currentView = view;
        
        // 更新导航按钮状态
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(view === 'employee' ? 'employeeBtn' : 'adminBtn').classList.add('active');
        
        // 切换内容区域
        if (view === 'employee') {
            this.showSection('employeeSection');
            this.hideSection('adminSection');
        } else {
            this.hideSection('employeeSection');
            this.showSection('adminSection');
            this.loadAdminData();
        }
    }

    /**
     * 处理员工身份验证
     */
    async handleAuthentication() {
        const nameInput = document.getElementById('employeeName');
        const identifier = nameInput.value.trim();
        const statusDiv = document.getElementById('authStatus');

        if (!identifier) {
            this.showAuthStatus('请输入姓名或工号', 'error');
            return;
        }

        // 显示加载状态
        this.showLoading('验证身份中...');

        try {
            // 验证员工身份
            const authResult = window.employeeManager.authenticateEmployee(identifier);
            
            if (authResult.success) {
                this.currentEmployee = authResult.employee;
                this.showAuthStatus(authResult.message, 'success');
                
                // 延迟跳转到聊天界面
                setTimeout(() => {
                    this.startChat();
                }, 1500);
            } else {
                this.showAuthStatus(authResult.message, 'error');
            }
        } catch (error) {
            console.error('Authentication error:', error);
            this.showAuthStatus('验证过程中发生错误，请重试', 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 显示身份验证状态
     */
    showAuthStatus(message, type) {
        const statusDiv = document.getElementById('authStatus');
        statusDiv.textContent = message;
        statusDiv.className = `auth-status ${type}`;
        statusDiv.style.display = 'block';
    }

    /**
     * 开始AI对话
     */
    async startChat() {
        // 隐藏验证区域，显示聊天区域
        this.hideSection('authSection');
        this.showSection('chatSection');

        // 更新聊天头部信息
        const summary = window.employeeManager.getEmployeeSummary(this.currentEmployee);
        document.getElementById('chatUserName').textContent = summary.basic.name;
        document.getElementById('chatUserDept').textContent = `${summary.basic.department} · ${summary.basic.position}`;

        // 启用聊天输入
        document.getElementById('chatInput').disabled = false;
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('chatStatus').textContent = '请告诉我您要申请什么类型的假期';

        // 发送欢迎消息
        const welcomeMessage = `您好 ${summary.basic.name}！我是您的AI请假助手。

我将帮您收集信息并生成包含以下字段的标准请假表格：
📋 **标准表格字段**
• 员工姓名、工号
• 请假类型、请假日期、请假时长  
• 剩余年假时长、申请时间

🎯 **可申请的假期类型**
• 年假（您当前剩余 ${summary.leave.remainingAnnualLeave} 天）
• 病假、事假、婚假、产假、陪产假、丧假、调休假

请告诉我您要申请哪种假期？我会逐步收集信息为您生成标准表格。`;

        this.addMessage('ai', welcomeMessage);

        // 获取当前日期用于AI提示
        const todayDate = TimeUtils.formatDate(TimeUtils.getCurrentTime());
        
        // 初始化对话状态
        this.chatHistory = [
            {
                role: 'system',
                content: `你是一个专业的员工请假管理AI助手。当前员工信息：
- 姓名：${summary.basic.name}
- 工号：${summary.basic.id}
- 部门：${summary.basic.department}
- 职位：${summary.basic.position}
- 剩余年假：${summary.leave.remainingAnnualLeave}天
- 已用病假：${summary.leave.usedSickLeave}天
- 已用事假：${summary.leave.usedPersonalLeave}天

今天的日期是：${todayDate}

你的任务是系统地收集以下信息来生成标准请假表格：
【必需信息】
1. 请假类型（年假/病假/事假/婚假/产假/陪产假/丧假/调休假）
2. 请假开始日期（YYYY-MM-DD格式，不能是过去的日期）
3. 请假结束日期（YYYY-MM-DD格式，必须不早于开始日期）
4. 请假原因（简要说明）

【工作流程】
1. 首先询问员工要申请什么类型的假期
2. 然后询问具体的请假时间：
   - 明确告知今天是${todayDate}
   - 开始日期必须是今天或之后的日期
   - 结束日期必须不早于开始日期
   - 请用YYYY-MM-DD格式（如：2025-01-15）
3. 询问请假原因
4. 确认所有信息无误后，说"我现在为您生成请假申请表"

【日期验证规则】
- 不能申请过去的日期
- 结束日期不能早于开始日期  
- 单次请假不能超过365天
- 建议提前至少1天申请（紧急情况除外）

【注意事项】
- 逐步收集信息，不要一次询问所有内容
- 根据公司制度提供专业建议
- 如果用户输入的日期有问题，要明确指出并要求重新输入
- 保持友好、专业的对话风格
- 当收集完整信息后，明确说出生成表格的指令

请始终使用中文回复，语言简洁明了。`
            }
        ];
    }

    /**
     * 发送消息
     */
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message) return;

        // 显示用户消息
        this.addMessage('user', message);
        input.value = '';

        // 显示AI思考状态
        document.getElementById('chatStatus').textContent = 'AI正在思考...';
        document.getElementById('sendBtn').disabled = true;

        try {
            // 添加用户消息到对话历史
            this.chatHistory.push({ role: 'user', content: message });

            // 调用AI API
            const aiResponse = await this.callAIAPI(this.chatHistory);
            
            // 显示AI回复
            this.addMessage('ai', aiResponse);
            
            // 添加AI回复到对话历史
            this.chatHistory.push({ role: 'assistant', content: aiResponse });

            // 检查是否需要生成请假单
            await this.processAIResponse(aiResponse, message);

        } catch (error) {
            console.error('AI Chat error:', error);
            this.addMessage('ai', '抱歉，我遇到了一些技术问题。请稍后重试，或者您可以直接告诉我：\n1. 请假类型\n2. 开始日期\n3. 结束日期\n4. 请假原因');
        } finally {
            document.getElementById('chatStatus').textContent = '请输入您的消息...';
            document.getElementById('sendBtn').disabled = false;
        }
    }

    /**
     * 调用云雾AI API
     */
    async callAIAPI(messages) {
        const response = await fetch(`${AI_CONFIG.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: messages,
                max_tokens: AI_CONFIG.maxTokens,
                temperature: AI_CONFIG.temperature,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('AI API返回数据格式错误');
        }

        return data.choices[0].message.content;
    }

    /**
     * 处理AI响应，检查是否需要生成请假单
     */
    async processAIResponse(aiResponse, userMessage) {
        // 检测AI是否要生成请假表格的关键词
        const generateKeywords = [
            '生成请假申请表',
            '现在为您生成请假申请表', 
            '生成请假单',
            '提交申请',
            '确认申请',
            '完成申请',
            '申请表',
            '生成表格',
            '为您生成',
            '创建请假单'
        ];
        
        const shouldGenerate = generateKeywords.some(keyword => 
            aiResponse.includes(keyword) || userMessage.includes(keyword)
        );

        // 同时检查对话是否包含了基本的请假信息
        const hasBasicInfo = this.checkBasicLeaveInfo();

        if (shouldGenerate || hasBasicInfo) {
            // 尝试从对话中提取请假信息
            await this.tryGenerateLeaveForm();
        }
    }

    /**
     * 检查对话中是否包含基本的请假信息
     */
    checkBasicLeaveInfo() {
        const conversationText = this.chatHistory
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => msg.content)
            .join(' ');

        // 检查是否包含请假类型
        const leaveTypes = ['年假', '病假', '事假', '婚假', '产假', '陪产假', '丧假', '调休假'];
        const hasLeaveType = leaveTypes.some(type => conversationText.includes(type));

        // 检查是否包含日期信息
        const datePattern = /(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)|([一二三四五六七八九十]{1,2}月[一二三四五六七八九十]{1,2}日)|(明天|后天|下周|下个月)/;
        const hasDate = datePattern.test(conversationText);

        // 检查是否包含天数信息
        const daysPattern = /(\d+)\s*[天日]/;
        const hasDays = daysPattern.test(conversationText);

        return hasLeaveType && (hasDate || hasDays);
    }

    /**
     * 尝试生成请假单
     */
    async tryGenerateLeaveForm() {
        // 智能信息提取，提供更详细的提示来获得准确的JSON
        
        const extractPrompt = `请仔细分析以下对话，提取员工的请假信息。

对话内容：
${this.chatHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}

请严格按照以下JSON格式返回信息，如果某项信息不明确，请推断或使用合理默认值：

{
    "leaveType": "请假类型（年假/病假/事假/婚假/产假/陪产假/丧假/调休假）",
    "startDate": "开始日期(YYYY-MM-DD格式，如2024-01-15)",
    "endDate": "结束日期(YYYY-MM-DD格式，如2024-01-17)", 
    "reason": "请假原因（如果没有明确说明，写'个人事务'）",
    "days": 请假天数（数字，不要引号）
}

注意：
1. 如果员工说"明天"，请转换为具体日期
2. 如果员工说"3天"但没说具体日期，请从明天开始计算
3. 如果信息完全不完整，才返回 null
4. 只返回JSON，不要任何其他文字`;

        try {
            const extractResponse = await this.callAIAPI([
                { role: 'system', content: '你是一个信息提取助手，专门从对话中提取请假信息并格式化为JSON。只返回JSON格式的数据或null，不要任何解释文字。' },
                { role: 'user', content: extractPrompt }
            ]);

            // 尝试解析提取的信息
            let leaveInfo;
            try {
                // 清理可能的额外文字，只保留JSON部分
                const jsonMatch = extractResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    leaveInfo = JSON.parse(jsonMatch[0]);
                } else {
                    leaveInfo = JSON.parse(extractResponse);
                }
            } catch (e) {
                console.error('JSON解析失败:', e);
                // 如果解析失败，提示用户信息不完整
                this.addMessage('ai', '抱歉，我还需要更多信息来生成请假表格。请告诉我：\n1. 请假类型（年假/病假/事假等）\n2. 具体的开始和结束日期\n3. 请假原因');
                return;
            }

            if (leaveInfo && leaveInfo.leaveType && leaveInfo.startDate && leaveInfo.endDate) {
                await this.generateLeaveForm(leaveInfo);
            } else {
                // 信息不完整，继续对话
                const missingInfo = [];
                if (!leaveInfo?.leaveType) missingInfo.push('请假类型');
                if (!leaveInfo?.startDate) missingInfo.push('开始日期');
                if (!leaveInfo?.endDate) missingInfo.push('结束日期');
                
                this.addMessage('ai', `请提供以下信息来完成请假申请：${missingInfo.join('、')}`);
            }
        } catch (error) {
            console.error('Extract leave info error:', error);
            this.addMessage('ai', '处理信息时遇到问题，请重新描述您的请假需求，包括请假类型、日期和原因。');
        }
    }

    /**
     * 生成请假单
     */
    async generateLeaveForm(leaveInfo) {
        try {
            // 使用TimeUtils验证和处理日期
            const validation = TimeUtils.validateLeaveDate(leaveInfo.startDate, leaveInfo.endDate);
            
            if (!validation.valid) {
                const errorMessage = `请假日期有问题：\n${validation.errors.join('\n')}\n\n请重新输入正确的日期信息。`;
                this.addMessage('ai', errorMessage);
                return;
            }

            // 使用工具类计算精确的日期信息
            const currentTime = TimeUtils.getCurrentTime();
            const days = validation.days;
            const advanceNoticeDays = TimeUtils.calculateAdvanceNoticeDays(leaveInfo.startDate);

            // 标准化日期格式
            const formattedStartDate = TimeUtils.formatDate(leaveInfo.startDate);
            const formattedEndDate = TimeUtils.formatDate(leaveInfo.endDate);
            const applicationDate = TimeUtils.formatDate(currentTime);
            const applicationTime = TimeUtils.formatDateTime(currentTime);

            console.log('请假日期计算详情:', {
                原始开始日期: leaveInfo.startDate,
                原始结束日期: leaveInfo.endDate,
                格式化开始日期: formattedStartDate,
                格式化结束日期: formattedEndDate,
                请假天数: days,
                提前申请天数: advanceNoticeDays,
                申请日期: applicationDate,
                申请时间: applicationTime
            });

            // 创建请假申请对象
            this.leaveRequest = {
                employee: this.currentEmployee,
                leaveType: leaveInfo.leaveType,
                startDate: formattedStartDate,
                endDate: formattedEndDate,
                days: days,
                reason: leaveInfo.reason,
                advanceNoticeDays: advanceNoticeDays,
                applicationDate: applicationDate,
                applicationTime: applicationTime
            };

            // 生成请假摘要
            const summary = window.leaveRulesEngine.generateLeaveSummary(this.leaveRequest);
            
            // 显示请假单预览
            this.showLeavePreview(summary);
            
            // 切换到预览区域
            this.hideSection('chatSection');
            this.showSection('previewSection');

        } catch (error) {
            console.error('Generate leave form error:', error);
            this.addMessage('ai', '生成请假单时遇到问题，请检查您提供的信息是否完整和正确。');
        }
    }

    /**
     * 显示请假单预览
     */
    showLeavePreview(summary) {
        const previewDiv = document.getElementById('leaveFormPreview');
        const employee = summary.employee;
        const employeeSummary = window.employeeManager.getEmployeeSummary(employee);

        // 确保申请时间总是显示最新的实时时间
        const currentTime = TimeUtils.getCurrentTime();
        const realtimeApplicationTime = TimeUtils.formatDateTime(currentTime);
        const realtimeApplicationDate = TimeUtils.formatDate(currentTime);
        
        // 更新summary中的申请时间为实时时间
        summary.applicationTime = realtimeApplicationTime;
        summary.applicationDate = realtimeApplicationDate;
        
        console.log('显示请假单预览 - 实时申请时间:', {
            当前时间: currentTime,
            格式化申请时间: realtimeApplicationTime,
            格式化申请日期: realtimeApplicationDate
        });

        const html = `
            <div class="leave-form">
                <div class="form-header">
                    <h2>员工请假申请表</h2>
                    <div class="form-id">申请编号：${this.generateApplicationId()}</div>
                </div>
                
                <div class="form-content">
                    <!-- 标准表格信息 - 突出显示核心字段 -->
                    <div class="standard-table-section">
                        <h3>📋 标准请假信息表</h3>
                        <table class="standard-leave-table" id="standardTable">
                            <tbody>
                                <tr>
                                    <td class="field-label">员工姓名</td>
                                    <td class="field-value">
                                        <span class="display-mode">${employeeSummary.basic.name}</span>
                                        <input type="text" class="editable-field hidden" data-field="employeeName" value="${employeeSummary.basic.name}">
                                    </td>
                                    <td class="field-label">工号</td>
                                    <td class="field-value">
                                        <span class="display-mode">${employeeSummary.basic.id}</span>
                                        <input type="text" class="editable-field hidden" data-field="employeeId" value="${employeeSummary.basic.id}">
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-label">请假类型</td>
                                    <td class="field-value leave-type">
                                        <span class="display-mode">${summary.leaveType}</span>
                                        <select class="editable-field hidden" data-field="leaveType">
                                            <option value="年假" ${summary.leaveType === '年假' ? 'selected' : ''}>年假</option>
                                            <option value="病假" ${summary.leaveType === '病假' ? 'selected' : ''}>病假</option>
                                            <option value="事假" ${summary.leaveType === '事假' ? 'selected' : ''}>事假</option>
                                            <option value="婚假" ${summary.leaveType === '婚假' ? 'selected' : ''}>婚假</option>
                                            <option value="产假" ${summary.leaveType === '产假' ? 'selected' : ''}>产假</option>
                                            <option value="陪产假" ${summary.leaveType === '陪产假' ? 'selected' : ''}>陪产假</option>
                                            <option value="丧假" ${summary.leaveType === '丧假' ? 'selected' : ''}>丧假</option>
                                            <option value="调休假" ${summary.leaveType === '调休假' ? 'selected' : ''}>调休假</option>
                                        </select>
                                    </td>
                                    <td class="field-label">请假时长</td>
                                    <td class="field-value leave-days">
                                        <span class="display-mode">${summary.days} 天</span>
                                        <input type="number" class="editable-field hidden" data-field="leaveDays" value="${summary.days}" min="1" max="365"> 天
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-label">请假日期</td>
                                    <td class="field-value" colspan="3">
                                        <span class="display-mode">${summary.startDate} 至 ${summary.endDate}</span>
                                        <div class="edit-mode hidden">
                                            <input type="date" class="editable-field" data-field="startDate" value="${summary.startDate}">
                                            至
                                            <input type="date" class="editable-field" data-field="endDate" value="${summary.endDate}">
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-label">剩余年假时长</td>
                                    <td class="field-value balance-highlight">${employeeSummary.leave.remainingAnnualLeave} 天</td>
                                    <td class="field-label">申请时间</td>
                                    <td class="field-value">
                                        <span class="display-mode">${summary.applicationTime}</span>
                                        <input type="datetime-local" class="editable-field hidden" data-field="applicationTime" value="${new Date(summary.applicationTime).toISOString().slice(0, 16)}">
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-label">请假原因</td>
                                    <td class="field-value" colspan="3">
                                        <span class="display-mode">${summary.reason || '个人事务'}</span>
                                        <textarea class="editable-field hidden" data-field="reason" rows="2">${summary.reason || '个人事务'}</textarea>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="edit-instructions hidden" id="editInstructions">
                            <p><i class="fas fa-info-circle"></i> 点击字段进行编辑，完成后点击"保存修改"按钮</p>
                        </div>
                    </div>

                    <div class="info-section">
                        <h3>详细员工信息</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <label>部门：</label>
                                <span>${employeeSummary.basic.department}</span>
                            </div>
                            <div class="info-item">
                                <label>职位：</label>
                                <span>${employeeSummary.basic.position}</span>
                            </div>
                            <div class="info-item">
                                <label>直属主管：</label>
                                <span>${employeeSummary.basic.supervisor}</span>
                            </div>
                            <div class="info-item">
                                <label>工作制度：</label>
                                <span>${employeeSummary.basic.workType}</span>
                            </div>
                        </div>
                    </div>



                    <div class="balance-section">
                        <h3>假期余额</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <label>剩余年假：</label>
                                <span>${employeeSummary.leave.remainingAnnualLeave} 天</span>
                            </div>
                            <div class="info-item">
                                <label>已用病假：</label>
                                <span>${employeeSummary.leave.usedSickLeave} 天</span>
                            </div>
                            <div class="info-item">
                                <label>已用事假：</label>
                                <span>${employeeSummary.leave.usedPersonalLeave} 天</span>
                            </div>
                        </div>
                    </div>

                    <div class="approval-section">
                        <h3>审批流程</h3>
                        <div class="approval-flow">
                            ${summary.approvalProcess.approvers.map((approver, index) => `
                                <div class="approval-step">
                                    <div class="step-number">${index + 1}</div>
                                    <div class="step-info">
                                        <div class="step-title">${approver.level}</div>
                                        <div class="step-name">${approver.name}</div>
                                        ${approver.reason ? `<div class="step-reason">${approver.reason}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="approval-note">
                            预计审批时间：${summary.approvalProcess.estimatedProcessingDays} 个工作日
                        </div>
                    </div>

                    ${summary.validation.warnings.length > 0 ? `
                        <div class="warnings-section">
                            <h3>注意事项</h3>
                            <ul class="warning-list">
                                ${summary.validation.warnings.map(warning => `<li>${warning}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    ${summary.handoverRequirements.required ? `
                        <div class="handover-section">
                            <h3>工作交接要求</h3>
                            <ul class="handover-list">
                                ${summary.handoverRequirements.requirements.map(req => `<li>${req}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>

                <div class="form-footer">
                    <div class="signature-section">
                        <div class="signature-item">
                            <label>申请人签名：</label>
                            <div class="signature-line">${employeeSummary.basic.name}</div>
                        </div>
                        <div class="signature-item">
                            <label>申请日期：</label>
                            <div class="signature-line">${summary.applicationDate}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        previewDiv.innerHTML = html;
        
        // 保存请假记录
        this.saveLeaveRecord(summary);
        
        // 提示用户申请时间已更新为实时时间
        this.showToast(`✅ 请假申请表已生成，申请时间：${realtimeApplicationTime}`, 'success');
    }

    /**
     * 生成申请编号
     */
    generateApplicationId() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const time = String(now.getTime()).slice(-4);
        return `LA${year}${month}${day}${time}`;
    }

    /**
     * 添加聊天消息
     */
    addMessage(sender, content) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        bubbleDiv.innerHTML = content.replace(/\n/g, '<br>');

        messageDiv.appendChild(bubbleDiv);
        messagesContainer.appendChild(messageDiv);

        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * 重置聊天
     */
    resetChat() {
        // 清除聊天记录
        document.getElementById('chatMessages').innerHTML = '';
        this.chatHistory = [];
        
        // 重置状态
        this.currentEmployee = null;
        this.leaveRequest = null;
        
        // 返回身份验证界面
        this.hideSection('chatSection');
        this.hideSection('previewSection');
        this.showSection('authSection');
        
        // 清空输入框
        document.getElementById('employeeName').value = '';
        document.getElementById('authStatus').style.display = 'none';
    }

    /**
     * 切换编辑模式
     */
    toggleEditMode() {
        const table = document.getElementById('standardTable');
        const editBtn = document.getElementById('editBtn');
        const saveBtn = document.getElementById('saveBtn');
        const instructions = document.getElementById('editInstructions');

        if (table.classList.contains('edit-mode')) {
            // 退出编辑模式
            this.exitEditMode();
        } else {
            // 进入编辑模式前，先更新申请时间为当前实时时间
            this.updateApplicationTimeToNow();
            
            table.classList.add('edit-mode');
            editBtn.innerHTML = '<i class="fas fa-times"></i> 取消编辑';
            saveBtn.classList.remove('hidden');
            instructions.classList.remove('hidden');

                    // 显示编辑字段，隐藏显示字段
        document.querySelectorAll('.display-mode').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.editable-field').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.edit-mode').forEach(el => el.classList.remove('hidden'));

        this.showToast('编辑模式已开启，申请时间已更新为当前实时时间', 'success');
        }
    }

    /**
     * 更新申请时间为当前实时时间
     */
    updateApplicationTimeToNow() {
        const currentTime = TimeUtils.getCurrentTime();
        const realtimeApplicationTime = TimeUtils.formatDateTime(currentTime);
        
        // 更新显示的申请时间
        const applicationTimeDisplay = document.querySelector('[data-field="applicationTime"]').parentElement.querySelector('.display-mode');
        if (applicationTimeDisplay) {
            applicationTimeDisplay.textContent = realtimeApplicationTime;
        }
        
        // 更新编辑字段的申请时间
        const applicationTimeField = document.querySelector('[data-field="applicationTime"]');
        if (applicationTimeField) {
            applicationTimeField.value = currentTime.toISOString().slice(0, 16);
        }
        
        // 更新请假记录中的申请时间
        if (this.leaveRequest) {
            this.leaveRequest.applicationTime = realtimeApplicationTime;
            this.leaveRequest.applicationDate = TimeUtils.formatDate(currentTime);
        }
        
        console.log('更新申请时间为实时时间:', {
            当前时间: currentTime,
            格式化时间: realtimeApplicationTime,
            ISO格式: currentTime.toISOString().slice(0, 16)
        });
    }

    /**
     * 退出编辑模式
     */
    exitEditMode() {
        const table = document.getElementById('standardTable');
        const editBtn = document.getElementById('editBtn');
        const saveBtn = document.getElementById('saveBtn');
        const instructions = document.getElementById('editInstructions');

        table.classList.remove('edit-mode');
        editBtn.innerHTML = '<i class="fas fa-edit"></i> 编辑表格';
        saveBtn.classList.add('hidden');
        instructions.classList.add('hidden');

        // 隐藏编辑字段，显示显示字段
        document.querySelectorAll('.display-mode').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.editable-field').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.edit-mode').forEach(el => el.classList.add('hidden'));
    }

    /**
     * 保存编辑后的表格
     */
    saveEditedForm() {
        try {
            // 收集所有编辑的数据
            const editedData = {};
            document.querySelectorAll('.editable-field').forEach(field => {
                const fieldName = field.getAttribute('data-field');
                editedData[fieldName] = field.value;
            });

            // 验证必填字段
            const requiredFields = ['employeeName', 'leaveType', 'startDate', 'endDate', 'reason'];
            const missingFields = requiredFields.filter(field => !editedData[field] || editedData[field].trim() === '');
            
            if (missingFields.length > 0) {
                this.showToast('请填写所有必填字段', 'error');
                return;
            }

            // 验证日期（如果日期有修改）
            if (editedData.startDate && editedData.endDate) {
                const validation = TimeUtils.validateLeaveDate(editedData.startDate, editedData.endDate);
                
                if (!validation.valid) {
                    const errorMessage = `日期验证失败：${validation.errors.join('、')}`;
                    this.showToast(errorMessage, 'error');
                    return;
                }

                // 重新计算请假天数
                const calculatedDays = validation.days;
                editedData.leaveDays = calculatedDays;
                
                // 更新表单中的天数显示
                const daysField = document.querySelector('[data-field="leaveDays"]');
                if (daysField) {
                    daysField.value = calculatedDays;
                }

                console.log('编辑后的日期计算:', {
                    开始日期: editedData.startDate,
                    结束日期: editedData.endDate,
                    计算天数: calculatedDays,
                    提前申请天数: TimeUtils.calculateAdvanceNoticeDays(editedData.startDate)
                });
            }

            // 更新显示内容
            this.updateDisplayContent(editedData);

            // 退出编辑模式
            this.exitEditMode();

            // 更新请假记录
            this.updateLeaveRecord(editedData);

            this.showToast('表格已保存！', 'success');

        } catch (error) {
            console.error('Save form error:', error);
            this.showToast('保存失败，请重试', 'error');
        }
    }

    /**
     * 更新显示内容
     */
    updateDisplayContent(editedData) {
        // 更新员工姓名
        if (editedData.employeeName) {
            document.querySelector('[data-field="employeeName"]').parentElement.querySelector('.display-mode').textContent = editedData.employeeName;
        }

        // 更新请假类型
        if (editedData.leaveType) {
            document.querySelector('[data-field="leaveType"]').parentElement.querySelector('.display-mode').textContent = editedData.leaveType;
        }

        // 更新请假天数
        if (editedData.leaveDays) {
            document.querySelector('[data-field="leaveDays"]').parentElement.querySelector('.display-mode').textContent = editedData.leaveDays + ' 天';
        }

        // 更新请假日期
        if (editedData.startDate && editedData.endDate) {
            const dateDisplay = document.querySelector('[data-field="startDate"]').closest('.field-value').querySelector('.display-mode');
            dateDisplay.textContent = `${editedData.startDate} 至 ${editedData.endDate}`;
        }

        // 更新申请时间
        if (editedData.applicationTime) {
            const timeDisplay = new Date(editedData.applicationTime).toLocaleString('zh-CN');
            document.querySelector('[data-field="applicationTime"]').parentElement.querySelector('.display-mode').textContent = timeDisplay;
        }

        // 更新请假原因
        if (editedData.reason) {
            document.querySelector('[data-field="reason"]').parentElement.querySelector('.display-mode').textContent = editedData.reason;
        }
    }

    /**
     * 更新请假记录
     */
    updateLeaveRecord(editedData) {
        if (this.leaveRequest) {
            // 更新当前请假申请对象
            this.leaveRequest.employee.name = editedData.employeeName || this.leaveRequest.employee.name;
            this.leaveRequest.leaveType = editedData.leaveType || this.leaveRequest.leaveType;
            
            // 处理日期更新
            if (editedData.startDate && editedData.endDate) {
                this.leaveRequest.startDate = TimeUtils.formatDate(editedData.startDate);
                this.leaveRequest.endDate = TimeUtils.formatDate(editedData.endDate);
                this.leaveRequest.days = parseInt(editedData.leaveDays) || TimeUtils.calculateDays(editedData.startDate, editedData.endDate);
                this.leaveRequest.advanceNoticeDays = TimeUtils.calculateAdvanceNoticeDays(editedData.startDate);
            } else {
                this.leaveRequest.days = parseInt(editedData.leaveDays) || this.leaveRequest.days;
            }
            
            this.leaveRequest.reason = editedData.reason || this.leaveRequest.reason;
            
            // 处理申请时间更新 - 如果用户修改了申请时间则使用用户的时间，否则使用当前实时时间
            if (editedData.applicationTime) {
                // 用户手动修改了申请时间
                this.leaveRequest.applicationTime = TimeUtils.formatDateTime(new Date(editedData.applicationTime));
                this.leaveRequest.applicationDate = TimeUtils.formatDate(new Date(editedData.applicationTime));
            } else {
                // 用户没有修改申请时间，使用当前实时时间
                const currentTime = TimeUtils.getCurrentTime();
                this.leaveRequest.applicationTime = TimeUtils.formatDateTime(currentTime);
                this.leaveRequest.applicationDate = TimeUtils.formatDate(currentTime);
            }

            console.log('更新后的请假记录:', this.leaveRequest);
        }
    }

    /**
     * 下载为图片
     */
    async downloadAsImage() {
        try {
            this.showLoading('正在生成图片...');
            
            // 检查html2canvas是否可用
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas库未正确加载，无法生成图片');
            }
            
            // 下载前确保申请时间为最新实时时间
            this.updateApplicationTimeToNow();
            
            const element = document.getElementById('leaveFormPreview');
            
            // 等待所有图片和字体加载完成
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                allowTaint: true,
                logging: false,
                width: element.scrollWidth,
                height: element.scrollHeight
            });

            const today = new Date();
            const dateStr = today.getFullYear() + '-' + 
                           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(today.getDate()).padStart(2, '0');
            const employeeName = this.leaveRequest?.employee?.name || '员工';
            
            const link = document.createElement('a');
            link.download = `请假申请表_${employeeName}_${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            console.log('准备下载图片文件:', link.download);
            link.click();

            this.showToast('图片下载成功！', 'success');
        } catch (error) {
            console.error('Download image error:', error);
            this.showToast(`图片下载失败：${error.message}`, 'error');
            
            // 提供降级方案
            this.showToast('您可以尝试手动截图或刷新页面重试', 'warning');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 下载为PDF
     */
    async downloadAsPdf() {
        try {
            this.showLoading('正在生成PDF...');

            // 检查jsPDF是否可用
            if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
                throw new Error('jsPDF库未正确加载，请刷新页面重试');
            }

            // 下载前确保申请时间为最新实时时间
            this.updateApplicationTimeToNow();

            const element = document.getElementById('leaveFormPreview');
            
            // 等待所有图片和字体加载完成
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                allowTaint: true,
                logging: false,
                width: element.scrollWidth,
                height: element.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            
            // 创建PDF - 使用正确的新版本语法
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            // 计算缩放比例，留出页边距
            const margin = 10; // 页边距10mm
            const availableWidth = pdfWidth - 2 * margin;
            const availableHeight = pdfHeight - 2 * margin;
            
            // 简化计算：将canvas尺寸转换为PDF尺寸
            const pixelToMm = 0.264583; // 1px = 0.264583mm at 96dpi
            const imgWidthMm = (imgWidth / 2) * pixelToMm; // 除以2因为scale是2
            const imgHeightMm = (imgHeight / 2) * pixelToMm;
            
            // 计算适合页面的尺寸
            const widthRatio = availableWidth / imgWidthMm;
            const heightRatio = availableHeight / imgHeightMm;
            const ratio = Math.min(widthRatio, heightRatio);
            
            const finalWidth = imgWidthMm * ratio;
            const finalHeight = imgHeightMm * ratio;
            
            // 居中计算
            const imgX = (pdfWidth - finalWidth) / 2;
            const imgY = margin;

            // 添加图片到PDF（暂时简化，不处理分页）
            pdf.addImage(imgData, 'PNG', imgX, imgY, finalWidth, finalHeight);

            // 保存文件
            const today = new Date();
            const dateStr = today.getFullYear() + '-' + 
                           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(today.getDate()).padStart(2, '0');
            const employeeName = this.leaveRequest?.employee?.name || '员工';
            const fileName = `请假申请表_${employeeName}_${dateStr}.pdf`;
            
            console.log('准备保存PDF文件:', fileName);
            pdf.save(fileName);

            this.showToast('PDF下载成功！', 'success');
        } catch (error) {
            console.error('Download PDF error:', error);
            this.showToast(`PDF下载失败：${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 保存请假记录
     */
    saveLeaveRecord(summary) {
        const record = {
            id: this.generateApplicationId(),
            employeeName: summary.employee.name,
            employeeId: summary.employee.id,
            department: summary.employee.department,
            leaveType: summary.leaveType,
            startDate: summary.startDate,
            endDate: summary.endDate,
            days: summary.days,
            reason: summary.reason,
            status: 'pending',
            applicationTime: summary.applicationTime,
            approvalProcess: summary.approvalProcess
        };

        this.leaveRecords.push(record);
        this.saveLeaveRecords();
    }

    /**
     * 加载请假记录
     */
    loadLeaveRecords() {
        const saved = localStorage.getItem('leaveRecords');
        return saved ? JSON.parse(saved) : [];
    }

    /**
     * 保存请假记录到本地存储
     */
    saveLeaveRecords() {
        localStorage.setItem('leaveRecords', JSON.stringify(this.leaveRecords));
    }

    /**
     * 加载管理员数据
     */
    loadAdminData() {
        this.updateAdminStats();
        this.loadLeaveRecordsTable();
    }

    /**
     * 更新管理员统计数据
     */
    updateAdminStats() {
        const totalEmployees = window.employeeManager.getAllEmployees().length;
        const todayLeaves = this.leaveRecords.filter(record => {
            const today = new Date().toISOString().split('T')[0];
            return record.startDate <= today && record.endDate >= today;
        }).length;
        const pendingApprovals = this.leaveRecords.filter(record => 
            record.status === 'pending'
        ).length;

        document.getElementById('totalEmployees').textContent = totalEmployees;
        document.getElementById('totalLeaves').textContent = todayLeaves;
        document.getElementById('pendingApprovals').textContent = pendingApprovals;
    }

    /**
     * 加载请假记录表格
     */
    loadLeaveRecordsTable() {
        const tbody = document.querySelector('#recordsTable tbody');
        
        if (this.leaveRecords.length === 0) {
            tbody.innerHTML = '<tr class="no-data"><td colspan="7">暂无请假记录</td></tr>';
            return;
        }

        tbody.innerHTML = this.leaveRecords.map(record => `
            <tr>
                <td>${record.applicationTime}</td>
                <td>${record.employeeName}</td>
                <td>${record.department}</td>
                <td>${record.leaveType}</td>
                <td>${record.days}天</td>
                <td>
                    <span class="status-badge status-${record.status}">
                        ${this.getStatusText(record.status)}
                    </span>
                </td>
                <td>
                    <button class="btn-sm" onclick="app.viewRecord('${record.id}')">查看</button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const statusMap = {
            'pending': '待审批',
            'approved': '已批准',
            'rejected': '已拒绝',
            'cancelled': '已取消'
        };
        return statusMap[status] || status;
    }

    /**
     * 加载员工卡片
     */
    loadEmployeeCards() {
        const container = document.getElementById('employeesGrid');
        if (!container) return;

        const employees = window.employeeManager.getAllEmployees();
        
        container.innerHTML = employees.map(emp => `
            <div class="employee-card">
                <div class="employee-header">
                    <h4>${emp.basic.name}</h4>
                    <span class="employee-id">${emp.basic.id}</span>
                </div>
                <div class="employee-info">
                    <div class="info-row">
                        <span>部门：${emp.basic.department}</span>
                    </div>
                    <div class="info-row">
                        <span>职位：${emp.basic.position}</span>
                    </div>
                    <div class="info-row">
                        <span>剩余年假：${emp.leave.remainingAnnualLeave}天</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 切换管理员标签页
     */
    switchAdminTab(tabName) {
        // 更新标签按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 显示对应内容
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(`${tabName}Tab`).classList.remove('hidden');

        // 加载对应数据
        if (tabName === 'employees') {
            this.loadEmployeeCards();
        }
    }

    /**
     * 查看请假记录详情
     */
    viewRecord(recordId) {
        const record = this.leaveRecords.find(r => r.id === recordId);
        if (record) {
            this.showToast(`查看记录：${record.employeeName} - ${record.leaveType}`, 'info');
            // 这里可以显示详细的模态框
        }
    }

    /**
     * 显示/隐藏区域
     */
    showSection(sectionId) {
        document.getElementById(sectionId).classList.remove('hidden');
    }

    hideSection(sectionId) {
        document.getElementById(sectionId).classList.add('hidden');
    }

    /**
     * 显示加载状态
     */
    showLoading(message = '加载中...') {
        const overlay = document.getElementById('loadingOverlay');
        overlay.querySelector('p').textContent = message;
        overlay.classList.remove('hidden');
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    /**
     * 显示Toast消息
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // 自动移除
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LeaveManagementApp();
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeaveManagementApp;
} 