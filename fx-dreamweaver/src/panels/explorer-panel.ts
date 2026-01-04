/**
 * Explorer Panel - File system explorer
 */

import { Panel, PanelConfig } from './panel';
import { SceneManager } from '../scene/scene-manager';
import { FXBridge } from '../renderer/fx-bridge';

interface FileNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileNode[];
    expanded?: boolean;
}

export class ExplorerPanel extends Panel {
    private treeElement: HTMLElement | null = null;
    private rootPath: string | null = null;
    private fileTree: FileNode[] = [];

    constructor(config: PanelConfig, sceneManager: SceneManager, fxBridge: FXBridge) {
        super(config, sceneManager, fxBridge);
    }

    async init(): Promise<void> {
        await super.init();
        this.createExplorerUI();

        // Watch for project changes
        this.fxBridge.watch('workspace.projectPath', (path) => {
            if (path) {
                this.loadDirectory(path);
            }
        });
    }

    /**
     * Create explorer UI
     */
    private createExplorerUI(): void {
        const content = this.getContentElement();
        if (!content) return;

        content.style.padding = '0';
        content.innerHTML = '';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'explorer-toolbar';
        toolbar.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-bottom: 1px solid var(--border, #334155);
        `;

        // New file button
        const newFileBtn = this.createToolbarButton('New File', '+', () => this.createNewFile());
        toolbar.appendChild(newFileBtn);

        // New folder button
        const newFolderBtn = this.createToolbarButton('New Folder', '\u{1F4C1}', () => this.createNewFolder());
        toolbar.appendChild(newFolderBtn);

        // Refresh button
        const refreshBtn = this.createToolbarButton('Refresh', '\u{21BB}', () => this.refresh());
        toolbar.appendChild(refreshBtn);

        content.appendChild(toolbar);

        // Tree container
        this.treeElement = document.createElement('div');
        this.treeElement.className = 'explorer-tree';
        this.treeElement.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: 4px;
        `;
        content.appendChild(this.treeElement);
    }

    /**
     * Create toolbar button
     */
    private createToolbarButton(title: string, icon: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.title = title;
        btn.textContent = icon;
        btn.style.cssText = `
            background: transparent;
            border: none;
            color: var(--text, #f1f5f9);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
        `;
        btn.addEventListener('mouseenter', () => btn.style.background = 'var(--surface, #1e293b)');
        btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
        btn.addEventListener('click', onClick);
        return btn;
    }

    /**
     * Load directory contents
     */
    async loadDirectory(path: string): Promise<void> {
        this.rootPath = path;
        this.fileTree = await this.readDirectory(path);
        this.renderTree();
    }

    /**
     * Read directory recursively
     */
    private async readDirectory(path: string, depth: number = 0): Promise<FileNode[]> {
        if (depth > 3) return []; // Limit depth

        try {
            const entries = await window.dreamweaver.fs.readdir(path);
            const nodes: FileNode[] = [];

            for (const entry of entries) {
                // Skip hidden files
                if (entry.name.startsWith('.')) continue;
                if (entry.name === 'node_modules') continue;

                const node: FileNode = {
                    name: entry.name,
                    path: entry.path,
                    isDirectory: entry.isDirectory,
                    expanded: false
                };

                if (entry.isDirectory && depth < 2) {
                    node.children = await this.readDirectory(entry.path, depth + 1);
                }

                nodes.push(node);
            }

            // Sort: directories first, then alphabetically
            return nodes.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });

        } catch (error) {
            console.error('[ExplorerPanel] Failed to read directory:', error);
            return [];
        }
    }

    /**
     * Render file tree
     */
    private renderTree(): void {
        if (!this.treeElement) return;
        this.treeElement.innerHTML = '';
        this.renderNodes(this.fileTree, this.treeElement, 0);
    }

    /**
     * Render nodes
     */
    private renderNodes(nodes: FileNode[], container: HTMLElement, level: number): void {
        for (const node of nodes) {
            const item = document.createElement('div');
            item.className = 'explorer-item';
            item.style.cssText = `
                display: flex;
                align-items: center;
                padding: 4px 8px;
                padding-left: ${8 + level * 16}px;
                cursor: pointer;
                user-select: none;
                font-size: 13px;
                color: var(--text, #f1f5f9);
                border-radius: 4px;
            `;

            // Icon
            const icon = document.createElement('span');
            icon.style.marginRight = '6px';
            icon.textContent = node.isDirectory
                ? (node.expanded ? '\u{1F4C2}' : '\u{1F4C1}')
                : this.getFileIcon(node.name);
            item.appendChild(icon);

            // Name
            const name = document.createElement('span');
            name.textContent = node.name;
            item.appendChild(name);

            // Hover effect
            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--surface-hover, #334155)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
            });

            // Click handler
            item.addEventListener('click', () => {
                if (node.isDirectory) {
                    this.toggleDirectory(node);
                } else {
                    this.openFile(node);
                }
            });

            // Context menu
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(node, e.clientX, e.clientY);
            });

            container.appendChild(item);

            // Render children if expanded
            if (node.isDirectory && node.expanded && node.children) {
                this.renderNodes(node.children, container, level + 1);
            }
        }
    }

    /**
     * Toggle directory expanded state
     */
    private async toggleDirectory(node: FileNode): Promise<void> {
        node.expanded = !node.expanded;

        if (node.expanded && (!node.children || node.children.length === 0)) {
            node.children = await this.readDirectory(node.path, 0);
        }

        this.renderTree();
    }

    /**
     * Open file
     */
    private openFile(node: FileNode): void {
        this.fxBridge.emit('file.open', { path: node.path });
    }

    /**
     * Get file icon
     */
    private getFileIcon(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase();
        const icons: Record<string, string> = {
            'ts': '\u{1F4D8}',
            'tsx': '\u{1F4D8}',
            'js': '\u{1F4D9}',
            'jsx': '\u{1F4D9}',
            'json': '\u{1F4C4}',
            'html': '\u{1F310}',
            'css': '\u{1F3A8}',
            'md': '\u{1F4DD}',
            'py': '\u{1F40D}',
            'rs': '\u{2699}',
            'go': '\u{1F4A0}'
        };
        return icons[ext || ''] || '\u{1F4C4}';
    }

    /**
     * Refresh tree
     */
    async refresh(): Promise<void> {
        if (this.rootPath) {
            await this.loadDirectory(this.rootPath);
        }
    }

    /**
     * Create new file
     */
    private async createNewFile(): Promise<void> {
        const name = prompt('File name:');
        if (!name || !this.rootPath) return;

        const path = `${this.rootPath}/${name}`;
        try {
            await window.dreamweaver.fs.write(path, '');
            await this.refresh();
            this.openFile({ name, path, isDirectory: false });
        } catch (error) {
            console.error('[ExplorerPanel] Failed to create file:', error);
        }
    }

    /**
     * Create new folder
     */
    private async createNewFolder(): Promise<void> {
        const name = prompt('Folder name:');
        if (!name || !this.rootPath) return;

        const path = `${this.rootPath}/${name}`;
        try {
            await window.dreamweaver.fs.mkdir(path);
            await this.refresh();
        } catch (error) {
            console.error('[ExplorerPanel] Failed to create folder:', error);
        }
    }

    /**
     * Show context menu
     */
    private showContextMenu(node: FileNode, x: number, y: number): void {
        // TODO: Implement context menu
        console.log('[ExplorerPanel] Context menu:', node.path, x, y);
    }

    /**
     * Handle events
     */
    handleEvent(event: string, data: any): void {
        switch (event) {
            case 'project:open':
                if (data.path) {
                    this.loadDirectory(data.path);
                }
                break;
        }
    }
}
