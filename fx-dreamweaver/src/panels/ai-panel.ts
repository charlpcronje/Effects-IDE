/**
 * AI Panel - AI assistant chat interface
 */

import { Panel, PanelConfig } from './panel';
import { SceneManager } from '../scene/scene-manager';
import { FXBridge } from '../renderer/fx-bridge';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    pending?: boolean;
}

interface AISession {
    id: string;
    model: string;
    messages: Message[];
    created: number;
}

export class AIPanel extends Panel {
    private messagesElement: HTMLElement | null = null;
    private inputElement: HTMLTextAreaElement | null = null;
    private session: AISession | null = null;
    private currentModel: string = 'claude-3.5-sonnet';

    constructor(config: PanelConfig, sceneManager: SceneManager, fxBridge: FXBridge) {
        super(config, sceneManager, fxBridge);
    }

    async init(): Promise<void> {
        await super.init();
        this.createAIUI();
        this.createSession();
    }

    /**
     * Create AI chat UI
     */
    private createAIUI(): void {
        const content = this.getContentElement();
        if (!content) return;

        content.style.padding = '0';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.innerHTML = '';

        // Header with model selector
        const header = document.createElement('div');
        header.className = 'ai-header';
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border-bottom: 1px solid var(--border, #334155);
            background: var(--background, #0f172a);
        `;

        const modelSelect = document.createElement('select');
        modelSelect.style.cssText = `
            background: var(--surface, #1e293b);
            border: 1px solid var(--border, #334155);
            color: var(--text, #f1f5f9);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
        `;

        const models = [
            { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
            { id: 'gpt-4.1-turbo', name: 'GPT-4.1 Turbo' }
        ];

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });

        modelSelect.addEventListener('change', () => {
            this.currentModel = modelSelect.value;
            this.fxBridge.set('ai.currentModel', this.currentModel);
        });

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.style.cssText = `
            background: transparent;
            border: 1px solid var(--border, #334155);
            color: var(--text, #f1f5f9);
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        clearBtn.addEventListener('click', () => this.clearSession());

        header.appendChild(modelSelect);
        header.appendChild(clearBtn);
        content.appendChild(header);

        // Messages area
        this.messagesElement = document.createElement('div');
        this.messagesElement.className = 'ai-messages';
        this.messagesElement.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        content.appendChild(this.messagesElement);

        // Input area
        const inputArea = document.createElement('div');
        inputArea.className = 'ai-input-area';
        inputArea.style.cssText = `
            padding: 12px;
            border-top: 1px solid var(--border, #334155);
            background: var(--background, #0f172a);
        `;

        this.inputElement = document.createElement('textarea');
        this.inputElement.placeholder = 'Ask anything... (Shift+Enter for new line)';
        this.inputElement.style.cssText = `
            width: 100%;
            background: var(--surface, #1e293b);
            border: 1px solid var(--border, #334155);
            color: var(--text, #f1f5f9);
            padding: 10px;
            border-radius: 8px;
            font-size: 13px;
            resize: none;
            outline: none;
            min-height: 60px;
            max-height: 150px;
        `;
        this.inputElement.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.inputElement.addEventListener('input', () => this.autoResize());

        inputArea.appendChild(this.inputElement);
        content.appendChild(inputArea);

        // Add welcome message
        this.addMessage({
            id: 'welcome',
            role: 'assistant',
            content: 'Hello! I\'m your AI assistant. I can help you with:\n\n' +
                '- Writing and reviewing code\n' +
                '- Debugging issues\n' +
                '- Explaining concepts\n' +
                '- Running commands\n\n' +
                'How can I help you today?',
            timestamp: Date.now()
        });
    }

    /**
     * Create new session
     */
    private createSession(): void {
        this.session = {
            id: `session-${Date.now()}`,
            model: this.currentModel,
            messages: [],
            created: Date.now()
        };

        this.fxBridge.set(`ai.sessions.${this.session.id}`, this.session);
    }

    /**
     * Handle keyboard input
     */
    private handleKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    /**
     * Auto-resize textarea
     */
    private autoResize(): void {
        if (!this.inputElement) return;
        this.inputElement.style.height = 'auto';
        this.inputElement.style.height = Math.min(this.inputElement.scrollHeight, 150) + 'px';
    }

    /**
     * Send message
     */
    private async sendMessage(): Promise<void> {
        if (!this.inputElement || !this.session) return;

        const content = this.inputElement.value.trim();
        if (!content) return;

        // Add user message
        const userMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content,
            timestamp: Date.now()
        };
        this.addMessage(userMessage);
        this.session.messages.push(userMessage);

        // Clear input
        this.inputElement.value = '';
        this.autoResize();

        // Add pending assistant message
        const pendingMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant',
            content: 'Thinking...',
            timestamp: Date.now(),
            pending: true
        };
        this.addMessage(pendingMessage);

        // Simulate AI response (in real implementation, this would call the MCP bridge)
        await this.simulateResponse(userMessage, pendingMessage.id);
    }

    /**
     * Simulate AI response
     */
    private async simulateResponse(userMessage: Message, pendingId: string): Promise<void> {
        // Simulate thinking delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

        // Generate response based on input
        let response = '';

        const input = userMessage.content.toLowerCase();

        if (input.includes('hello') || input.includes('hi')) {
            response = 'Hello! How can I help you with your code today?';
        } else if (input.includes('help')) {
            response = 'I can help you with:\n\n' +
                '**Code Assistance**\n' +
                '- Write new code\n' +
                '- Review existing code\n' +
                '- Fix bugs and errors\n\n' +
                '**Project Tasks**\n' +
                '- Run terminal commands\n' +
                '- Search files\n' +
                '- Edit configurations\n\n' +
                'Just describe what you need!';
        } else if (input.includes('run') || input.includes('execute')) {
            response = 'I can run commands for you! Just specify the command you\'d like me to execute.\n\n' +
                'For example:\n' +
                '- "Run npm install"\n' +
                '- "Run the tests"\n' +
                '- "Build the project"';
        } else {
            response = `I understand you want to: "${userMessage.content}"\n\n` +
                'In a full implementation, I would:\n' +
                '1. Analyze your request\n' +
                '2. Access project context via MCP\n' +
                '3. Execute necessary actions\n' +
                '4. Report results\n\n' +
                'Is there anything specific you\'d like me to help with?';
        }

        // Update pending message
        this.updateMessage(pendingId, response);

        // Log to FX
        this.fxBridge.emit('ai.response', {
            sessionId: this.session?.id,
            userMessage: userMessage.content,
            response
        });
    }

    /**
     * Add message to UI
     */
    private addMessage(message: Message): void {
        if (!this.messagesElement) return;

        const element = document.createElement('div');
        element.id = `message-${message.id}`;
        element.className = `ai-message ai-message-${message.role}`;
        element.style.cssText = `
            padding: 12px;
            border-radius: 8px;
            max-width: 90%;
            align-self: ${message.role === 'user' ? 'flex-end' : 'flex-start'};
            background: ${message.role === 'user' ? 'var(--primary, #3b82f6)' : 'var(--surface, #1e293b)'};
            color: var(--text, #f1f5f9);
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-break: break-word;
        `;

        if (message.pending) {
            element.style.opacity = '0.7';
        }

        element.textContent = message.content;
        this.messagesElement.appendChild(element);

        // Scroll to bottom
        this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }

    /**
     * Update message
     */
    private updateMessage(messageId: string, content: string): void {
        const element = document.getElementById(`message-${messageId}`);
        if (element) {
            element.textContent = content;
            element.style.opacity = '1';
        }
    }

    /**
     * Clear session
     */
    private clearSession(): void {
        if (this.messagesElement) {
            this.messagesElement.innerHTML = '';
        }

        this.createSession();

        this.addMessage({
            id: 'cleared',
            role: 'system',
            content: 'Chat cleared. How can I help you?',
            timestamp: Date.now()
        });
    }

    /**
     * Handle events
     */
    handleEvent(event: string, data: any): void {
        switch (event) {
            case 'ai:ask':
                if (data.question && this.inputElement) {
                    this.inputElement.value = data.question;
                    this.sendMessage();
                }
                break;

            case 'menu:ai-model':
                if (data) {
                    this.currentModel = data;
                    this.fxBridge.set('ai.currentModel', this.currentModel);
                }
                break;
        }
    }
}
