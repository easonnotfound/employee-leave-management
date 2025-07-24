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
        this.pendingLeaveInfo = null; // 待确认的请假信息
        
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
            // 验证员工身份 - 调用API
            const authResult = await window.employeeManager.authenticateEmployee(identifier);
            
            if (authResult.success) {
                this.currentEmployee = authResult.employee;
                this.showAuthStatus(authResult.message, 'success');
                
                // 延迟跳转到聊天界面
                setTimeout(() => {
                    this.startChat();
                }, 1500);
            } else {
                this.showAuthStatus(authResult.message, 'error');
                
                // 如果有建议，显示建议
                if (authResult.suggestion) {
                    setTimeout(() => {
                        this.showAuthStatus(authResult.suggestion, 'warning');
                    }, 3000);
                }
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
        document.getElementById('chatStatus').textContent = 'AI正在回复...';
        document.getElementById('sendBtn').disabled = true;

        // 创建AI消息占位符
        const aiMessageId = this.addMessage('ai', '正在思考...');

        try {
            // 添加用户消息到对话历史
            this.chatHistory.push({ role: 'user', content: message });

            // 调用AI API（流式传输）
            const response = await this.callAIAPI(this.chatHistory, true);
            
            // 处理流式响应
            const aiResponse = await this.handleStreamResponse(response, aiMessageId);
            
            // 添加AI回复到对话历史
            this.chatHistory.push({ role: 'assistant', content: aiResponse });

            // 检查是否需要生成请假单
            await this.processAIResponse(aiResponse, message);

        } catch (error) {
            console.error('AI Chat error:', error);
            // 更新错误消息
            this.updateStreamingMessage(aiMessageId, '抱歉，我遇到了一些技术问题。请稍后重试，或者您可以直接告诉我：\n1. 请假类型\n2. 开始日期\n3. 结束日期\n4. 请假原因');
        } finally {
            document.getElementById('chatStatus').textContent = '请输入您的消息...';
            document.getElementById('sendBtn').disabled = false;
        }
    }

    /**
     * 调用云雾AI API（支持流式传输）
     */
    async callAIAPI(messages, isStream = true) {
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
                stream: isStream
            })
        });

        if (!response.ok) {
            throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`);
        }

        if (isStream) {
            return response;
        } else {
            const data = await response.json();
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('AI API返回数据格式错误');
            }

            return data.choices[0].message.content;
        }
    }

    /**
     * 处理流式响应
     */
    async handleStreamResponse(response, messageId) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        
                        if (data === '[DONE]') {
                            return fullContent;
                        }

                        try {
                            const json = JSON.parse(data);
                            if (json.choices && json.choices[0] && json.choices[0].delta) {
                                const content = json.choices[0].delta.content;
                                if (content) {
                                    fullContent += content;
                                    
                                    // 实时更新消息内容
                                    this.updateStreamingMessage(messageId, fullContent);
                                }
                            }
                        } catch (e) {
                            // 忽略JSON解析错误
                        }
                    }
                }
            }

            return fullContent;
        } catch (error) {
            console.error('Stream processing error:', error);
            throw error;
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * 更新流式消息内容
     */
    updateStreamingMessage(messageId, content) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            const bubbleElement = messageElement.querySelector('.message-bubble');
            if (bubbleElement) {
                bubbleElement.innerHTML = content.replace(/\n/g, '<br>');
                
                // 滚动到底部
                const messagesContainer = document.getElementById('chatMessages');
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
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
            ], false); // 使用非流式调用进行信息提取

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
                // 显示确认信息并提供生成表格按钮
                this.showLeaveConfirmation(leaveInfo);
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
     * 显示请假确认信息
     */
    showLeaveConfirmation(leaveInfo) {
        // 计算请假天数
        const validation = TimeUtils.validateLeaveDate(leaveInfo.startDate, leaveInfo.endDate);
        const days = validation.valid ? validation.days : 1;
        
        // 创建确认消息的HTML
        const confirmationHtml = `
            <div class="leave-confirmation">
                <h4>📋 请假信息确认</h4>
                <div class="confirmation-details">
                    <div class="detail-item">
                        <span class="label">请假类型：</span>
                        <span class="value">${leaveInfo.leaveType}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">开始日期：</span>
                        <span class="value">${leaveInfo.startDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">结束日期：</span>
                        <span class="value">${leaveInfo.endDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">请假天数：</span>
                        <span class="value">${days} 天</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">请假原因：</span>
                        <span class="value">${leaveInfo.reason || '个人事务'}</span>
                    </div>
                </div>
                <div class="confirmation-actions">
                    <button class="confirm-btn" onclick="window.app.confirmGenerateForm()">
                        <i class="fas fa-check"></i>
                        确认生成表格
                    </button>
                    <button class="cancel-btn" onclick="window.app.cancelGeneration()">
                        <i class="fas fa-times"></i>
                        重新输入
                    </button>
                </div>
            </div>
        `;

        // 存储请假信息供后续生成使用
        this.pendingLeaveInfo = leaveInfo;

        // 添加到聊天区域
        const messagesContainer = document.getElementById('chatMessages');
        const confirmationDiv = document.createElement('div');
        confirmationDiv.className = 'chat-message ai confirmation-message';
        confirmationDiv.innerHTML = `<div class="message-bubble">${confirmationHtml}</div>`;
        messagesContainer.appendChild(confirmationDiv);

        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 禁用输入，直到用户做出选择
        document.getElementById('chatInput').disabled = true;
        document.getElementById('sendBtn').disabled = true;
        document.getElementById('chatStatus').textContent = '请确认信息后点击"确认生成表格"';
    }

    /**
     * 确认生成表格
     */
    async confirmGenerateForm() {
        if (!this.pendingLeaveInfo) {
            this.showToast('没有待处理的请假信息', 'error');
            return;
        }

        try {
            // 重新启用输入
            document.getElementById('chatInput').disabled = false;
            document.getElementById('sendBtn').disabled = false;
            document.getElementById('chatStatus').textContent = '请输入您的消息...';

            // 生成请假表格
            await this.generateLeaveForm(this.pendingLeaveInfo);
            
            // 清除待处理信息
            this.pendingLeaveInfo = null;

            // 移除确认消息
            const confirmationMessage = document.querySelector('.confirmation-message');
            if (confirmationMessage) {
                confirmationMessage.remove();
            }

        } catch (error) {
            console.error('Generate form error:', error);
            this.showToast('生成表格失败，请重试', 'error');
        }
    }

    /**
     * 取消生成，重新输入
     */
    cancelGeneration() {
        // 重新启用输入
        document.getElementById('chatInput').disabled = false;
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('chatStatus').textContent = '请输入您的消息...';

        // 清除待处理信息
        this.pendingLeaveInfo = null;

        // 移除确认消息
        const confirmationMessage = document.querySelector('.confirmation-message');
        if (confirmationMessage) {
            confirmationMessage.remove();
        }

        // 添加AI消息引导重新输入
        this.addMessage('ai', '好的，请重新告诉我您的请假需求。我需要了解：\n1. 请假类型\n2. 开始和结束日期\n3. 请假原因');
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
    addMessage(sender, content, messageId = null) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        
        // 如果是AI消息且没有提供ID，生成一个唯一ID用于流式更新
        if (sender === 'ai' && !messageId) {
            messageId = 'ai-message-' + Date.now();
        }
        
        if (messageId) {
            messageDiv.id = messageId;
        }

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        bubbleDiv.innerHTML = content.replace(/\n/g, '<br>');

        messageDiv.appendChild(bubbleDiv);
        messagesContainer.appendChild(messageDiv);

        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return messageId;
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
     * 保存请假记录到数据库
     */
    async saveLeaveRecord(summary) {
        try {
            // 准备提交到后端的数据
            const leaveData = {
                employeeId: summary.employee.id,
                leaveType: summary.leaveType,
                startDate: summary.startDate,
                endDate: summary.endDate,
                days: summary.days,
                reason: summary.reason,
                advanceNoticeDays: summary.advanceNoticeDays || 0,
                applicationTime: summary.applicationTime,
                approvalProcess: summary.approvalProcess
            };

            console.log('💾 保存请假记录到数据库:', leaveData);

            // 调用后端API提交请假申请
            const response = await window.employeeManager.submitLeaveApplication(leaveData);
            
            if (response.success) {
                this.showToast(`✅ 请假申请已保存到数据库 (申请编号: ${response.applicationId})`, 'success');
                
                // 添加到本地记录用于立即显示
                const localRecord = {
                    id: response.applicationId,
                    employeeName: summary.employee.name,
                    employeeId: summary.employee.id,
                    department: summary.employee.department || summary.employee.basic?.department,
                    leaveType: summary.leaveType,
                    startDate: summary.startDate,
                    endDate: summary.endDate,
                    days: summary.days,
                    reason: summary.reason,
                    status: 'pending',
                    applicationTime: summary.applicationTime,
                    approvalProcess: summary.approvalProcess
                };
                
                this.leaveRecords.unshift(localRecord);
                
                // 同时更新localStorage作为备份
                this.saveLeaveRecords();
                
                // 刷新管理员数据（如果在管理员界面）
                if (this.currentView === 'admin') {
                    await this.loadAdminData();
                }
                
                return response;
            } else {
                this.showToast(`❌ 保存失败: ${response.message}`, 'error');
                
                // 如果后端保存失败，仍然保存到本地作为备份
                const backupRecord = {
                    id: this.generateApplicationId(),
                    employeeName: summary.employee.name,
                    employeeId: summary.employee.id,
                    department: summary.employee.department || summary.employee.basic?.department,
                    leaveType: summary.leaveType,
                    startDate: summary.startDate,
                    endDate: summary.endDate,
                    days: summary.days,
                    reason: summary.reason,
                    status: 'pending',
                    applicationTime: summary.applicationTime,
                    approvalProcess: summary.approvalProcess,
                    _backup: true // 标记为备份记录
                };
                
                this.leaveRecords.unshift(backupRecord);
                this.saveLeaveRecords();
                
                this.showToast('📝 已保存到本地备份，请稍后重试同步到数据库', 'warning');
                return null;
            }
        } catch (error) {
            console.error('保存请假记录失败:', error);
            this.showToast(`❌ 保存失败: ${error.message}`, 'error');
            
            // 保存到本地作为备份
            const backupRecord = {
                id: this.generateApplicationId(),
                employeeName: summary.employee.name,
                employeeId: summary.employee.id,
                department: summary.employee.department || summary.employee.basic?.department,
                leaveType: summary.leaveType,
                startDate: summary.startDate,
                endDate: summary.endDate,
                days: summary.days,
                reason: summary.reason,
                status: 'pending',
                applicationTime: summary.applicationTime,
                approvalProcess: summary.approvalProcess,
                _backup: true
            };
            
            this.leaveRecords.unshift(backupRecord);
            this.saveLeaveRecords();
            
            return null;
        }
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
    async loadAdminData() {
        await this.updateAdminStats();
        await this.loadLeaveRecordsTable();
    }

    /**
     * 更新管理员统计数据 - 从API获取
     */
    async updateAdminStats() {
        try {
            console.log('📊 更新管理员统计数据...');
            
            // 从API获取统计数据
            const stats = await window.employeeManager.getAdminStats();
            
            if (stats) {
                document.getElementById('totalEmployees').textContent = stats.totalEmployees;
                document.getElementById('totalLeaves').textContent = stats.todayLeaves;
                document.getElementById('pendingApprovals').textContent = stats.pendingApprovals;
                
                console.log('✅ 统计数据更新成功:', stats);
            } else {
                // 如果API失败，使用本地数据作为备份
                console.warn('⚠️ API获取统计数据失败，使用本地数据');
                
                const employees = await window.employeeManager.getAllEmployees();
                const totalEmployees = employees.length;
                
                const today = new Date().toISOString().split('T')[0];
                const todayLeaves = this.leaveRecords.filter(record => {
                    return record.startDate <= today && record.endDate >= today && record.status === 'approved';
                }).length;
                
                const pendingApprovals = this.leaveRecords.filter(record => 
                    record.status === 'pending'
                ).length;

                document.getElementById('totalEmployees').textContent = totalEmployees;
                document.getElementById('totalLeaves').textContent = todayLeaves;
                document.getElementById('pendingApprovals').textContent = pendingApprovals;
            }
        } catch (error) {
            console.error('❌ 更新统计数据失败:', error);
            
            // 显示错误状态
            document.getElementById('totalEmployees').textContent = '?';
            document.getElementById('totalLeaves').textContent = '?';
            document.getElementById('pendingApprovals').textContent = '?';
            
            this.showToast('获取统计数据失败，请检查后端连接', 'error');
        }
    }

    /**
     * 加载请假记录表格 - 从API获取
     */
    async loadLeaveRecordsTable() {
        const tbody = document.querySelector('#recordsTable tbody');
        
        try {
            console.log('📋 加载请假记录表格...');
            
            // 从API获取请假记录
            const response = await window.employeeManager.getLeaveRecords();
            
            if (response.success && response.records) {
                const records = response.records;
                
                if (records.length === 0) {
                    tbody.innerHTML = '<tr class="no-data"><td colspan="7">暂无请假记录</td></tr>';
                    return;
                }

                tbody.innerHTML = records.map(record => `
                    <tr>
                        <td>${this.formatDateTime(record.application_time)}</td>
                        <td>${record.employee_name}</td>
                        <td>${record.department_name}</td>
                        <td>${record.leave_type}</td>
                        <td>${record.days}天</td>
                        <td>
                            <span class="status-badge status-${record.status}">
                                ${this.getStatusText(record.status)}
                            </span>
                            ${record._backup ? '<small class="text-warning">(本地)</small>' : ''}
                        </td>
                        <td>
                            <button class="btn-sm" onclick="app.viewRecord('${record.id}')">查看</button>
                            ${record.status === 'pending' ? `
                                <button class="btn-sm" onclick="app.approveRecord('${record.id}', 'approve')" title="批准">
                                    ✓
                                </button>
                                <button class="btn-sm" onclick="app.approveRecord('${record.id}', 'reject')" title="拒绝">
                                    ✗
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');

                // 更新本地记录缓存
                this.leaveRecords = records.map(record => ({
                    id: record.id,
                    employeeName: record.employee_name,
                    employeeId: record.employee_id,
                    department: record.department_name,
                    leaveType: record.leave_type,
                    startDate: record.start_date,
                    endDate: record.end_date,
                    days: record.days,
                    reason: record.reason,
                    status: record.status,
                    applicationTime: record.application_time
                }));

                console.log(`✅ 加载了 ${records.length} 条请假记录`);
            } else {
                // API失败，使用本地数据
                console.warn('⚠️ API获取请假记录失败，使用本地数据');
                this.loadLocalLeaveRecords();
            }
        } catch (error) {
            console.error('❌ 加载请假记录失败:', error);
            
            // 显示错误并使用本地数据
            this.showToast('获取请假记录失败，显示本地数据', 'warning');
            this.loadLocalLeaveRecords();
        }
    }

    /**
     * 加载本地请假记录作为备份
     */
    loadLocalLeaveRecords() {
        const tbody = document.querySelector('#recordsTable tbody');
        
        if (this.leaveRecords.length === 0) {
            tbody.innerHTML = '<tr class="no-data"><td colspan="7">暂无请假记录</td></tr>';
            return;
        }

        tbody.innerHTML = this.leaveRecords.map(record => `
            <tr>
                <td>${this.formatDateTime(record.applicationTime)}</td>
                <td>${record.employeeName}</td>
                <td>${record.department}</td>
                <td>${record.leaveType}</td>
                <td>${record.days}天</td>
                <td>
                    <span class="status-badge status-${record.status}">
                        ${this.getStatusText(record.status)}
                    </span>
                    ${record._backup ? '<small class="text-warning">(本地)</small>' : ''}
                </td>
                <td>
                    <button class="btn-sm" onclick="app.viewRecord('${record.id}')">查看</button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * 格式化日期时间显示
     */
    formatDateTime(dateTime) {
        try {
            const date = new Date(dateTime);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateTime;
        }
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

    /**
     * 开始AI对话
     */
    async startChat() {
        // 隐藏验证区域，显示新的分栏对话界面（实时对话+表格界面）
        this.hideSection('authSection');
        this.showSection('chatTableSection');

        // 更新聊天头部信息
        const summary = window.employeeManager.getEmployeeSummary(this.currentEmployee);
        document.getElementById('chatUserNameInline').textContent = summary.basic.name;
        document.getElementById('chatUserDeptInline').textContent = `${summary.basic.department} · ${summary.basic.position}`;

        // 启用聊天输入
        document.getElementById('chatInputInline').disabled = false;
        document.getElementById('sendBtnInline').disabled = false;
        document.getElementById('chatStatusInline').textContent = '请告诉我您要申请什么类型的假期';

        // 初始化实时表格区域
        this.initializeRealtimeTable();

        // 发送欢迎消息
        const welcomeMessage = `您好 ${summary.basic.name}！我是您的AI请假助手。

我将帮您收集信息并在右侧实时生成请假表格：
📋 **实时表格功能**
• 根据对话内容自动更新表格字段
• 实时显示请假信息和审批流程
• 支持在线编辑和下载

🎯 **可申请的假期类型**
• 年假（您当前剩余 ${summary.leave.remainingAnnualLeave} 天）
• 病假、事假、婚假、产假、陪产假、丧假、调休假

请告诉我您要申请哪种假期？我会边聊边在右侧更新表格内容。`;

        this.addMessageInline('ai', welcomeMessage);

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

你的任务是逐步收集请假信息，并在用户提供信息时触发实时表格更新：

【收集顺序】
1. 请假类型（年假/病假/事假/婚假/产假/陪产假/丧假/调休假）
2. 请假开始日期（YYYY-MM-DD格式）
3. 请假结束日期（YYYY-MM-DD格式）
4. 请假原因

【实时更新指令】
当收集到部分信息时，请在回复中包含特殊标记来触发表格更新：
- [UPDATE_TABLE:部分信息] - 用于部分信息更新
- [GENERATE_TABLE:完整信息] - 用于生成完整表格

例如：用户说"我要请年假"，你回复时加上：[UPDATE_TABLE:{"leaveType":"年假"}]
用户说"2025-01-20到2025-01-22"，你回复时加上：[UPDATE_TABLE:{"startDate":"2025-01-20","endDate":"2025-01-22"}]

【注意事项】
- 逐步收集，每次只询问1-2个信息
- 根据用户回答实时更新右侧表格
- 保持友好、专业的对话风格
- 收集完整信息后自动生成完整表格

请始终使用中文回复。`
            }
        ];

        // 绑定新的聊天事件
        this.bindInlineChatEvents();
    }

    /**
     * 初始化实时表格区域
     */
    initializeRealtimeTable() {
        // 显示占位符
        this.showTablePlaceholder();
        
        // 初始化空的请假信息对象
        this.realtimeLeaveInfo = {
            employee: this.currentEmployee,
            leaveType: null,
            startDate: null,
            endDate: null,
            days: null,
            reason: null,
            applicationTime: TimeUtils.formatDateTime(TimeUtils.getCurrentTime()),
            applicationDate: TimeUtils.formatDate(TimeUtils.getCurrentTime())
        };
    }

    /**
     * 显示表格占位符
     */
    showTablePlaceholder() {
        const tableContent = document.getElementById('realtimeTableContent');
        tableContent.innerHTML = `
            <div class="table-placeholder">
                <div class="placeholder-content">
                    <i class="fas fa-comments"></i>
                    <h4>开始对话生成表格</h4>
                    <p>请在左侧与AI助手对话，我会根据您的需求实时生成请假申请表</p>
                </div>
            </div>
        `;
    }

    /**
     * 绑定分栏模式的聊天事件
     */
    bindInlineChatEvents() {
        // 发送消息事件
        document.getElementById('sendBtnInline').addEventListener('click', () => {
            this.sendMessageInline();
        });

        document.getElementById('chatInputInline').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessageInline();
            }
        });

        // 重置聊天事件
        document.getElementById('chatResetBtnInline').addEventListener('click', () => {
            this.resetChatInline();
        });

        // 表格操作事件
        document.getElementById('editBtnInline')?.addEventListener('click', () => {
            this.toggleEditModeInline();
        });

        document.getElementById('saveBtnInline')?.addEventListener('click', () => {
            this.saveEditedFormInline();
        });

        document.getElementById('downloadImageBtnInline')?.addEventListener('click', () => {
            this.downloadAsImageInline();
        });

        document.getElementById('downloadPdfBtnInline')?.addEventListener('click', () => {
            this.downloadAsPdfInline();
        });
    }

    /**
     * 发送消息（分栏模式）
     */
    async sendMessageInline() {
        const input = document.getElementById('chatInputInline');
        const message = input.value.trim();

        if (!message) return;

        // 显示用户消息
        this.addMessageInline('user', message);
        input.value = '';

        // 显示AI思考状态
        document.getElementById('chatStatusInline').textContent = 'AI正在回复...';
        document.getElementById('sendBtnInline').disabled = true;

        // 创建AI消息占位符
        const aiMessageId = this.addMessageInline('ai', '正在思考...');

        try {
            // 添加用户消息到对话历史
            this.chatHistory.push({ role: 'user', content: message });

            // 调用AI API（流式传输）
            const response = await this.callAIAPI(this.chatHistory, true);
            
            // 处理流式响应
            const aiResponse = await this.handleStreamResponseInline(response, aiMessageId);
            
            // 添加AI回复到对话历史
            this.chatHistory.push({ role: 'assistant', content: aiResponse });

            // 检查是否需要更新表格
            await this.processAIResponseForTable(aiResponse, message);

        } catch (error) {
            console.error('AI Chat error:', error);
            this.updateStreamingMessageInline(aiMessageId, '抱歉，我遇到了一些技术问题。请稍后重试。');
        } finally {
            document.getElementById('chatStatusInline').textContent = '请输入您的消息...';
            document.getElementById('sendBtnInline').disabled = false;
        }
    }

    /**
     * 处理流式响应（分栏模式）
     */
    async handleStreamResponseInline(response, messageId) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        
                        if (data === '[DONE]') {
                            return fullContent;
                        }

                        try {
                            const json = JSON.parse(data);
                            if (json.choices && json.choices[0] && json.choices[0].delta) {
                                const content = json.choices[0].delta.content;
                                if (content) {
                                    fullContent += content;
                                    
                                    // 实时更新消息内容
                                    this.updateStreamingMessageInline(messageId, fullContent);
                                }
                            }
                        } catch (e) {
                            // 忽略JSON解析错误
                        }
                    }
                }
            }

            return fullContent;
        } catch (error) {
            console.error('Stream processing error:', error);
            throw error;
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * 更新流式消息内容（分栏模式）
     */
    updateStreamingMessageInline(messageId, content) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            const bubbleElement = messageElement.querySelector('.message-bubble');
            if (bubbleElement) {
                // 处理UPDATE_TABLE标记，但不在显示中包含
                const displayContent = content.replace(/\[UPDATE_TABLE:.*?\]/g, '').replace(/\[GENERATE_TABLE:.*?\]/g, '');
                bubbleElement.innerHTML = displayContent.replace(/\n/g, '<br>');
                
                // 滚动到底部
                const messagesContainer = document.getElementById('chatMessagesInline');
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
    }

    /**
     * 处理AI响应以更新表格
     */
    async processAIResponseForTable(aiResponse, userMessage) {
        // 检查AI响应中是否包含表格更新指令
        const updateMatch = aiResponse.match(/\[UPDATE_TABLE:(.*?)\]/);
        const generateMatch = aiResponse.match(/\[GENERATE_TABLE:(.*?)\]/);

        if (updateMatch) {
            try {
                const updateData = JSON.parse(updateMatch[1]);
                await this.updateRealtimeTable(updateData);
            } catch (error) {
                console.error('Parse update data error:', error);
            }
        }

        if (generateMatch) {
            try {
                const completeData = JSON.parse(generateMatch[1]);
                await this.generateRealtimeTable(completeData);
            } catch (error) {
                console.error('Parse generate data error:', error);
            }
        }

        // 如果没有明确的指令，尝试智能提取信息
        if (!updateMatch && !generateMatch) {
            await this.smartExtractAndUpdate(aiResponse, userMessage);
        }
    }

    /**
     * 智能提取并更新表格信息
     */
    async smartExtractAndUpdate(aiResponse, userMessage) {
        // 使用增强的智能提取方法
        const updateData = await this.enhancedSmartExtract(aiResponse, userMessage);
        
        // 如果有更新数据，则更新表格
        if (Object.keys(updateData).length > 0) {
            console.log('智能提取到的信息:', updateData);
            await this.updateRealtimeTable(updateData);
        }
    }

    /**
     * 更新实时表格
     */
    async updateRealtimeTable(updateData) {
        // 更新实时请假信息
        Object.assign(this.realtimeLeaveInfo, updateData);
        
        console.log('更新实时表格数据:', updateData);
        console.log('当前实时请假信息:', this.realtimeLeaveInfo);
        
        // 如果表格还没生成，先生成基础表格
        const tableContent = document.getElementById('realtimeTableContent');
        if (tableContent.querySelector('.table-placeholder')) {
            this.generateBaseRealtimeTable();
        }
        
        // 更新具体字段
        this.updateTableFields(updateData);
        
        // 添加更新动画效果
        this.highlightUpdatedFields(updateData);
    }

    /**
     * 生成基础实时表格
     */
    generateBaseRealtimeTable() {
        const tableContent = document.getElementById('realtimeTableContent');
        const employee = this.currentEmployee;
        const employeeSummary = window.employeeManager.getEmployeeSummary(employee);

        const html = `
            <div class="realtime-table">
                <div class="leave-form">
                    <div class="form-header">
                        <h2>员工请假申请表</h2>
                        <div class="form-id">申请编号：${this.generateApplicationId()}</div>
                    </div>
                    
                    <div class="standard-table-section">
                        <h3>📋 请假信息表（实时更新）</h3>
                        <table class="standard-leave-table" id="realtimeStandardTable">
                            <tbody>
                                <tr>
                                    <td class="field-label">员工姓名</td>
                                    <td class="field-value" id="rt-employeeName">${employeeSummary.basic.name}</td>
                                    <td class="field-label">工号</td>
                                    <td class="field-value" id="rt-employeeId">${employeeSummary.basic.id}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">请假类型</td>
                                    <td class="field-value" id="rt-leaveType">
                                        <span class="placeholder-text">请选择假期类型</span>
                                    </td>
                                    <td class="field-label">请假时长</td>
                                    <td class="field-value" id="rt-leaveDays">
                                        <span class="placeholder-text">待确定</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-label">请假日期</td>
                                    <td class="field-value" colspan="3" id="rt-leaveDates">
                                        <span class="placeholder-text">请提供请假日期</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-label">剩余年假时长</td>
                                    <td class="field-value balance-highlight">${employeeSummary.leave.remainingAnnualLeave} 天</td>
                                    <td class="field-label">申请时间</td>
                                    <td class="field-value" id="rt-applicationTime">${TimeUtils.formatDateTime(TimeUtils.getCurrentTime())}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">请假原因</td>
                                    <td class="field-value" colspan="3" id="rt-reason">
                                        <span class="placeholder-text">待填写</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        tableContent.innerHTML = html;
    }

    /**
     * 更新表格字段
     */
    updateTableFields(updateData) {
        if (updateData.leaveType) {
            const leaveTypeCell = document.getElementById('rt-leaveType');
            if (leaveTypeCell) {
                leaveTypeCell.innerHTML = `<span class="leave-type">${updateData.leaveType}</span>`;
                leaveTypeCell.classList.add('realtime-update');
                this.addUpdateIndicator(leaveTypeCell);
            }
        }

        if (updateData.startDate || updateData.endDate) {
            const datesCell = document.getElementById('rt-leaveDates');
            if (datesCell) {
                const startDate = updateData.startDate || this.realtimeLeaveInfo.startDate || '开始日期';
                const endDate = updateData.endDate || this.realtimeLeaveInfo.endDate || '结束日期';
                datesCell.innerHTML = `${startDate} 至 ${endDate}`;
                datesCell.classList.add('realtime-update');
                this.addUpdateIndicator(datesCell);
                
                // 如果有完整日期，计算天数
                if (this.realtimeLeaveInfo.startDate && this.realtimeLeaveInfo.endDate) {
                    const validation = TimeUtils.validateLeaveDate(this.realtimeLeaveInfo.startDate, this.realtimeLeaveInfo.endDate);
                    if (validation.valid) {
                        this.realtimeLeaveInfo.days = validation.days;
                        const daysCell = document.getElementById('rt-leaveDays');
                        if (daysCell) {
                            daysCell.innerHTML = `<span class="leave-days">${validation.days} 天</span>`;
                            daysCell.classList.add('realtime-update');
                            this.addUpdateIndicator(daysCell);
                        }
                    }
                }
            }
        }

        if (updateData.days) {
            const daysCell = document.getElementById('rt-leaveDays');
            if (daysCell) {
                daysCell.innerHTML = `<span class="leave-days">${updateData.days} 天</span>`;
                daysCell.classList.add('realtime-update');
                this.addUpdateIndicator(daysCell);
            }
        }

        if (updateData.reason) {
            const reasonCell = document.getElementById('rt-reason');
            if (reasonCell) {
                reasonCell.textContent = updateData.reason;
                reasonCell.classList.add('realtime-update');
                this.addUpdateIndicator(reasonCell);
            }
        }

        // 更新申请时间为当前时间
        const timeCell = document.getElementById('rt-applicationTime');
        if (timeCell) {
            timeCell.textContent = TimeUtils.formatDateTime(TimeUtils.getCurrentTime());
        }

        // 显示更新提示
        this.showToast('📝 表格已更新', 'success');
    }

    /**
     * 高亮更新的字段
     */
    highlightUpdatedFields(updateData) {
        // 移除之前的高亮效果
        setTimeout(() => {
            document.querySelectorAll('.realtime-update').forEach(el => {
                el.classList.remove('realtime-update');
            });
        }, 600);
    }

    /**
     * 添加聊天消息（分栏模式）
     */
    addMessageInline(sender, content, messageId = null) {
        const messagesContainer = document.getElementById('chatMessagesInline');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        
        // 如果是AI消息且没有提供ID，生成一个唯一ID用于流式更新
        if (sender === 'ai' && !messageId) {
            messageId = 'ai-message-inline-' + Date.now();
        }
        
        if (messageId) {
            messageDiv.id = messageId;
        }

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        bubbleDiv.innerHTML = content.replace(/\n/g, '<br>');

        messageDiv.appendChild(bubbleDiv);
        messagesContainer.appendChild(messageDiv);

        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return messageId;
    }

    /**
     * 重置聊天（分栏模式）
     */
    resetChatInline() {
        // 清除分栏聊天记录
        const messagesContainer = document.getElementById('chatMessagesInline');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        this.chatHistory = [];
        this.realtimeLeaveInfo = null;
        
        // 重置状态
        this.currentEmployee = null;
        this.leaveRequest = null;
        
        // 返回身份验证界面
        this.hideSection('chatTableSection');
        this.showSection('authSection');
        
        // 清空输入框
        document.getElementById('employeeName').value = '';
        document.getElementById('authStatus').style.display = 'none';
    }

    /**
     * 编辑模式切换（分栏模式）
     */
    toggleEditModeInline() {
        const table = document.getElementById('realtimeStandardTable');
        const editBtn = document.getElementById('editBtnInline');
        const saveBtn = document.getElementById('saveBtnInline');

        if (!table) {
            this.showToast('请先生成表格再进行编辑', 'warning');
            return;
        }

        if (table.classList.contains('edit-mode')) {
            // 退出编辑模式
            this.exitEditModeInline();
        } else {
            // 进入编辑模式
            table.classList.add('edit-mode');
            editBtn.innerHTML = '<i class="fas fa-times"></i> 取消编辑';
            saveBtn.classList.remove('hidden');
            
            // 将静态文本转换为可编辑字段
            this.makeTableEditable();
            this.showToast('编辑模式已开启', 'success');
        }
    }

    /**
     * 使表格可编辑
     */
    makeTableEditable() {
        // 请假类型编辑
        const leaveTypeCell = document.getElementById('rt-leaveType');
        if (leaveTypeCell && !leaveTypeCell.querySelector('select')) {
            const currentType = leaveTypeCell.textContent.trim();
            leaveTypeCell.innerHTML = `
                <select class="editable-field">
                    <option value="年假" ${currentType === '年假' ? 'selected' : ''}>年假</option>
                    <option value="病假" ${currentType === '病假' ? 'selected' : ''}>病假</option>
                    <option value="事假" ${currentType === '事假' ? 'selected' : ''}>事假</option>
                    <option value="婚假" ${currentType === '婚假' ? 'selected' : ''}>婚假</option>
                    <option value="产假" ${currentType === '产假' ? 'selected' : ''}>产假</option>
                    <option value="陪产假" ${currentType === '陪产假' ? 'selected' : ''}>陪产假</option>
                    <option value="丧假" ${currentType === '丧假' ? 'selected' : ''}>丧假</option>
                    <option value="调休假" ${currentType === '调休假' ? 'selected' : ''}>调休假</option>
                </select>
            `;
        }

        // 请假天数编辑
        const daysCell = document.getElementById('rt-leaveDays');
        if (daysCell && !daysCell.querySelector('input')) {
            const currentDays = daysCell.textContent.match(/\d+/);
            daysCell.innerHTML = `<input type="number" class="editable-field" value="${currentDays ? currentDays[0] : ''}" min="1" max="365"> 天`;
        }

        // 请假原因编辑
        const reasonCell = document.getElementById('rt-reason');
        if (reasonCell && !reasonCell.querySelector('textarea')) {
            const currentReason = reasonCell.textContent.trim();
            reasonCell.innerHTML = `<textarea class="editable-field" rows="2">${currentReason === '待填写' ? '' : currentReason}</textarea>`;
        }
    }

    /**
     * 退出编辑模式（分栏模式）
     */
    exitEditModeInline() {
        const table = document.getElementById('realtimeStandardTable');
        const editBtn = document.getElementById('editBtnInline');
        const saveBtn = document.getElementById('saveBtnInline');

        table.classList.remove('edit-mode');
        editBtn.innerHTML = '<i class="fas fa-edit"></i> 编辑表格';
        saveBtn.classList.add('hidden');
    }

    /**
     * 保存编辑（分栏模式）
     */
    saveEditedFormInline() {
        try {
            // 收集编辑的数据
            const editedData = {};

            const leaveTypeSelect = document.querySelector('#rt-leaveType select');
            if (leaveTypeSelect) {
                editedData.leaveType = leaveTypeSelect.value;
            }

            const daysInput = document.querySelector('#rt-leaveDays input');
            if (daysInput) {
                editedData.days = parseInt(daysInput.value);
            }

            const reasonTextarea = document.querySelector('#rt-reason textarea');
            if (reasonTextarea) {
                editedData.reason = reasonTextarea.value;
            }

            // 更新实时请假信息
            Object.assign(this.realtimeLeaveInfo, editedData);

            // 重新生成表格显示
            this.generateBaseRealtimeTable();
            this.updateTableFields(editedData);

            // 退出编辑模式
            this.exitEditModeInline();

            this.showToast('表格已保存！', 'success');

        } catch (error) {
            console.error('Save form error:', error);
            this.showToast('保存失败，请重试', 'error');
        }
    }

    /**
     * 下载图片（分栏模式）
     */
    async downloadAsImageInline() {
        try {
            this.showLoading('正在生成图片...');
            
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas库未正确加载，无法生成图片');
            }
            
            const element = document.querySelector('#realtimeTableContent .realtime-table');
            if (!element) {
                throw new Error('请先生成表格再下载');
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                allowTaint: true,
                logging: false
            });

            const today = new Date();
            const dateStr = today.getFullYear() + '-' + 
                           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(today.getDate()).padStart(2, '0');
            const employeeName = this.realtimeLeaveInfo?.employee?.name || '员工';
            
            const link = document.createElement('a');
            link.download = `请假申请表_${employeeName}_${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            this.showToast('图片下载成功！', 'success');
        } catch (error) {
            console.error('Download image error:', error);
            this.showToast(`图片下载失败：${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 下载PDF（分栏模式）
     */
    async downloadAsPdfInline() {
        try {
            this.showLoading('正在生成PDF...');

            if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
                throw new Error('jsPDF库未正确加载，请刷新页面重试');
            }

            const element = document.querySelector('#realtimeTableContent .realtime-table');
            if (!element) {
                throw new Error('请先生成表格再下载');
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                allowTaint: true,
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const margin = 10;
            const availableWidth = pdfWidth - 2 * margin;
            const availableHeight = pdfHeight - 2 * margin;
            
            const pixelToMm = 0.264583;
            const imgWidthMm = (canvas.width / 2) * pixelToMm;
            const imgHeightMm = (canvas.height / 2) * pixelToMm;
            
            const widthRatio = availableWidth / imgWidthMm;
            const heightRatio = availableHeight / imgHeightMm;
            const ratio = Math.min(widthRatio, heightRatio);
            
            const finalWidth = imgWidthMm * ratio;
            const finalHeight = imgHeightMm * ratio;
            
            const imgX = (pdfWidth - finalWidth) / 2;
            const imgY = margin;

            pdf.addImage(imgData, 'PNG', imgX, imgY, finalWidth, finalHeight);

            const today = new Date();
            const dateStr = today.getFullYear() + '-' + 
                           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(today.getDate()).padStart(2, '0');
            const employeeName = this.realtimeLeaveInfo?.employee?.name || '员工';
            const fileName = `请假申请表_${employeeName}_${dateStr}.pdf`;
            
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
     * 生成完整的实时表格（当收集到完整信息时）
     */
    async generateRealtimeTable(completeData) {
        // 更新实时请假信息为完整数据
        Object.assign(this.realtimeLeaveInfo, completeData);
        
        // 确保申请时间为当前时间
        this.realtimeLeaveInfo.applicationTime = TimeUtils.formatDateTime(TimeUtils.getCurrentTime());
        this.realtimeLeaveInfo.applicationDate = TimeUtils.formatDate(TimeUtils.getCurrentTime());
        
        console.log('生成完整实时表格:', this.realtimeLeaveInfo);
        
        // 如果表格还没生成，先生成基础表格
        const tableContent = document.getElementById('realtimeTableContent');
        if (tableContent.querySelector('.table-placeholder')) {
            this.generateBaseRealtimeTable();
        }
        
        // 更新所有字段
        this.updateTableFields(completeData);
        
        // 生成完整的请假摘要
        if (this.realtimeLeaveInfo.leaveType && this.realtimeLeaveInfo.startDate && this.realtimeLeaveInfo.endDate) {
            try {
                // 创建标准请假申请对象用于生成摘要
                const leaveRequest = {
                    employee: this.currentEmployee,
                    leaveType: this.realtimeLeaveInfo.leaveType,
                    startDate: this.realtimeLeaveInfo.startDate,
                    endDate: this.realtimeLeaveInfo.endDate,
                    days: this.realtimeLeaveInfo.days,
                    reason: this.realtimeLeaveInfo.reason || '个人事务',
                    advanceNoticeDays: TimeUtils.calculateAdvanceNoticeDays(this.realtimeLeaveInfo.startDate),
                    applicationTime: this.realtimeLeaveInfo.applicationTime,
                    applicationDate: this.realtimeLeaveInfo.applicationDate
                };
                
                // 生成详细摘要
                const summary = window.leaveRulesEngine.generateLeaveSummary(leaveRequest);
                
                // 更新表格为完整版本
                this.showCompleteRealtimeTable(summary);
                
                // 保存请假记录
                this.saveLeaveRecord(summary);
                
                this.showToast('✅ 完整请假表格已生成！', 'success');
                
            } catch (error) {
                console.error('Generate complete table error:', error);
                this.showToast('生成完整表格时出错，请检查信息是否完整', 'error');
            }
        }
    }

    /**
     * 显示完整的实时表格（包含审批流程等详细信息）
     */
    showCompleteRealtimeTable(summary) {
        const tableContent = document.getElementById('realtimeTableContent');
        const employee = summary.employee;
        const employeeSummary = window.employeeManager.getEmployeeSummary(employee);

        const html = `
            <div class="realtime-table">
                <div class="leave-form">
                    <div class="form-header">
                        <h2>员工请假申请表</h2>
                        <div class="form-id">申请编号：${this.generateApplicationId()}</div>
                    </div>
                    
                    <!-- 核心表格区域 -->
                    <div class="standard-table-section">
                        <h3>📋 请假信息表</h3>
                        <table class="standard-leave-table" id="realtimeStandardTable">
                            <tbody>
                                <tr>
                                    <td class="field-label">员工姓名</td>
                                    <td class="field-value" id="rt-employeeName">${employeeSummary.basic.name}</td>
                                    <td class="field-label">工号</td>
                                    <td class="field-value" id="rt-employeeId">${employeeSummary.basic.id}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">请假类型</td>
                                    <td class="field-value leave-type" id="rt-leaveType">${summary.leaveType}</td>
                                    <td class="field-label">请假时长</td>
                                    <td class="field-value leave-days" id="rt-leaveDays">${summary.days} 天</td>
                                </tr>
                                <tr>
                                    <td class="field-label">请假日期</td>
                                    <td class="field-value" colspan="3" id="rt-leaveDates">${summary.startDate} 至 ${summary.endDate}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">剩余年假时长</td>
                                    <td class="field-value balance-highlight">${employeeSummary.leave.remainingAnnualLeave} 天</td>
                                    <td class="field-label">申请时间</td>
                                    <td class="field-value" id="rt-applicationTime">${summary.applicationTime}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">请假原因</td>
                                    <td class="field-value" colspan="3" id="rt-reason">${summary.reason || '个人事务'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- 详细信息区域 -->
                    <div class="info-section">
                        <h3>员工详细信息</h3>
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

                    <!-- 审批流程 -->
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
            </div>
        `;

        tableContent.innerHTML = html;
    }

    /**
     * 添加实时更新的视觉反馈
     */
    addUpdateIndicator(element) {
        // 移除之前的指示器
        const existingIndicator = element.querySelector('.update-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // 添加新的更新指示器
        const indicator = document.createElement('div');
        indicator.className = 'update-indicator';
        element.style.position = 'relative';
        element.appendChild(indicator);
        
        // 3秒后自动移除指示器
        setTimeout(() => {
            indicator.remove();
        }, 3000);
    }

    /**
     * 优化的智能信息提取
     */
    async enhancedSmartExtract(aiResponse, userMessage) {
        const combinedText = `${userMessage} ${aiResponse}`;
        
        // 更精确的日期匹配
        const datePatterns = [
            /(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/g,
            /(明天|后天|大后天)/g,
            /(下周[一二三四五六日])/g,
            /([一二三四五六七八九十]{1,2}月[一二三四五六七八九十]{1,2}[日号])/g
        ];
        
        // 更精确的请假类型匹配
        const leaveTypePatterns = {
            年假: /年假|年休假|带薪假期/,
            病假: /病假|看病|生病|身体不适|医院|治疗/,
            事假: /事假|个人事务|家事|私事/,
            婚假: /婚假|结婚|新婚/,
            产假: /产假|生孩子|分娩/,
            陪产假: /陪产假|陪护假|护理假/,
            丧假: /丧假|葬礼|吊唁|亲人去世/,
            调休假: /调休|倒休|补休/
        };
        
        const updateData = {};
        
        // 检测请假类型
        for (const [type, pattern] of Object.entries(leaveTypePatterns)) {
            if (pattern.test(combinedText) && type !== this.realtimeLeaveInfo?.leaveType) {
                updateData.leaveType = type;
                break;
            }
        }
        
        // 检测日期
        let detectedDates = [];
        datePatterns.forEach(pattern => {
            const matches = combinedText.match(pattern);
            if (matches) {
                detectedDates = detectedDates.concat(matches);
            }
        });
        
        if (detectedDates.length > 0) {
            // 处理相对日期
            const today = new Date();
            const processedDates = detectedDates.map(date => {
                if (date === '明天') {
                    const tomorrow = new Date(today);
                    tomorrow.setDate(today.getDate() + 1);
                    return TimeUtils.formatDate(tomorrow);
                } else if (date === '后天') {
                    const dayAfterTomorrow = new Date(today);
                    dayAfterTomorrow.setDate(today.getDate() + 2);
                    return TimeUtils.formatDate(dayAfterTomorrow);
                }
                // 标准化日期格式
                return date.replace(/[年月]/g, '-').replace(/[日号]/g, '');
            });
            
            if (processedDates[0] !== this.realtimeLeaveInfo?.startDate) {
                updateData.startDate = processedDates[0];
            }
            if (processedDates[1] && processedDates[1] !== this.realtimeLeaveInfo?.endDate) {
                updateData.endDate = processedDates[1];
            }
        }
        
        // 检测原因
        const reasonKeywords = ['因为', '由于', '原因是', '需要'];
        for (const keyword of reasonKeywords) {
            const index = combinedText.indexOf(keyword);
            if (index !== -1) {
                const reasonText = combinedText.substring(index + keyword.length, index + 50).trim();
                if (reasonText && reasonText !== this.realtimeLeaveInfo?.reason) {
                    updateData.reason = reasonText.split(/[，。！？\n]/)[0];
                    break;
                }
            }
        }
        
        return updateData;
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