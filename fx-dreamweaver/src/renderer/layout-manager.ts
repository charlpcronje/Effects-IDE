/**
 * Layout Manager - Save and load workspace layouts
 */

import { SceneManager } from '../scene/scene-manager';
import { PanelManager } from '../panels/panel-manager';
import { FXBridge } from './fx-bridge';

export interface LayoutData {
    version: string;
    name: string;
    created: number;
    viewMode: '2d' | '3d' | 'hybrid' | 'free';
    camera: {
        zoom: number;
        panX: number;
        panY: number;
    };
    panels: Array<{
        id: string;
        type: string;
        title: string;
        position: { x: number; y: number; z: number };
        size: { width: number; height: number };
        transform?: {
            rotation: { x: number; y: number; z: number };
            scale: number;
        };
    }>;
    gridBlocks: Array<{
        gridX: number;
        gridY: number;
        height: number;
    }>;
    icons: Array<{
        id: string;
        type: string;
        label: string;
        position: { x: number; y: number; z: number };
    }>;
    connections: Array<{
        id: string;
        from: { x: number; y: number; z: number };
        to: { x: number; y: number; z: number };
        color: number;
        opacity: number;
    }>;
}

export class LayoutManager {
    private sceneManager: SceneManager;
    private panelManager: PanelManager;
    private fxBridge: FXBridge;

    private layouts: Map<string, LayoutData> = new Map();
    private currentLayoutName: string = 'default';

    constructor(sceneManager: SceneManager, panelManager: PanelManager, fxBridge: FXBridge) {
        this.sceneManager = sceneManager;
        this.panelManager = panelManager;
        this.fxBridge = fxBridge;

        // Load saved layouts from FX bridge
        this.loadLayoutsFromStorage();
    }

    /**
     * Save current layout
     */
    async saveLayout(name: string): Promise<void> {
        console.log(`[LayoutManager] Saving layout: ${name}`);

        const layout: LayoutData = {
            version: '1.0.0',
            name,
            created: Date.now(),
            viewMode: this.sceneManager.getViewMode(),
            camera: {
                zoom: 1, // TODO: Get from scene
                panX: 0,
                panY: 0
            },
            panels: this.serializePanels(),
            gridBlocks: this.sceneManager.getGridManager().serialize().blocks,
            icons: this.sceneManager.getIconManager().serialize(),
            connections: this.sceneManager.getConnectionManager().serialize()
        };

        this.layouts.set(name, layout);
        this.currentLayoutName = name;

        // Save to FX bridge
        this.fxBridge.set(`workspace.layouts.${name}`, layout);
        this.saveLayoutsToStorage();

        console.log(`[LayoutManager] Layout saved: ${name}`);
    }

    /**
     * Load a layout
     */
    async loadLayout(name: string): Promise<void> {
        const layout = this.layouts.get(name);
        if (!layout) {
            console.error(`[LayoutManager] Layout not found: ${name}`);
            return;
        }

        console.log(`[LayoutManager] Loading layout: ${name}`);

        // Clear current state
        await this.clearWorkspace();

        // Restore view mode
        this.sceneManager.setViewMode(layout.viewMode);

        // Restore grid blocks
        this.sceneManager.getGridManager().deserialize({ blocks: layout.gridBlocks });

        // Restore icons
        this.sceneManager.getIconManager().deserialize(layout.icons);

        // Restore connections
        this.sceneManager.getConnectionManager().deserialize(layout.connections);

        // Restore panels
        await this.deserializePanels(layout.panels);

        this.currentLayoutName = name;
        console.log(`[LayoutManager] Layout loaded: ${name}`);
    }

    /**
     * Delete a layout
     */
    deleteLayout(name: string): void {
        this.layouts.delete(name);
        this.fxBridge.set(`workspace.layouts.${name}`, null);
        this.saveLayoutsToStorage();
        console.log(`[LayoutManager] Layout deleted: ${name}`);
    }

    /**
     * Get all layout names
     */
    getLayoutNames(): string[] {
        return Array.from(this.layouts.keys());
    }

    /**
     * Get layout data
     */
    getLayout(name: string): LayoutData | undefined {
        return this.layouts.get(name);
    }

    /**
     * Get current layout name
     */
    getCurrentLayoutName(): string {
        return this.currentLayoutName;
    }

    /**
     * Export layout as JSON
     */
    exportLayout(name: string): string | null {
        const layout = this.layouts.get(name);
        if (layout) {
            return JSON.stringify(layout, null, 2);
        }
        return null;
    }

    /**
     * Import layout from JSON
     */
    importLayout(json: string, name?: string): void {
        try {
            const layout = JSON.parse(json) as LayoutData;
            const layoutName = name || layout.name || `imported-${Date.now()}`;

            this.layouts.set(layoutName, layout);
            this.fxBridge.set(`workspace.layouts.${layoutName}`, layout);
            this.saveLayoutsToStorage();

            console.log(`[LayoutManager] Layout imported: ${layoutName}`);
        } catch (error) {
            console.error('[LayoutManager] Failed to import layout:', error);
        }
    }

    /**
     * Save layouts to disk/storage
     */
    private async saveLayoutsToStorage(): Promise<void> {
        const projectPath = this.fxBridge.get('workspace.projectPath');
        if (!projectPath) {
            console.warn('[LayoutManager] No project path, saving to FX state only');
            return;
        }

        try {
            const layoutsData = Object.fromEntries(this.layouts);
            const json = JSON.stringify(layoutsData, null, 2);

            await window.dreamweaver.fs.write(
                `${projectPath}/.fx-dreamweaver-layouts.json`,
                json
            );

            console.log('[LayoutManager] Layouts saved to disk');
        } catch (error) {
            console.error('[LayoutManager] Failed to save layouts:', error);
        }
    }

    /**
     * Load layouts from disk/storage
     */
    private async loadLayoutsFromStorage(): Promise<void> {
        const projectPath = this.fxBridge.get('workspace.projectPath');
        if (!projectPath) return;

        try {
            const json = await window.dreamweaver.fs.read(
                `${projectPath}/.fx-dreamweaver-layouts.json`
            );

            const layoutsData = JSON.parse(json);

            for (const [name, layout] of Object.entries(layoutsData)) {
                this.layouts.set(name, layout as LayoutData);
            }

            console.log(`[LayoutManager] Loaded ${this.layouts.size} layouts from disk`);
        } catch (error) {
            console.log('[LayoutManager] No saved layouts found (new project)');
        }
    }

    /**
     * Serialize panels
     */
    private serializePanels(): any[] {
        const panels = this.panelManager.getAllPanels();
        return panels.map(panel => ({
            id: panel.getId(),
            type: panel.getType(),
            title: (panel as any).config.title,
            position: {
                x: panel.getPosition().x,
                y: panel.getPosition().y,
                z: panel.getPosition().z
            },
            size: (panel as any).config.size,
            transform: panel.getControls().serialize()
        }));
    }

    /**
     * Deserialize and create panels
     */
    private async deserializePanels(panelsData: any[]): Promise<void> {
        for (const panelData of panelsData) {
            const panel = await this.panelManager.createPanel(panelData.id, {
                type: panelData.type,
                title: panelData.title,
                position: panelData.position,
                size: panelData.size
            });

            // Restore transforms
            if (panelData.transform) {
                panel.getControls().deserialize(panelData.transform);
            }
        }
    }

    /**
     * Clear workspace
     */
    private async clearWorkspace(): Promise<void> {
        // Remove all panels
        const panels = this.panelManager.getAllPanels();
        for (const panel of panels) {
            this.panelManager.removePanel(panel.getId());
        }

        // Clear grid blocks
        const gridManager = this.sceneManager.getGridManager();
        const blocks = gridManager.getAllBlocks();
        for (const block of blocks) {
            gridManager.removeBlock(block.gridX, block.gridY);
        }

        // Clear icons
        this.sceneManager.getIconManager().clear();

        // Clear connections
        this.sceneManager.getConnectionManager().clear();
    }

    /**
     * Auto-save current layout
     */
    autoSave(): void {
        this.saveLayout(this.currentLayoutName);
    }
}
