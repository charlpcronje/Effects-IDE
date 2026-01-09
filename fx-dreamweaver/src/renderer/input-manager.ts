/**
 * Input Manager - Handles keyboard, mouse, and gesture input
 */

import { SceneManager } from '../scene/scene-manager';
import { PanelManager } from '../panels/panel-manager';
import { SurfaceSnapper } from '../scene/surface-snapper';

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
    private surfaceSnapper: SurfaceSnapper | null = null;
    private bindings: KeyBinding[] = [];
    private isDragging: boolean = false;
    private dragTarget: string | null = null;
    private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
    private isDragSelecting: boolean = false;
    private selectionStart: { x: number; y: number } | null = null;
    private isRotatingCamera: boolean = false;
    private ctrlTapCount: number = 0;
    private ctrlTapTimer: number | null = null;

    constructor(sceneManager: SceneManager, panelManager: PanelManager) {
        this.sceneManager = sceneManager;
        this.panelManager = panelManager;
        this.surfaceSnapper = new SurfaceSnapper(sceneManager.getGridManager());
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
     * Handle Ctrl triple-tap for view cycling
     */
    private handleCtrlTap(): void {
        this.ctrlTapCount++;

        // Clear previous timer
        if (this.ctrlTapTimer) {
            clearTimeout(this.ctrlTapTimer);
        }

        // Reset after 500ms
        this.ctrlTapTimer = window.setTimeout(() => {
            this.ctrlTapCount = 0;
        }, 500);

        // On third tap, cycle views
        if (this.ctrlTapCount === 3) {
            this.ctrlTapCount = 0;
            this.cycleViewMode();
        }
    }

    /**
     * Cycle through view modes
     */
    private cycleViewMode(): void {
        const current = this.sceneManager.getViewMode();
        const modes: Array<'2d' | '3d' | 'hybrid' | 'free'> = ['2d', '3d', 'hybrid', 'free'];
        const currentIndex = modes.indexOf(current);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.sceneManager.setViewMode(modes[nextIndex]);
        console.log(`[InputManager] View cycled to: ${modes[nextIndex]}`);
    }

    /**
     * Setup default keyboard bindings
     */
    private setupKeyboardBindings(): void {
        // Core shortcuts
        this.bind({ key: 'Escape', action: 'cancel', handler: () => this.handleCancel() });
        this.bind({ key: 'Tab', action: 'focusNext', handler: () => this.handleFocusNext() });
        this.bind({ key: 'Tab', shift: true, action: 'focusPrev', handler: () => this.handleFocusPrev() });

        // View controls (disabled - use triple-tap Ctrl instead)
        // this.bind({ key: '1', ctrl: true, action: 'view2d', handler: () => this.sceneManager.setViewMode('2d') });
        // this.bind({ key: '2', ctrl: true, action: 'view3d', handler: () => this.sceneManager.setViewMode('3d') });
        // this.bind({ key: '3', ctrl: true, action: 'viewHybrid', handler: () => this.sceneManager.setViewMode('hybrid') });

        // Triple-tap Ctrl for view cycling
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Control') {
                this.handleCtrlTap();
            }
        });

        // Zoom
        this.bind({ key: '=', ctrl: true, action: 'zoomIn', handler: () => this.sceneManager.zoomIn() });
        this.bind({ key: '-', ctrl: true, action: 'zoomOut', handler: () => this.sceneManager.zoomOut() });
        this.bind({ key: '0', ctrl: true, action: 'zoomReset', handler: () => this.sceneManager.zoomReset() });

        // Panel navigation
        this.bind({ key: 'ArrowLeft', alt: true, action: 'panelLeft', handler: () => this.navigatePanel('left') });
        this.bind({ key: 'ArrowRight', alt: true, action: 'panelRight', handler: () => this.navigatePanel('right') });
        this.bind({ key: 'ArrowUp', alt: true, action: 'panelUp', handler: () => this.navigatePanel('up') });
        this.bind({ key: 'ArrowDown', alt: true, action: 'panelDown', handler: () => this.navigatePanel('down') });

        // Node graph toggle
        this.bind({ key: 'n', ctrl: true, shift: true, action: 'toggleNodeGraph', handler: () => {
            const visualizer = this.sceneManager.getNodeGraphVisualizer();
            if (visualizer) visualizer.toggle();
        }});

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

            if (event.altKey) {
                // Alt+click extrudes from side based on click position on block
                const block = gridManager.getBlock(gridX, gridY);
                if (block) {
                    // Determine which side was clicked based on hit point
                    const localPoint = hit.point.clone().sub(block.mesh.position);
                    const absX = Math.abs(localPoint.x);
                    const absY = Math.abs(localPoint.y);

                    let direction: 'north' | 'south' | 'east' | 'west';

                    if (absX > absY) {
                        direction = localPoint.x > 0 ? 'east' : 'west';
                    } else {
                        direction = localPoint.y > 0 ? 'north' : 'south';
                    }

                    gridManager.extrudeFromSide(gridX, gridY, direction);
                }
            } else if (event.shiftKey) {
                // Shift+click lowers block
                const block = gridManager.getBlock(gridX, gridY);
                if (block) {
                    gridManager.setBlockHeight(gridX, gridY, block.height - 50);
                }
            } else if (event.ctrlKey) {
                // Ctrl+click toggles block selection
                gridManager.selectBlock(gridX, gridY);
            } else {
                // Regular click extrudes (including all selected blocks!)
                const block = gridManager.getBlock(gridX, gridY);
                if (block) {
                    // If this block is selected, extrude all selected blocks
                    const selectedBlocks = gridManager.getAllBlocks().filter((b: any) =>
                        (b.mesh.material as any).color.getHex() === 0x8b5cf6
                    );

                    if (selectedBlocks.length > 0) {
                        // Extrude all selected blocks
                        for (const selectedBlock of selectedBlocks) {
                            gridManager.setBlockHeight(
                                selectedBlock.gridX,
                                selectedBlock.gridY,
                                selectedBlock.height + 50
                            );
                        }
                    } else {
                        // Just this block
                        gridManager.setBlockHeight(gridX, gridY, block.height + 50);
                    }
                }
            }
            return;
        }

        // Check if clicking on empty grid to start drag-select
        const gridPos = this.sceneManager.raycastToGridPlane(event.clientX, event.clientY);
        if (gridPos && event.ctrlKey) {
            // Start drag selection
            this.isDragSelecting = true;
            this.selectionStart = { x: event.clientX, y: event.clientY };
        } else if (gridPos) {
            // Create new block
            const gridManager = this.sceneManager.getGridManager();
            gridManager.handleGridClick(gridPos.x, gridPos.y, false);
        }
    }

    private handleMouseMove(event: MouseEvent): void {
        // Handle camera rotation
        if (this.isRotatingCamera) {
            this.sceneManager.getCameraController().updateRotation(event.clientX, event.clientY);
            return;
        }

        // Handle drag selection
        if (this.isDragSelecting && this.selectionStart) {
            const dx = Math.abs(event.clientX - this.selectionStart.x);
            const dy = Math.abs(event.clientY - this.selectionStart.y);

            // Only treat as drag-select if moved > 10 pixels
            if (dx > 10 || dy > 10) {
                // Select blocks in rectangle
                this.selectBlocksInRectangle(
                    this.selectionStart.x,
                    this.selectionStart.y,
                    event.clientX,
                    event.clientY
                );
            }
        } else if (this.isDragging && this.dragTarget) {
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

            // Icon hover
            if (hit && hit.object.userData?.type === 'grid-icon') {
                const iconManager = this.sceneManager.getIconManager();
                iconManager.handleIconHover(hit.object.userData.iconId);
            } else {
                this.sceneManager.getIconManager().handleIconHover(null);
            }

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
        // Stop camera rotation
        if (this.isRotatingCamera) {
            this.sceneManager.getCameraController().stopRotation();
            this.isRotatingCamera = false;
        }

        if (this.isDragging && this.dragTarget) {
            // Try surface snapping first
            const panel = this.panelManager.getPanel(this.dragTarget);
            if (panel && this.surfaceSnapper) {
                const panelPos = panel.getPosition();
                const surface = this.surfaceSnapper.snapToSurface(panelPos);

                if (surface) {
                    // Snap to surface
                    panel.setPosition(surface.position.x, surface.position.y, surface.position.z);

                    // Rotate panel to align with surface
                    const rotation = this.surfaceSnapper.getRotationForSurface(surface.face);
                    const controls = panel.getControls();
                    const transform = controls.getTransform();
                    transform.rotation.copy(rotation);
                    controls.setTransform(transform);

                    console.log(`[InputManager] Snapped to ${surface.face} of block at (${surface.block.gridX}, ${surface.block.gridY})`);
                } else {
                    // Regular grid snap
                    this.panelManager.snapToGrid(this.dragTarget);
                }
            }
        }

        if (this.isDragSelecting) {
            this.isDragSelecting = false;
            this.selectionStart = null;
        }

        this.isDragging = false;
        this.dragTarget = null;
    }

    /**
     * Select blocks in a rectangle
     */
    private selectBlocksInRectangle(x1: number, y1: number, x2: number, y2: number): void {
        const gridManager = this.sceneManager.getGridManager();
        const blocks = gridManager.getAllBlocks();

        // Clear existing selection first
        gridManager.deselectAllBlocks();

        // Get screen bounds
        const canvas = this.sceneManager.getCanvas();
        const camera = this.sceneManager.getCamera();

        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        // Project each block to screen space and check if in rectangle
        for (const block of blocks) {
            const screenPos = block.mesh.position.clone();
            screenPos.project(camera);

            const rect = canvas.getBoundingClientRect();
            const screenX = (screenPos.x * 0.5 + 0.5) * rect.width + rect.left;
            const screenY = (-(screenPos.y * 0.5) + 0.5) * rect.height + rect.top;

            if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
                gridManager.selectBlock(block.gridX, block.gridY);
            }
        }
    }

    private handleClick(event: MouseEvent): void {
        const hit = this.sceneManager.raycast(event.clientX, event.clientY);

        // Click on FX node
        if (hit && hit.userData?.type === 'fx-node') {
            const visualizer = this.sceneManager.getNodeGraphVisualizer();
            if (visualizer) {
                visualizer.handleNodeClick(hit.userData.nodePath, event.ctrlKey);
            }
            return;
        }

        // Click on icon
        if (hit && hit.userData?.type === 'grid-icon') {
            const iconManager = this.sceneManager.getIconManager();
            iconManager.handleIconClick(hit.userData.iconId);
            return;
        }

        // Shift+click on panel to zoom
        if (event.shiftKey && hit && hit.userData?.panelId) {
            const panel = this.panelManager.getPanel(hit.userData.panelId);
            if (panel) {
                panel.getControls().zoomIn();
            }
            return;
        }

        // Regular click to select
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
        // Don't prevent default if we're going to start camera rotation
        const hit = this.sceneManager.raycast(event.clientX, event.clientY);

        // Right-click on grid block to lower it (only if Ctrl not held)
        if (hit && hit.object.userData?.type === 'grid-block' && !event.ctrlKey) {
            event.preventDefault();
            const gridManager = this.sceneManager.getGridManager();
            const { gridX, gridY } = hit.object.userData;
            const block = gridManager.getBlock(gridX, gridY);

            if (block) {
                const newHeight = block.height - 50;
                if (newHeight <= 0) {
                    gridManager.removeBlock(gridX, gridY);
                } else {
                    gridManager.setBlockHeight(gridX, gridY, newHeight);
                }
            }
            return;
        }

        // Right-click on empty space in free mode - start camera rotation
        if (this.sceneManager.getViewMode() === 'free' && !hit) {
            event.preventDefault();
            this.isRotatingCamera = true;
            this.sceneManager.getCameraController().startRotation(event.clientX, event.clientY);
            return;
        }

        // Right-click on panel
        event.preventDefault();
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

            // Check if hovering over a panel
            const hit = this.sceneManager.raycast(e.clientX, e.clientY);

            if (hit && hit.userData?.panelId && !e.ctrlKey && !e.metaKey) {
                // Mouse wheel on panel - rotate it!
                const panel = this.panelManager.getPanel(hit.userData.panelId);
                if (panel) {
                    const controls = panel.getControls();

                    if (e.shiftKey) {
                        // Shift+wheel = rotate Y axis (spin)
                        controls.rotateY(e.deltaY > 0 ? 0.1 : -0.1);
                    } else if (e.altKey) {
                        // Alt+wheel = rotate X axis (tilt)
                        controls.rotateX(e.deltaY > 0 ? 0.1 : -0.1);
                    } else {
                        // Regular wheel = rotate Z axis
                        controls.rotateZ(e.deltaY > 0 ? 0.1 : -0.1);
                    }
                }
            } else if (e.ctrlKey || e.metaKey) {
                // Ctrl+wheel = Zoom camera (or zoom in free mode)
                if (this.sceneManager.getViewMode() === 'free') {
                    this.sceneManager.getCameraController().zoom(e.deltaY > 0 ? -1 : 1);
                } else {
                    if (e.deltaY < 0) {
                        this.sceneManager.zoomIn();
                    } else {
                        this.sceneManager.zoomOut();
                    }
                }
            } else {
                // Regular wheel = Pan camera (or move in free mode)
                if (this.sceneManager.getViewMode() === 'free') {
                    // In free mode, wheel moves camera forward/back
                    this.sceneManager.getCameraController().zoom(e.deltaY > 0 ? -0.5 : 0.5);
                } else {
                    this.sceneManager.pan(-e.deltaX, e.deltaY);
                }
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
