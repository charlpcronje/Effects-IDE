/**
 * FX Dreamweaver 3D IDE - Main Process
 *
 * Electron main process entry point. Manages:
 * - Window lifecycle
 * - IPC communication
 * - Native OS integrations
 * - PTY terminals
 * - File system access
 */

import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import { WindowManager } from './window-manager';
import { MenuBuilder } from './menu-builder';
import { IPCHandlers } from './ipc-handlers';

class DreamweaverApp {
    private windowManager: WindowManager;
    private ipcHandlers: IPCHandlers;

    constructor() {
        this.windowManager = new WindowManager();
        this.ipcHandlers = new IPCHandlers();
        this.setupApp();
    }

    private setupApp(): void {
        // App lifecycle
        app.whenReady().then(() => this.onReady());
        app.on('window-all-closed', () => this.onAllWindowsClosed());
        app.on('activate', () => this.onActivate());

        // Security
        app.on('web-contents-created', (_, contents) => {
            contents.on('will-navigate', (event) => {
                event.preventDefault();
            });
        });
    }

    private async onReady(): Promise<void> {
        console.log('[Dreamweaver] Starting FX Dreamweaver 3D IDE...');

        // Setup IPC handlers
        this.ipcHandlers.register();

        // Build menu
        const menuBuilder = new MenuBuilder();
        Menu.setApplicationMenu(menuBuilder.build());

        // Create main window
        await this.windowManager.createMainWindow();

        console.log('[Dreamweaver] Ready');
    }

    private onAllWindowsClosed(): void {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    }

    private onActivate(): void {
        if (BrowserWindow.getAllWindows().length === 0) {
            this.windowManager.createMainWindow();
        }
    }
}

// Start application
new DreamweaverApp();
