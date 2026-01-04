/**
 * Window Manager - Manages Electron browser windows
 */

import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

export interface WindowConfig {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    title?: string;
    backgroundColor?: string;
}

export class WindowManager {
    private mainWindow: BrowserWindow | null = null;
    private windows: Map<string, BrowserWindow> = new Map();

    private readonly defaultConfig: WindowConfig = {
        width: 1920,
        height: 1080,
        minWidth: 1280,
        minHeight: 720,
        title: 'FX Dreamweaver 3D',
        backgroundColor: '#0f172a'
    };

    /**
     * Create the main IDE window
     */
    async createMainWindow(): Promise<BrowserWindow> {
        const display = screen.getPrimaryDisplay();
        const { width, height } = display.workAreaSize;

        this.mainWindow = new BrowserWindow({
            width: Math.min(this.defaultConfig.width!, width),
            height: Math.min(this.defaultConfig.height!, height),
            minWidth: this.defaultConfig.minWidth,
            minHeight: this.defaultConfig.minHeight,
            title: this.defaultConfig.title,
            backgroundColor: this.defaultConfig.backgroundColor,
            show: false,
            frame: true,
            titleBarStyle: 'hiddenInset',
            trafficLightPosition: { x: 16, y: 16 },
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webgl: true,
                webSecurity: true
            }
        });

        // Load renderer
        if (process.env.NODE_ENV === 'development') {
            await this.mainWindow.loadURL('http://localhost:5173');
            this.mainWindow.webContents.openDevTools();
        } else {
            await this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
        }

        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow?.show();
            this.mainWindow?.focus();
        });

        // Handle close
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        this.windows.set('main', this.mainWindow);
        return this.mainWindow;
    }

    /**
     * Create a panel window (for detached panels)
     */
    createPanelWindow(panelId: string, config: Partial<WindowConfig> = {}): BrowserWindow {
        const panelWindow = new BrowserWindow({
            width: config.width || 800,
            height: config.height || 600,
            minWidth: 400,
            minHeight: 300,
            title: config.title || 'FX Panel',
            backgroundColor: this.defaultConfig.backgroundColor,
            parent: this.mainWindow || undefined,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webgl: true
            }
        });

        this.windows.set(panelId, panelWindow);

        panelWindow.on('closed', () => {
            this.windows.delete(panelId);
        });

        return panelWindow;
    }

    /**
     * Get the main window
     */
    getMainWindow(): BrowserWindow | null {
        return this.mainWindow;
    }

    /**
     * Get a window by ID
     */
    getWindow(id: string): BrowserWindow | undefined {
        return this.windows.get(id);
    }

    /**
     * Close all windows
     */
    closeAll(): void {
        for (const window of this.windows.values()) {
            window.close();
        }
        this.windows.clear();
    }

    /**
     * Send message to main window
     */
    sendToMain(channel: string, ...args: any[]): void {
        this.mainWindow?.webContents.send(channel, ...args);
    }

    /**
     * Broadcast to all windows
     */
    broadcast(channel: string, ...args: any[]): void {
        for (const window of this.windows.values()) {
            window.webContents.send(channel, ...args);
        }
    }
}
