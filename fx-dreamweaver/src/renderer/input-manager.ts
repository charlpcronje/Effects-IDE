/**
 * Input Manager - Handles keyboard, mouse, and gesture input
 */

import { SceneManager } from '../scene/scene-manager';
import { PanelManager } from '../panels/panel-manager';

interface KeyBinding {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
    action: string;
    handler: () => void;
}

export class InputManager {
    private sceneManager: SceneManager;
    private panelManager: PanelManager;
    private bindings: KeyBinding[] = [];
    private isDragging: boolean = false;
    private dragTarget: string | null = null;
    private dragOffset: { x: number; y: number } = { x: 0, y: 0 };

    constructor(sceneManager: SceneManager, panelManager: PanelManager) {
        this.sceneManager = sceneManager;
        this.panelManager = panelManager;
    }

    /**
     * Initialize input handling
     */
    init(): void {
        this.setupKeyboardBindings();
        this.setupMouseHandlers();
        this.setupTouchHandlers();
        this.setupWheelHandlers();

        console.log('[InputManager] Initialized');
    }

    /**
     * Setup default keyboard bindings
     */
    private setupKeyboardBindings(): void {
        // Core shortcuts
        this.bind({ key: 'Escape', action: 'cancel', handler: () => this.handleCancel() });
        this.bind({ key: 'Tab', action: 'focusNext', handler: () => this.handleFocusNext() });
        this.bind({ key: 'Tab', shift: true, action: 'focusPrev', handler: () => this.handleFocusPrev() });

        // View controls
        this.bind({ key: '1', ctrl: true, action: 'view2d', handler: () => this.sceneManager.setViewMode('2d') });
        this.bind({ key: '2', ctrl: true, action: 'view3d', handler: () => this.sceneManager.setViewMode('3d') });
        this.bind({ key: '3', ctrl: true, action: 'viewHybrid', handler: () => this.sceneManager.setViewMode('hybrid') });

        // Zoom
        this.bind({ key: '=', ctrl: true, action: 'zoomIn', handler: () => this.sceneManager.zoomIn() });
        this.bind({ key: '-', ctrl: true, action: 'zoomOut', handler: () => this.sceneManager.zoomOut() });
        this.bind({ key: '0', ctrl: true, action: 'zoomReset', handler: () => this.sceneManager.zoomReset() });

        // Panel navigation
        this.bind({ key: 'ArrowLeft', alt: true, action: 'panelLeft', handler: () => this.navigatePanel('left') });
        this.bind({ key: 'ArrowRight', alt: true, action: 'panelRight', handler: () => this.navigatePanel('right') });
        this.bind({ key: 'ArrowUp', alt: true, action: 'panelUp', handler: () => this.navigatePanel('up') });
        this.bind({ key: 'ArrowDown', alt: true, action: 'panelDown', handler: () => this.navigatePanel('down') });

        // Keyboard event listener
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    /**
     * Add a key binding
     */
    bind(binding: KeyBinding): void {
        this.bindings.push(binding);
    }

    /**
     * Remove a key binding
     */
    unbind(action: string): void {
        this.bindings = this.bindings.filter(b => b.action !== action);
    }

    /**
     * Handle keydown events
     */
    private handleKeyDown(event: KeyboardEvent): void {
        // Skip if in input element
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }

        for (const binding of this.bindings) {
            if (this.matchBinding(event, binding)) {
                event.preventDefault();
                binding.handler();
                return;
            }
        }
    }

    /**
     * Check if event matches binding
     */
    private matchBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
        return (
            event.key === binding.key &&
            !!event.ctrlKey === !!binding.ctrl &&
            !!event.shiftKey === !!binding.shift &&
            !!event.altKey === !!binding.alt &&
            !!event.metaKey === !!binding.meta
        );
    }

    /**
     * Setup mouse handlers
     */
    private setupMouseHandlers(): void {
        const canvas = this.sceneManager.getCanvas();
        if (!canvas) return;

        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        canvas.addEventListener('click', (e) => this.handleClick(e));
        canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
    }

    private handleMouseDown(event: MouseEvent): void {
        const hit = this.sceneManager.raycast(event.clientX, event.clientY);

        // Check if clicking on a panel
        if (hit && hit.userData?.panelId) {
            this.isDragging = true;
            this.dragTarget = hit.userData.panelId;
            this.dragOffset = {
                x: event.clientX,
                y: event.clientY
            };

            // Select panel
            this.panelManager.selectPanel(hit.userData.panelId);
            return;
        }

        // Check if clicking on a grid block
        if (hit && hit.object.userData?.type === 'grid-block') {
            const gridManager = this.sceneManager.getGridManager();
            const { gridX, gridY } = hit.object.userData;

            if (event.shiftKey) {
                // Shift+click lowers block
                const block = gridManager.getBlock(gridX, gridY);
                if (block) {
                    gridManager.setBlockHeight(gridX, gridY, block.height - 50);
                }
            } else if (event.ctrlKey) {
                // Ctrl+click selects block
                gridManager.selectBlock(gridX, gridY);
            } else {
                // Regular click extrudes
                const block = gridManager.getBlock(gridX, gridY);
                if (block) {
                    gridManager.setBlockHeight(gridX, gridY, block.height + 50);
                }
            }
            return;
        }

        // Check if clicking on empty grid
        const gridPos = this.sceneManager.raycastToGridPlane(event.clientX, event.clientY);
        if (gridPos) {
            const gridManager = this.sceneManager.getGridManager();
            if (!event.shiftKey && !event.ctrlKey) {
                // Create new block
                gridManager.handleGridClick(gridPos.x, gridPos.y, false);
            }
        }
    }

    private handleMouseMove(event: MouseEvent): void {
        if (this.isDragging && this.dragTarget) {
            const dx = event.clientX - this.dragOffset.x;
            const dy = event.clientY - this.dragOffset.y;

            this.panelManager.movePanel(this.dragTarget, dx, -dy);

            this.dragOffset = {
                x: event.clientX,
                y: event.clientY
            };
        } else {
            // Hover effect
            const hit = this.sceneManager.raycast(event.clientX, event.clientY);
            this.sceneManager.setHoveredObject(hit?.object || null);

            // Grid hover
            if (hit && hit.object.userData?.type === 'grid-block') {
                const gridManager = this.sceneManager.getGridManager();
                const { gridX, gridY } = hit.object.userData;
                gridManager.handleGridHover(gridX * 50, gridY * 50);
            } else {
                const gridPos = this.sceneManager.raycastToGridPlane(event.clientX, event.clientY);
                if (gridPos) {
                    const gridManager = this.sceneManager.getGridManager();
                    gridManager.handleGridHover(gridPos.x, gridPos.y);
                } else {
                    this.sceneManager.getGridManager().clearHover();
                }
            }
        }
    }

    private handleMouseUp(_event: MouseEvent): void {
        if (this.isDragging && this.dragTarget) {
            // Snap to grid if enabled
            this.panelManager.snapToGrid(this.dragTarget);
        }

        this.isDragging = false;
        this.dragTarget = null;
    }

    private handleClick(event: MouseEvent): void {
        const hit = this.sceneManager.raycast(event.clientX, event.clientY);
        if (hit && hit.userData?.panelId) {
            this.panelManager.selectPanel(hit.userData.panelId);
        } else {
            this.panelManager.deselectAll();
        }
    }

    private handleDoubleClick(event: MouseEvent): void {
        const hit = this.sceneManager.raycast(event.clientX, event.clientY);

        // Double-click on panel - focus camera
        if (hit && hit.userData?.panelId) {
            const panel = this.panelManager.getPanel(hit.userData.panelId);
            if (panel) {
                const pos = panel.getPosition();
                this.sceneManager.focusOn(pos);
            }
            this.panelManager.focusPanel(hit.userData.panelId);
        }
    }

    private handleContextMenu(event: MouseEvent): void {
        event.preventDefault();

        const hit = this.sceneManager.raycast(event.clientX, event.clientY);
        if (hit && hit.userData?.panelId) {
            this.showPanelContextMenu(hit.userData.panelId, event.clientX, event.clientY);
        } else {
            this.showCanvasContextMenu(event.clientX, event.clientY);
        }
    }

    /**
     * Setup touch handlers
     */
    private setupTouchHandlers(): void {
        const canvas = this.sceneManager.getCanvas();
        if (!canvas) return;

        let lastTouchDistance = 0;

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
            } else if (e.touches.length === 2) {
                // Pinch gesture start
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
            }
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();

            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
            } else if (e.touches.length === 2) {
                // Pinch gesture
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const delta = distance - lastTouchDistance;
                if (delta > 5) {
                    this.sceneManager.zoomIn();
                } else if (delta < -5) {
                    this.sceneManager.zoomOut();
                }

                lastTouchDistance = distance;
            }
        });

        canvas.addEventListener('touchend', () => {
            this.handleMouseUp({} as MouseEvent);
        });
    }

    /**
     * Setup wheel handlers
     */
    private setupWheelHandlers(): void {
        const canvas = this.sceneManager.getCanvas();
        if (!canvas) return;

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            if (e.ctrlKey || e.metaKey) {
                // Zoom
                if (e.deltaY < 0) {
                    this.sceneManager.zoomIn();
                } else {
                    this.sceneManager.zoomOut();
                }
            } else {
                // Pan
                this.sceneManager.pan(-e.deltaX, e.deltaY);
            }
        }, { passive: false });
    }

    // Action handlers

    private handleCancel(): void {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragTarget = null;
        } else {
            this.panelManager.deselectAll();
        }
    }

    private handleFocusNext(): void {
        this.panelManager.focusNextPanel();
    }

    private handleFocusPrev(): void {
        this.panelManager.focusPrevPanel();
    }

    private navigatePanel(direction: 'left' | 'right' | 'up' | 'down'): void {
        this.panelManager.navigatePanel(direction);
    }

    private showPanelContextMenu(panelId: string, x: number, y: number): void {
        console.log('[InputManager] Panel context menu:', panelId, x, y);
        // TODO: Implement context menu
    }

    private showCanvasContextMenu(x: number, y: number): void {
        console.log('[InputManager] Canvas context menu:', x, y);
        // TODO: Implement context menu
    }
}
