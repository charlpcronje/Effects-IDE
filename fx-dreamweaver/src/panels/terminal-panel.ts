/**
 * Terminal Panel - PTY terminal emulator
 */

import { Panel, PanelConfig } from './panel';
import { SceneManager } from '../scene/scene-manager';
import { FXBridge } from '../renderer/fx-bridge';

export class TerminalPanel extends Panel {
    private outputElement: HTMLElement | null = null;
    private inputElement: HTMLInputElement | null = null;
    private sessionId: string | null = null;
    private commandHistory: string[] = [];
    private historyIndex: number = -1;
    private buffer: string = '';

    constructor(config: PanelConfig, sceneManager: SceneManager, fxBridge: FXBridge) {
        super(config, sceneManager, fxBridge);
    }

    async init(): Promise<void> {
        await super.init();
        this.createTerminalUI();
        await this.startSession();
    }

    /**
     * Create terminal UI
     */
    private createTerminalUI(): void {
        const content = this.getContentElement();
        if (!content) return;

        content.style.padding = '0';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.innerHTML = '';

        // Output area
        this.outputElement = document.createElement('div');
        this.outputElement.className = 'terminal-output';
        this.outputElement.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            line-height: 1.4;
            color: var(--text, #f1f5f9);
            background: var(--background, #0f172a);
            white-space: pre-wrap;
            word-break: break-all;
        `;
        content.appendChild(this.outputElement);

        // Input line
        const inputLine = document.createElement('div');
        inputLine.className = 'terminal-input-line';
        inputLine.style.cssText = `
            display: flex;
            align-items: center;
            padding: 8px;
            background: var(--background, #0f172a);
            border-top: 1px solid var(--border, #334155);
        `;

        // Prompt
        const prompt = document.createElement('span');
        prompt.className = 'terminal-prompt';
        prompt.style.cssText = `
            color: var(--primary, #3b82f6);
            margin-right: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
        `;
        prompt.textContent = '$ ';
        inputLine.appendChild(prompt);

        // Input
        this.inputElement = document.createElement('input');
        this.inputElement.className = 'terminal-input';
        this.inputElement.type = 'text';
        this.inputElement.style.cssText = `
            flex: 1;
            background: transparent;
            border: none;
            color: var(--text, #f1f5f9);
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            outline: none;
        `;
        this.inputElement.addEventListener('keydown', (e) => this.handleKeyDown(e));
        inputLine.appendChild(this.inputElement);

        content.appendChild(inputLine);

        // Focus input when clicking output
        this.outputElement.addEventListener('click', () => {
            this.inputElement?.focus();
        });
    }

    /**
     * Start PTY session
     */
    private async startSession(): Promise<void> {
        try {
            const projectPath = this.fxBridge.get('workspace.projectPath');
            this.sessionId = await window.dreamweaver.pty.spawn({
                cwd: projectPath || undefined
            });

            // Listen for output
            window.dreamweaver.pty.onData(this.sessionId, (data) => {
                this.appendOutput(data);
            });

            // Listen for exit
            window.dreamweaver.pty.onExit(this.sessionId, (code) => {
                this.appendOutput(`\n[Process exited with code ${code}]\n`);
                this.sessionId = null;
            });

            this.appendOutput(`Terminal started (session: ${this.sessionId.slice(0, 8)}...)\n\n`);

        } catch (error) {
            console.error('[TerminalPanel] Failed to start session:', error);
            this.appendOutput(`[Error: Failed to start terminal session]\n`);
        }
    }

    /**
     * Handle keyboard input
     */
    private handleKeyDown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'Enter':
                this.executeCommand();
                break;

            case 'ArrowUp':
                event.preventDefault();
                this.navigateHistory(-1);
                break;

            case 'ArrowDown':
                event.preventDefault();
                this.navigateHistory(1);
                break;

            case 'c':
                if (event.ctrlKey) {
                    this.sendSignal('SIGINT');
                }
                break;

            case 'l':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.clear();
                }
                break;
        }
    }

    /**
     * Execute command
     */
    private async executeCommand(): Promise<void> {
        if (!this.inputElement || !this.sessionId) return;

        const command = this.inputElement.value.trim();
        if (!command) return;

        // Add to history
        this.commandHistory.push(command);
        this.historyIndex = this.commandHistory.length;

        // Clear input
        this.inputElement.value = '';

        // Show command in output
        this.appendOutput(`$ ${command}\n`);

        // Handle built-in commands
        if (command === 'clear') {
            this.clear();
            return;
        }

        // Send to PTY
        await window.dreamweaver.pty.write(this.sessionId, command + '\n');

        // Log to FX
        this.fxBridge.emit('terminal.command', { command, sessionId: this.sessionId });
    }

    /**
     * Navigate command history
     */
    private navigateHistory(direction: number): void {
        if (!this.inputElement || this.commandHistory.length === 0) return;

        this.historyIndex = Math.max(0, Math.min(
            this.historyIndex + direction,
            this.commandHistory.length
        ));

        if (this.historyIndex < this.commandHistory.length) {
            this.inputElement.value = this.commandHistory[this.historyIndex];
        } else {
            this.inputElement.value = '';
        }

        // Move cursor to end
        this.inputElement.selectionStart = this.inputElement.value.length;
    }

    /**
     * Append output
     */
    private appendOutput(text: string): void {
        if (!this.outputElement) return;

        this.buffer += text;
        this.outputElement.textContent = this.buffer;

        // Auto-scroll
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }

    /**
     * Clear terminal
     */
    clear(): void {
        this.buffer = '';
        if (this.outputElement) {
            this.outputElement.textContent = '';
        }
    }

    /**
     * Send signal
     */
    private async sendSignal(signal: string): Promise<void> {
        if (!this.sessionId) return;

        if (signal === 'SIGINT') {
            // Send Ctrl+C
            await window.dreamweaver.pty.write(this.sessionId, '\x03');
            this.appendOutput('^C\n');
        }
    }

    /**
     * Write to terminal
     */
    async write(text: string): Promise<void> {
        if (!this.sessionId) return;
        await window.dreamweaver.pty.write(this.sessionId, text);
    }

    /**
     * Handle events
     */
    handleEvent(event: string, data: any): void {
        switch (event) {
            case 'project:open':
                // Restart session in new directory
                this.restartSession(data.path);
                break;

            case 'terminal:execute':
                if (data.command && this.inputElement) {
                    this.inputElement.value = data.command;
                    this.executeCommand();
                }
                break;
        }
    }

    /**
     * Restart session in new directory
     */
    private async restartSession(cwd: string): Promise<void> {
        if (this.sessionId) {
            await window.dreamweaver.pty.kill(this.sessionId);
        }

        this.clear();
        this.appendOutput(`Changing directory to: ${cwd}\n\n`);

        this.sessionId = await window.dreamweaver.pty.spawn({ cwd });

        window.dreamweaver.pty.onData(this.sessionId, (data) => {
            this.appendOutput(data);
        });

        window.dreamweaver.pty.onExit(this.sessionId, (code) => {
            this.appendOutput(`\n[Process exited with code ${code}]\n`);
            this.sessionId = null;
        });
    }

    /**
     * Dispose
     */
    dispose(): void {
        if (this.sessionId) {
            window.dreamweaver.pty.kill(this.sessionId);
        }
        super.dispose();
    }
}
