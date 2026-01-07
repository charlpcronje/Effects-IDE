/**
 * Command Palette - Quick command execution interface
 */

import type { DreamweaverApp } from './app';

interface Command {
    id: string;
    label: string;
    description?: string;
    category?: string;
    shortcut?: string;
    handler: () => void;
}

export class CommandPalette {
    private app: DreamweaverApp;
    private commands: Command[] = [];
    private element: HTMLElement | null = null;
    private inputElement: HTMLInputElement | null = null;
    private listElement: HTMLElement | null = null;
    private visible: boolean = false;
    private selectedIndex: number = 0;
    private filteredCommands: Command[] = [];

    constructor(app: DreamweaverApp) {
        this.app = app;
        this.registerDefaultCommands();
        this.createUI();
    }

    /**
     * Register default commands
     */
    private registerDefaultCommands(): void {
        // File commands
        this.register({
            id: 'file.new',
            label: 'New File',
            category: 'File',
            shortcut: 'Ctrl+N',
            handler: () => console.log('New file')
        });

        this.register({
            id: 'file.open',
            label: 'Open File...',
            category: 'File',
            shortcut: 'Ctrl+O',
            handler: () => console.log('Open file')
        });

        this.register({
            id: 'file.save',
            label: 'Save',
            category: 'File',
            shortcut: 'Ctrl+S',
            handler: () => console.log('Save')
        });

        // View commands
        this.register({
            id: 'view.2d',
            label: 'Switch to 2D View',
            category: 'View',
            shortcut: 'Ctrl+1',
            handler: () => this.app.setViewMode('2d')
        });

        this.register({
            id: 'view.3d',
            label: 'Switch to 3D View',
            category: 'View',
            shortcut: 'Ctrl+2',
            handler: () => this.app.setViewMode('3d')
        });

        this.register({
            id: 'view.hybrid',
            label: 'Switch to Hybrid View',
            category: 'View',
            shortcut: 'Ctrl+3',
            handler: () => this.app.setViewMode('hybrid')
        });

        // Panel commands
        this.register({
            id: 'panel.explorer',
            label: 'Toggle Explorer Panel',
            category: 'Panels',
            handler: () => this.app.togglePanel('explorer')
        });

        this.register({
            id: 'panel.editor',
            label: 'Toggle Editor Panel',
            category: 'Panels',
            handler: () => this.app.togglePanel('editor')
        });

        this.register({
            id: 'panel.terminal',
            label: 'Toggle Terminal',
            category: 'Panels',
            shortcut: 'Ctrl+`',
            handler: () => this.app.togglePanel('terminal')
        });

        this.register({
            id: 'panel.ai',
            label: 'Toggle AI Chat',
            category: 'Panels',
            handler: () => this.app.togglePanel('ai')
        });

        // Theme commands
        this.register({
            id: 'theme.dark',
            label: 'Set Dark Theme',
            category: 'Theme',
            handler: () => this.app.getThemeManager().setTheme('dark')
        });

        this.register({
            id: 'theme.light',
            label: 'Set Light Theme',
            category: 'Theme',
            handler: () => this.app.getThemeManager().setTheme('light')
        });

        this.register({
            id: 'theme.lab',
            label: 'Open Theme Lab',
            category: 'Theme',
            handler: () => this.app.togglePanel('theme-lab')
        });

        // Git commands
        this.register({
            id: 'git.status',
            label: 'Git: Status',
            category: 'Git',
            handler: () => console.log('Git status')
        });

        this.register({
            id: 'git.commit',
            label: 'Git: Commit',
            category: 'Git',
            handler: () => console.log('Git commit')
        });

        // AI commands
        this.register({
            id: 'ai.chat',
            label: 'Open AI Chat',
            category: 'AI',
            handler: () => this.app.togglePanel('ai')
        });

        this.register({
            id: 'ai.explain',
            label: 'AI: Explain Selection',
            category: 'AI',
            handler: () => console.log('AI explain')
        });
    }

    /**
     * Register a command
     */
    register(command: Command): void {
        this.commands.push(command);
    }

    /**
     * Create UI elements
     */
    private createUI(): void {
        // Container
        this.element = document.createElement('div');
        this.element.className = 'command-palette';
        this.element.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            width: 600px;
            max-height: 400px;
            background: var(--surface, #1e293b);
            border: 1px solid var(--border, #334155);
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            display: none;
            flex-direction: column;
            z-index: 10000;
        `;

        // Input container
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            padding: 12px;
            border-bottom: 1px solid var(--border, #334155);
        `;

        // Input
        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.placeholder = 'Type a command...';
        this.inputElement.style.cssText = `
            width: 100%;
            background: transparent;
            border: none;
            font-size: 16px;
            color: var(--text, #f1f5f9);
            outline: none;
        `;

        this.inputElement.addEventListener('input', () => this.filter());
        this.inputElement.addEventListener('keydown', (e) => this.handleKeyDown(e));

        inputContainer.appendChild(this.inputElement);
        this.element.appendChild(inputContainer);

        // Command list
        this.listElement = document.createElement('div');
        this.listElement.className = 'command-list';
        this.listElement.style.cssText = `
            overflow-y: auto;
            max-height: 300px;
        `;

        this.element.appendChild(this.listElement);
        document.body.appendChild(this.element);

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (this.visible && !this.element?.contains(e.target as Node)) {
                this.hide();
            }
        });
    }

    /**
     * Show command palette
     */
    show(): void {
        if (!this.element || !this.inputElement) return;

        this.visible = true;
        this.element.style.display = 'flex';
        this.inputElement.value = '';
        this.filter();
        this.inputElement.focus();
    }

    /**
     * Hide command palette
     */
    hide(): void {
        if (!this.element) return;

        this.visible = false;
        this.element.style.display = 'none';
    }

    /**
     * Filter commands based on input
     */
    private filter(): void {
        const query = this.inputElement?.value.toLowerCase() || '';

        this.filteredCommands = this.commands.filter(cmd => {
            const label = cmd.label.toLowerCase();
            const category = (cmd.category || '').toLowerCase();
            return label.includes(query) || category.includes(query);
        });

        this.selectedIndex = 0;
        this.renderList();
    }

    /**
     * Render command list
     */
    private renderList(): void {
        if (!this.listElement) return;

        this.listElement.innerHTML = '';

        this.filteredCommands.forEach((cmd, index) => {
            const item = document.createElement('div');
            item.className = 'command-item';
            item.style.cssText = `
                padding: 10px 12px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: ${index === this.selectedIndex ? 'var(--primary, #3b82f6)' : 'transparent'};
            `;

            const label = document.createElement('span');
            label.textContent = cmd.label;
            label.style.color = 'var(--text, #f1f5f9)';

            const shortcut = document.createElement('span');
            shortcut.textContent = cmd.shortcut || '';
            shortcut.style.cssText = `
                color: var(--text-secondary, #94a3b8);
                font-size: 12px;
            `;

            item.appendChild(label);
            item.appendChild(shortcut);

            item.addEventListener('click', () => this.execute(cmd));
            item.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.renderList();
            });

            this.listElement!.appendChild(item);
        });
    }

    /**
     * Handle keyboard navigation
     */
    private handleKeyDown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
                this.renderList();
                break;

            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.renderList();
                break;

            case 'Enter':
                event.preventDefault();
                if (this.filteredCommands[this.selectedIndex]) {
                    this.execute(this.filteredCommands[this.selectedIndex]);
                }
                break;

            case 'Escape':
                this.hide();
                break;
        }
    }

    /**
     * Execute a command
     */
    private execute(command: Command): void {
        this.hide();
        command.handler();
    }
}
