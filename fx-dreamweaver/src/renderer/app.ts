/**
 * Dreamweaver Application - Main renderer application
 */

import { SceneManager } from '../scene/scene-manager';
import { PanelManager } from '../panels/panel-manager';
import { ThemeManager } from '../themes/theme-manager';
import { FXBridge } from './fx-bridge';
import { InputManager } from './input-manager';
import { CommandPalette } from './command-palette';

export class DreamweaverApp {
    private sceneManager: SceneManager;
    private panelManager: PanelManager;
    private themeManager: ThemeManager;
    private fxBridge: FXBridge;
    private inputManager: InputManager;
    private commandPalette: CommandPalette;

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
    }

    /**
     * Initialize the application
     */
    async init(): Promise<void> {
        // Initialize FX bridge
        await this.fxBridge.init();

        // Initialize scene
        await this.sceneManager.init();

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
}
