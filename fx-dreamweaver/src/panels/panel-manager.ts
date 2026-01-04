/**
 * Panel Manager - Manages 3D panels in the scene
 */

import * as THREE from 'three';
import { SceneManager } from '../scene/scene-manager';
import { FXBridge } from '../renderer/fx-bridge';
import { Panel, PanelConfig, PanelType } from './panel';
import { EditorPanel } from './editor-panel';
import { ExplorerPanel } from './explorer-panel';
import { TerminalPanel } from './terminal-panel';
import { AIPanel } from './ai-panel';

export interface PanelOptions {
    type: PanelType;
    position?: { x: number; y: number; z: number };
    size?: { width: number; height: number };
    title?: string;
}

export class PanelManager {
    private sceneManager: SceneManager;
    private fxBridge: FXBridge;
    private panels: Map<string, Panel> = new Map();
    private selectedPanelId: string | null = null;
    private focusedPanelId: string | null = null;
    private panelOrder: string[] = [];

    private gridSize: number = 20;
    private snapEnabled: boolean = true;

    constructor(sceneManager: SceneManager, fxBridge: FXBridge) {
        this.sceneManager = sceneManager;
        this.fxBridge = fxBridge;
    }

    /**
     * Initialize panel manager
     */
    async init(): Promise<void> {
        console.log('[PanelManager] Initialized');
    }

    /**
     * Create a new panel
     */
    async createPanel(id: string, options: PanelOptions): Promise<Panel> {
        const config: PanelConfig = {
            id,
            type: options.type,
            title: options.title || this.getDefaultTitle(options.type),
            position: options.position || { x: 0, y: 0, z: 0 },
            size: options.size || { width: 400, height: 300 },
            visible: true,
            minimized: false,
            maximized: false
        };

        // Create panel based on type
        let panel: Panel;
        switch (options.type) {
            case 'editor':
                panel = new EditorPanel(config, this.sceneManager, this.fxBridge);
                break;
            case 'explorer':
                panel = new ExplorerPanel(config, this.sceneManager, this.fxBridge);
                break;
            case 'terminal':
                panel = new TerminalPanel(config, this.sceneManager, this.fxBridge);
                break;
            case 'ai':
                panel = new AIPanel(config, this.sceneManager, this.fxBridge);
                break;
            default:
                panel = new Panel(config, this.sceneManager, this.fxBridge);
        }

        await panel.init();
        this.panels.set(id, panel);
        this.panelOrder.push(id);

        // Update FX state
        this.fxBridge.updatePanel(id, {
            type: options.type,
            position: config.position,
            size: config.size,
            state: { selected: false, focused: false }
        });

        this.fxBridge.emit('panel.create', { panelId: id, type: options.type });

        return panel;
    }

    /**
     * Remove a panel
     */
    removePanel(id: string): void {
        const panel = this.panels.get(id);
        if (panel) {
            panel.dispose();
            this.panels.delete(id);
            this.panelOrder = this.panelOrder.filter(p => p !== id);

            if (this.selectedPanelId === id) {
                this.selectedPanelId = null;
            }
            if (this.focusedPanelId === id) {
                this.focusedPanelId = null;
            }

            this.fxBridge.removePanel(id);
        }
    }

    /**
     * Get a panel by ID
     */
    getPanel(id: string): Panel | undefined {
        return this.panels.get(id);
    }

    /**
     * Find panel by type
     */
    findPanelByType(type: string): Panel | undefined {
        for (const panel of this.panels.values()) {
            if (panel.getType() === type) {
                return panel;
            }
        }
        return undefined;
    }

    /**
     * Select a panel
     */
    selectPanel(id: string): void {
        // Deselect previous
        if (this.selectedPanelId && this.selectedPanelId !== id) {
            const prev = this.panels.get(this.selectedPanelId);
            if (prev) {
                prev.setSelected(false);
                this.fxBridge.updatePanel(this.selectedPanelId, {
                    state: { selected: false }
                });
            }
        }

        // Select new
        const panel = this.panels.get(id);
        if (panel) {
            panel.setSelected(true);
            this.selectedPanelId = id;
            this.fxBridge.updatePanel(id, {
                state: { selected: true }
            });
            this.fxBridge.emit('panel.select', { panelId: id });
        }
    }

    /**
     * Focus a panel
     */
    focusPanel(id: string): void {
        // Unfocus previous
        if (this.focusedPanelId && this.focusedPanelId !== id) {
            const prev = this.panels.get(this.focusedPanelId);
            if (prev) {
                prev.setFocused(false);
            }
        }

        // Focus new
        const panel = this.panels.get(id);
        if (panel) {
            panel.setFocused(true);
            this.focusedPanelId = id;

            // Bring to front
            this.bringToFront(id);

            this.fxBridge.emit('panel.focus', { panelId: id });
        }
    }

    /**
     * Deselect all panels
     */
    deselectAll(): void {
        for (const [id, panel] of this.panels) {
            panel.setSelected(false);
            this.fxBridge.updatePanel(id, {
                state: { selected: false }
            });
        }
        this.selectedPanelId = null;
    }

    /**
     * Move a panel
     */
    movePanel(id: string, dx: number, dy: number): void {
        const panel = this.panels.get(id);
        if (panel) {
            panel.move(dx, dy);
            const pos = panel.getPosition();
            this.fxBridge.updatePanel(id, {
                position: { x: pos.x, y: pos.y, z: pos.z }
            });
        }
    }

    /**
     * Snap panel to grid
     */
    snapToGrid(id: string): void {
        if (!this.snapEnabled) return;

        const panel = this.panels.get(id);
        if (panel) {
            const pos = panel.getPosition();
            const snappedX = Math.round(pos.x / this.gridSize) * this.gridSize;
            const snappedY = Math.round(pos.y / this.gridSize) * this.gridSize;

            panel.setPosition(snappedX, snappedY, pos.z);
            this.fxBridge.updatePanel(id, {
                position: { x: snappedX, y: snappedY, z: pos.z }
            });
        }
    }

    /**
     * Bring panel to front
     */
    bringToFront(id: string): void {
        const index = this.panelOrder.indexOf(id);
        if (index !== -1) {
            this.panelOrder.splice(index, 1);
            this.panelOrder.push(id);

            // Update z-order
            this.panelOrder.forEach((panelId, i) => {
                const panel = this.panels.get(panelId);
                if (panel) {
                    const pos = panel.getPosition();
                    panel.setPosition(pos.x, pos.y, i * 10);
                }
            });
        }
    }

    /**
     * Focus next panel
     */
    focusNextPanel(): void {
        if (this.panelOrder.length === 0) return;

        const currentIndex = this.focusedPanelId
            ? this.panelOrder.indexOf(this.focusedPanelId)
            : -1;

        const nextIndex = (currentIndex + 1) % this.panelOrder.length;
        this.focusPanel(this.panelOrder[nextIndex]);
    }

    /**
     * Focus previous panel
     */
    focusPrevPanel(): void {
        if (this.panelOrder.length === 0) return;

        const currentIndex = this.focusedPanelId
            ? this.panelOrder.indexOf(this.focusedPanelId)
            : 0;

        const prevIndex = (currentIndex - 1 + this.panelOrder.length) % this.panelOrder.length;
        this.focusPanel(this.panelOrder[prevIndex]);
    }

    /**
     * Navigate to adjacent panel
     */
    navigatePanel(direction: 'left' | 'right' | 'up' | 'down'): void {
        if (!this.focusedPanelId) {
            if (this.panelOrder.length > 0) {
                this.focusPanel(this.panelOrder[0]);
            }
            return;
        }

        const current = this.panels.get(this.focusedPanelId);
        if (!current) return;

        const currentPos = current.getPosition();
        let closest: { id: string; distance: number } | null = null;

        for (const [id, panel] of this.panels) {
            if (id === this.focusedPanelId) continue;

            const pos = panel.getPosition();
            const dx = pos.x - currentPos.x;
            const dy = pos.y - currentPos.y;

            let isInDirection = false;
            switch (direction) {
                case 'left':
                    isInDirection = dx < -50;
                    break;
                case 'right':
                    isInDirection = dx > 50;
                    break;
                case 'up':
                    isInDirection = dy > 50;
                    break;
                case 'down':
                    isInDirection = dy < -50;
                    break;
            }

            if (isInDirection) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (!closest || distance < closest.distance) {
                    closest = { id, distance };
                }
            }
        }

        if (closest) {
            this.focusPanel(closest.id);
        }
    }

    /**
     * Broadcast message to all panels
     */
    broadcast(event: string, data: any): void {
        for (const panel of this.panels.values()) {
            panel.handleEvent(event, data);
        }
    }

    /**
     * Update all panels
     */
    update(): void {
        for (const panel of this.panels.values()) {
            panel.update();
        }
    }

    /**
     * Get default title for panel type
     */
    private getDefaultTitle(type: PanelType): string {
        const titles: Record<PanelType, string> = {
            'explorer': 'Explorer',
            'editor': 'Editor',
            'terminal': 'Terminal',
            'ai': 'AI Chat',
            'node-graph': 'Node Graph',
            'database': 'Database',
            'api': 'API Studio',
            'git': 'Git',
            'theme-lab': 'Theme Lab',
            'marketplace': 'Marketplace'
        };
        return titles[type] || 'Panel';
    }

    /**
     * Get all panels
     */
    getAllPanels(): Panel[] {
        return Array.from(this.panels.values());
    }

    /**
     * Dispose all panels
     */
    dispose(): void {
        for (const panel of this.panels.values()) {
            panel.dispose();
        }
        this.panels.clear();
        this.panelOrder = [];
    }
}
