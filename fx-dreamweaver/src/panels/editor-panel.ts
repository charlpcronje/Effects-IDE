/**
 * Editor Panel - Code editing panel
 */

import { Panel, PanelConfig } from './panel';
import { SceneManager } from '../scene/scene-manager';
import { FXBridge } from '../renderer/fx-bridge';

interface EditorTab {
    id: string;
    path: string;
    name: string;
    content: string;
    dirty: boolean;
    language: string;
}

export class EditorPanel extends Panel {
    private tabs: EditorTab[] = [];
    private activeTabId: string | null = null;
    private tabsElement: HTMLElement | null = null;
    private editorElement: HTMLTextAreaElement | null = null;

    constructor(config: PanelConfig, sceneManager: SceneManager, fxBridge: FXBridge) {
        super(config, sceneManager, fxBridge);
    }

    async init(): Promise<void> {
        await super.init();
        this.createEditorUI();
    }

    /**
     * Create editor UI
     */
    private createEditorUI(): void {
        const content = this.getContentElement();
        if (!content) return;

        content.style.padding = '0';
        content.innerHTML = '';

        // Tabs bar
        this.tabsElement = document.createElement('div');
        this.tabsElement.className = 'editor-tabs';
        this.tabsElement.style.cssText = `
            display: flex;
            background: var(--background, #0f172a);
            border-bottom: 1px solid var(--border, #334155);
            height: 32px;
            overflow-x: auto;
        `;
        content.appendChild(this.tabsElement);

        // Editor area
        const editorContainer = document.createElement('div');
        editorContainer.className = 'editor-container';
        editorContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;

        // Line numbers
        const lineNumbers = document.createElement('div');
        lineNumbers.className = 'line-numbers';
        lineNumbers.style.cssText = `
            width: 40px;
            background: var(--background, #0f172a);
            color: var(--text-secondary, #64748b);
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            line-height: 1.5;
            padding: 8px 4px;
            text-align: right;
            user-select: none;
        `;

        // Editor wrapper
        const editorWrapper = document.createElement('div');
        editorWrapper.style.cssText = `
            display: flex;
            flex: 1;
            overflow: hidden;
        `;

        // Text area
        this.editorElement = document.createElement('textarea');
        this.editorElement.className = 'editor-textarea';
        this.editorElement.spellcheck = false;
        this.editorElement.style.cssText = `
            flex: 1;
            background: var(--surface, #1e293b);
            color: var(--text, #f1f5f9);
            border: none;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            line-height: 1.5;
            padding: 8px;
            resize: none;
            outline: none;
            tab-size: 4;
        `;

        this.editorElement.addEventListener('input', () => this.handleInput());
        this.editorElement.addEventListener('scroll', () => this.syncLineNumbers(lineNumbers));
        this.editorElement.addEventListener('keydown', (e) => this.handleKeyDown(e));

        editorWrapper.appendChild(lineNumbers);
        editorWrapper.appendChild(this.editorElement);
        editorContainer.appendChild(editorWrapper);
        content.appendChild(editorContainer);

        // Update line numbers
        this.syncLineNumbers(lineNumbers);
    }

    /**
     * Open a file
     */
    async openFile(path: string): Promise<void> {
        // Check if already open
        const existing = this.tabs.find(t => t.path === path);
        if (existing) {
            this.activateTab(existing.id);
            return;
        }

        try {
            const content = await window.dreamweaver.fs.read(path);
            const name = path.split('/').pop() || 'untitled';
            const language = this.detectLanguage(name);

            const tab: EditorTab = {
                id: `tab-${Date.now()}`,
                path,
                name,
                content,
                dirty: false,
                language
            };

            this.tabs.push(tab);
            this.renderTabs();
            this.activateTab(tab.id);

            // Update FX state
            this.fxBridge.set(`workspace.files.${tab.id}`, {
                path,
                language,
                content,
                dirty: false
            });

        } catch (error) {
            console.error('[EditorPanel] Failed to open file:', error);
        }
    }

    /**
     * Save current file
     */
    async saveFile(): Promise<void> {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (!tab) return;

        try {
            await window.dreamweaver.fs.write(tab.path, tab.content);
            tab.dirty = false;
            this.renderTabs();

            this.fxBridge.set(`workspace.files.${tab.id}.dirty`, false);
            this.fxBridge.emit('file.save', { path: tab.path });

        } catch (error) {
            console.error('[EditorPanel] Failed to save file:', error);
        }
    }

    /**
     * Activate a tab
     */
    private activateTab(tabId: string): void {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab || !this.editorElement) return;

        this.activeTabId = tabId;
        this.editorElement.value = tab.content;
        this.renderTabs();

        // Sync line numbers
        const lineNumbers = this.getContentElement()?.querySelector('.line-numbers');
        if (lineNumbers) {
            this.syncLineNumbers(lineNumbers as HTMLElement);
        }
    }

    /**
     * Close a tab
     */
    private closeTab(tabId: string): void {
        const index = this.tabs.findIndex(t => t.id === tabId);
        if (index === -1) return;

        const tab = this.tabs[index];

        // Check for unsaved changes
        if (tab.dirty) {
            // TODO: Show confirmation dialog
        }

        this.tabs.splice(index, 1);

        if (this.activeTabId === tabId) {
            const newActive = this.tabs[Math.min(index, this.tabs.length - 1)];
            if (newActive) {
                this.activateTab(newActive.id);
            } else {
                this.activeTabId = null;
                if (this.editorElement) {
                    this.editorElement.value = '';
                }
            }
        }

        this.renderTabs();
    }

    /**
     * Render tabs
     */
    private renderTabs(): void {
        if (!this.tabsElement) return;

        this.tabsElement.innerHTML = '';

        for (const tab of this.tabs) {
            const tabElement = document.createElement('div');
            tabElement.className = `editor-tab ${tab.id === this.activeTabId ? 'active' : ''}`;
            tabElement.style.cssText = `
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 0 12px;
                height: 100%;
                background: ${tab.id === this.activeTabId ? 'var(--surface, #1e293b)' : 'transparent'};
                border-right: 1px solid var(--border, #334155);
                cursor: pointer;
                font-size: 12px;
                color: var(--text, #f1f5f9);
            `;

            // File icon
            const icon = document.createElement('span');
            icon.textContent = this.getFileIcon(tab.language);
            tabElement.appendChild(icon);

            // File name
            const name = document.createElement('span');
            name.textContent = tab.name + (tab.dirty ? ' *' : '');
            tabElement.appendChild(name);

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '\u00D7';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: var(--text-secondary, #64748b);
                cursor: pointer;
                padding: 0 4px;
                font-size: 14px;
            `;
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(tab.id);
            });
            tabElement.appendChild(closeBtn);

            tabElement.addEventListener('click', () => this.activateTab(tab.id));
            this.tabsElement!.appendChild(tabElement);
        }
    }

    /**
     * Handle input changes
     */
    private handleInput(): void {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (!tab || !this.editorElement) return;

        tab.content = this.editorElement.value;
        tab.dirty = true;
        this.renderTabs();

        // Sync line numbers
        const lineNumbers = this.getContentElement()?.querySelector('.line-numbers');
        if (lineNumbers) {
            this.syncLineNumbers(lineNumbers as HTMLElement);
        }

        // Update FX state
        this.fxBridge.set(`workspace.files.${tab.id}.content`, tab.content);
        this.fxBridge.set(`workspace.files.${tab.id}.dirty`, true);
    }

    /**
     * Handle keyboard shortcuts
     */
    private handleKeyDown(event: KeyboardEvent): void {
        if (event.ctrlKey || event.metaKey) {
            if (event.key === 's') {
                event.preventDefault();
                this.saveFile();
            }
        }

        // Tab handling
        if (event.key === 'Tab') {
            event.preventDefault();
            if (this.editorElement) {
                const start = this.editorElement.selectionStart;
                const end = this.editorElement.selectionEnd;
                const value = this.editorElement.value;

                this.editorElement.value = value.substring(0, start) + '    ' + value.substring(end);
                this.editorElement.selectionStart = this.editorElement.selectionEnd = start + 4;
                this.handleInput();
            }
        }
    }

    /**
     * Sync line numbers
     */
    private syncLineNumbers(lineNumbers: HTMLElement): void {
        if (!this.editorElement) return;

        const lines = this.editorElement.value.split('\n');
        lineNumbers.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
        lineNumbers.scrollTop = this.editorElement.scrollTop;
    }

    /**
     * Detect language from filename
     */
    private detectLanguage(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase();
        const languages: Record<string, string> = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'json': 'json',
            'html': 'html',
            'css': 'css',
            'md': 'markdown',
            'py': 'python',
            'rs': 'rust',
            'go': 'go'
        };
        return languages[ext || ''] || 'plaintext';
    }

    /**
     * Get file icon
     */
    private getFileIcon(language: string): string {
        const icons: Record<string, string> = {
            'typescript': '\u{1F4D8}',
            'javascript': '\u{1F4D9}',
            'html': '\u{1F310}',
            'css': '\u{1F3A8}',
            'json': '\u{1F4C4}',
            'markdown': '\u{1F4DD}',
            'python': '\u{1F40D}',
            'rust': '\u{2699}',
            'go': '\u{1F4A0}'
        };
        return icons[language] || '\u{1F4C4}';
    }

    /**
     * Handle events
     */
    handleEvent(event: string, data: any): void {
        switch (event) {
            case 'file.open':
                if (data.path) {
                    this.openFile(data.path);
                }
                break;
        }
    }
}
