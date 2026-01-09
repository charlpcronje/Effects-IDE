/**
 * Dreamweaver Application - Main renderer application
 */

import { SceneManager } from '../scene/scene-manager';
import { PanelManager } from '../panels/panel-manager';
import { ThemeManager } from '../themes/theme-manager';
import { FXBridge } from './fx-bridge';
import { InputManager } from './input-manager';
import { CommandPalette } from './command-palette';
import { LayoutManager } from './layout-manager';
import { StatusToast } from './status-toast';

export class DreamweaverApp {
    private sceneManager: SceneManager;
    private panelManager: PanelManager;
    private themeManager: ThemeManager;
    private fxBridge: FXBridge;
    private inputManager: InputManager;
    private commandPalette: CommandPalette;
    private layoutManager: LayoutManager;
    private statusToast: StatusToast;

    private container: HTMLElement;
    private running: boolean = false;

    constructor() {
        this.container = document.getElementById('app') || document.body;
        this.fxBridge = new FXBridge();
        this.sceneManager = new SceneManager(this.container);
        this.themeManager = new ThemeManager(this.fxBridge);
        this.panelManager = new PanelManager(this.sceneManager, this.fxBridge);
        this.inputManager = new InputManager(this.sceneManager, this.panelManager);
        this.commandPalette = new CommandPalette(this);
        this.layoutManager = new LayoutManager(this.sceneManager, this.panelManager, this.fxBridge);
        this.statusToast = new StatusToast();
    }

    /**
     * Initialize the application
     */
    async init(): Promise<void> {
        // Initialize FX bridge
        await this.fxBridge.init();

        // Initialize scene (pass FX bridge for node graph)
        await this.sceneManager.init(this.fxBridge);

        // Initialize theme
        await this.themeManager.init();

        // Initialize panels
        await this.panelManager.init();

        // Setup input handling
        this.inputManager.init();

        // Setup menu handlers
        this.setupMenuHandlers();

        // Start render loop
        this.start();

        // Create default panels
        await this.createDefaultLayout();
    }

    /**
     * Create default panel layout
     */
    private async createDefaultLayout(): Promise<void> {
        // File Explorer on the left
        await this.panelManager.createPanel('explorer', {
            type: 'explorer',
            position: { x: -600, y: 0, z: 0 },
            size: { width: 280, height: 600 }
        });

        // Code Editor in the center
        await this.panelManager.createPanel('editor', {
            type: 'editor',
            position: { x: 0, y: 0, z: 0 },
            size: { width: 800, height: 600 }
        });

        // AI Chat on the right
        await this.panelManager.createPanel('ai-chat', {
            type: 'ai',
            position: { x: 600, y: 0, z: 0 },
            size: { width: 320, height: 600 }
        });

        // Terminal at the bottom
        await this.panelManager.createPanel('terminal', {
            type: 'terminal',
            position: { x: 0, y: -400, z: 0 },
            size: { width: 1200, height: 250 }
        });

        // Create demo icons on the grid
        this.createDemoIcons();
    }

    /**
     * Create demo icons to show the icon system
     */
    private createDemoIcons(): void {
        const iconManager = this.sceneManager.getIconManager();

        // Create a row of command icons
        iconManager.createIcon('icon-search', 'search', -300, -600, 15, 'Search Files', () => {
            this.statusToast.info('🔍 Search feature coming soon!');
        });

        iconManager.createIcon('icon-git', 'git', -200, -600, 15, 'Git', () => {
            this.togglePanel('git');
            this.statusToast.success('🔀 Git panel opened!');
        });

        iconManager.createIcon('icon-database', 'database', -100, -600, 15, 'Database', () => {
            this.togglePanel('database');
            this.statusToast.success('🗄️ Database panel opened!');
        });

        iconManager.createIcon('icon-api', 'api', 0, -600, 15, 'API Studio', () => {
            this.togglePanel('api');
            this.statusToast.success('🔌 API Studio opened!');
        });

        iconManager.createIcon('icon-settings', 'settings', 100, -600, 15, 'Settings', () => {
            this.statusToast.info('⚙️ Settings coming soon!');
        });

        iconManager.createIcon('icon-run', 'run', 200, -600, 15, 'Run', () => {
            this.statusToast.info('▶ Run feature coming soon!');
        });

        iconManager.createIcon('icon-debug', 'debug', 300, -600, 15, 'Debug', () => {
            this.statusToast.info('🐛 Debug feature coming soon!');
        });

        console.log('[App] Created demo icons on grid');
    }

    /**
     * Setup menu event handlers
     */
    private setupMenuHandlers(): void {
        // View modes
        window.dreamweaver.on('menu:view-2d', () => this.setViewMode('2d'));
        window.dreamweaver.on('menu:view-3d', () => this.setViewMode('3d'));
        window.dreamweaver.on('menu:view-hybrid', () => this.setViewMode('hybrid'));

        // Panels
        window.dreamweaver.on('menu:panel-explorer', () => this.togglePanel('explorer'));
        window.dreamweaver.on('menu:panel-editor', () => this.togglePanel('editor'));
        window.dreamweaver.on('menu:panel-terminal', () => this.togglePanel('terminal'));
        window.dreamweaver.on('menu:panel-ai', () => this.togglePanel('ai'));
        window.dreamweaver.on('menu:panel-node-graph', () => this.togglePanel('node-graph'));
        window.dreamweaver.on('menu:panel-database', () => this.togglePanel('database'));
        window.dreamweaver.on('menu:panel-api', () => this.togglePanel('api'));
        window.dreamweaver.on('menu:panel-git', () => this.togglePanel('git'));

        // Command palette
        window.dreamweaver.on('menu:command-palette', () => this.commandPalette.show());

        // Zoom
        window.dreamweaver.on('menu:zoom-in', () => this.sceneManager.zoomIn());
        window.dreamweaver.on('menu:zoom-out', () => this.sceneManager.zoomOut());
        window.dreamweaver.on('menu:zoom-reset', () => this.sceneManager.zoomReset());

        // Project
        window.dreamweaver.on('menu:open-project', async (path: string) => {
            await this.openProject(path);
        });

        // Layout save/load
        window.dreamweaver.on('menu:save', () => this.saveLayout());
        window.dreamweaver.on('menu:export-workspace', () => this.exportLayout());
        window.dreamweaver.on('menu:import-workspace', () => this.importLayout());

        // Node graph
        window.dreamweaver.on('menu:panel-node-graph', () => this.toggleNodeGraph());
    }

    /**
     * Toggle node graph visibility
     */
    toggleNodeGraph(): void {
        const visualizer = this.sceneManager.getNodeGraphVisualizer();
        if (visualizer) {
            visualizer.toggle();
        }
    }

    /**
     * Save current layout
     */
    async saveLayout(name?: string): Promise<void> {
        const layoutName = name || await this.promptLayoutName();
        if (layoutName) {
            await this.layoutManager.saveLayout(layoutName);
            console.log(`[App] Layout saved: ${layoutName}`);
        }
    }

    /**
     * Load a layout
     */
    async loadLayout(name: string): Promise<void> {
        await this.layoutManager.loadLayout(name);
        console.log(`[App] Layout loaded: ${name}`);
    }

    /**
     * Export layout to file
     */
    async exportLayout(): Promise<void> {
        const name = this.layoutManager.getCurrentLayoutName();
        const json = this.layoutManager.exportLayout(name);

        if (json) {
            const result = await window.dreamweaver.dialog.save({
                title: 'Export Layout',
                defaultPath: `${name}.fxlayout`,
                filters: [{ name: 'FX Layout', extensions: ['fxlayout'] }]
            });

            if (!result.canceled && result.filePath) {
                await window.dreamweaver.fs.write(result.filePath, json);
                console.log(`[App] Layout exported to: ${result.filePath}`);
            }
        }
    }

    /**
     * Import layout from file
     */
    async importLayout(): Promise<void> {
        const result = await window.dreamweaver.dialog.open({
            title: 'Import Layout',
            filters: [{ name: 'FX Layout', extensions: ['fxlayout'] }],
            properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const json = await window.dreamweaver.fs.read(result.filePaths[0]);
            const name = result.filePaths[0].split('/').pop()?.replace('.fxlayout', '');
            this.layoutManager.importLayout(json, name);
            console.log(`[App] Layout imported`);
        }
    }

    /**
     * Prompt for layout name
     */
    private async promptLayoutName(): Promise<string | null> {
        // Simple prompt (in production, use a proper dialog)
        return prompt('Layout name:', this.layoutManager.getCurrentLayoutName());
    }

    /**
     * Set view mode (2D/3D/Hybrid)
     */
    setViewMode(mode: '2d' | '3d' | 'hybrid'): void {
        this.sceneManager.setViewMode(mode);
        this.fxBridge.set('settings.viewMode', mode);
    }

    /**
     * Toggle a panel
     */
    togglePanel(type: string): void {
        const existing = this.panelManager.findPanelByType(type);
        if (existing) {
            this.panelManager.removePanel(existing.getId());
        } else {
            this.panelManager.createPanel(`${type}-${Date.now()}`, {
                type: type as any,
                position: { x: 0, y: 0, z: 0 }
            });
        }
    }

    /**
     * Open a project
     */
    async openProject(path: string): Promise<void> {
        console.log('[Dreamweaver] Opening project:', path);
        this.fxBridge.set('workspace.projectPath', path);

        // Notify panels
        this.panelManager.broadcast('project:open', { path });
    }

    /**
     * Start render loop
     */
    start(): void {
        this.running = true;
        this.render();
    }

    /**
     * Stop render loop
     */
    stop(): void {
        this.running = false;
    }

    /**
     * Main render loop
     */
    private render(): void {
        if (!this.running) return;

        // Update scene
        this.sceneManager.update();

        // Update panels
        this.panelManager.update();

        // Schedule next frame
        requestAnimationFrame(() => this.render());
    }

    /**
     * Get FX bridge
     */
    getFXBridge(): FXBridge {
        return this.fxBridge;
    }

    /**
     * Get scene manager
     */
    getSceneManager(): SceneManager {
        return this.sceneManager;
    }

    /**
     * Get panel manager
     */
    getPanelManager(): PanelManager {
        return this.panelManager;
    }

    /**
     * Get theme manager
     */
    getThemeManager(): ThemeManager {
        return this.themeManager;
    }

    /**
     * Get layout manager
     */
    getLayoutManager(): LayoutManager {
        return this.layoutManager;
    }
}
