/**
 * IPC Handlers - Main process IPC communication
 */

import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

interface PTYSession {
    id: string;
    process: ChildProcess;
    cwd: string;
}

export class IPCHandlers {
    private ptySessions: Map<string, PTYSession> = new Map();

    /**
     * Register all IPC handlers
     */
    register(): void {
        // File system operations
        ipcMain.handle('fs:read', this.handleFsRead.bind(this));
        ipcMain.handle('fs:write', this.handleFsWrite.bind(this));
        ipcMain.handle('fs:readdir', this.handleFsReaddir.bind(this));
        ipcMain.handle('fs:stat', this.handleFsStat.bind(this));
        ipcMain.handle('fs:mkdir', this.handleFsMkdir.bind(this));
        ipcMain.handle('fs:delete', this.handleFsDelete.bind(this));
        ipcMain.handle('fs:rename', this.handleFsRename.bind(this));

        // PTY operations
        ipcMain.handle('pty:spawn', this.handlePtySpawn.bind(this));
        ipcMain.handle('pty:write', this.handlePtyWrite.bind(this));
        ipcMain.handle('pty:resize', this.handlePtyResize.bind(this));
        ipcMain.handle('pty:kill', this.handlePtyKill.bind(this));

        // Dialog operations
        ipcMain.handle('dialog:open', this.handleDialogOpen.bind(this));
        ipcMain.handle('dialog:save', this.handleDialogSave.bind(this));
        ipcMain.handle('dialog:message', this.handleDialogMessage.bind(this));

        // Shell operations
        ipcMain.handle('shell:openExternal', this.handleShellOpenExternal.bind(this));
        ipcMain.handle('shell:showItemInFolder', this.handleShellShowItem.bind(this));

        // Window operations
        ipcMain.handle('window:minimize', this.handleWindowMinimize.bind(this));
        ipcMain.handle('window:maximize', this.handleWindowMaximize.bind(this));
        ipcMain.handle('window:close', this.handleWindowClose.bind(this));

        // App info
        ipcMain.handle('app:getPath', this.handleAppGetPath.bind(this));
        ipcMain.handle('app:getVersion', this.handleAppGetVersion.bind(this));
    }

    // File System Handlers
    private async handleFsRead(_event: Electron.IpcMainInvokeEvent, filePath: string): Promise<string> {
        return await fs.readFile(filePath, 'utf-8');
    }

    private async handleFsWrite(_event: Electron.IpcMainInvokeEvent, filePath: string, content: string): Promise<void> {
        await fs.writeFile(filePath, content, 'utf-8');
    }

    private async handleFsReaddir(_event: Electron.IpcMainInvokeEvent, dirPath: string): Promise<any[]> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            path: path.join(dirPath, entry.name)
        }));
    }

    private async handleFsStat(_event: Electron.IpcMainInvokeEvent, filePath: string): Promise<any> {
        const stat = await fs.stat(filePath);
        return {
            size: stat.size,
            mtime: stat.mtime.toISOString(),
            ctime: stat.ctime.toISOString(),
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile()
        };
    }

    private async handleFsMkdir(_event: Electron.IpcMainInvokeEvent, dirPath: string): Promise<void> {
        await fs.mkdir(dirPath, { recursive: true });
    }

    private async handleFsDelete(_event: Electron.IpcMainInvokeEvent, filePath: string): Promise<void> {
        await fs.rm(filePath, { recursive: true, force: true });
    }

    private async handleFsRename(_event: Electron.IpcMainInvokeEvent, oldPath: string, newPath: string): Promise<void> {
        await fs.rename(oldPath, newPath);
    }

    // PTY Handlers
    private async handlePtySpawn(event: Electron.IpcMainInvokeEvent, options: { cwd?: string; shell?: string }): Promise<string> {
        const id = `pty-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const shell = options.shell || process.env.SHELL || '/bin/bash';
        const cwd = options.cwd || process.env.HOME || '/';

        const proc = spawn(shell, [], {
            cwd,
            env: { ...process.env, TERM: 'xterm-256color' },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        proc.stdout?.on('data', (data: Buffer) => {
            event.sender.send(`pty:data:${id}`, data.toString());
        });

        proc.stderr?.on('data', (data: Buffer) => {
            event.sender.send(`pty:data:${id}`, data.toString());
        });

        proc.on('exit', (code: number | null) => {
            event.sender.send(`pty:exit:${id}`, code);
            this.ptySessions.delete(id);
        });

        this.ptySessions.set(id, { id, process: proc, cwd });
        return id;
    }

    private async handlePtyWrite(_event: Electron.IpcMainInvokeEvent, sessionId: string, data: string): Promise<void> {
        const session = this.ptySessions.get(sessionId);
        if (session) {
            session.process.stdin?.write(data);
        }
    }

    private async handlePtyResize(_event: Electron.IpcMainInvokeEvent, sessionId: string, cols: number, rows: number): Promise<void> {
        // PTY resize would require node-pty for full support
        // This is a simplified implementation
    }

    private async handlePtyKill(_event: Electron.IpcMainInvokeEvent, sessionId: string): Promise<void> {
        const session = this.ptySessions.get(sessionId);
        if (session) {
            session.process.kill();
            this.ptySessions.delete(sessionId);
        }
    }

    // Dialog Handlers
    private async handleDialogOpen(event: Electron.IpcMainInvokeEvent, options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            return await dialog.showOpenDialog(win, options);
        }
        return await dialog.showOpenDialog(options);
    }

    private async handleDialogSave(event: Electron.IpcMainInvokeEvent, options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            return await dialog.showSaveDialog(win, options);
        }
        return await dialog.showSaveDialog(options);
    }

    private async handleDialogMessage(event: Electron.IpcMainInvokeEvent, options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            return await dialog.showMessageBox(win, options);
        }
        return await dialog.showMessageBox(options);
    }

    // Shell Handlers
    private async handleShellOpenExternal(_event: Electron.IpcMainInvokeEvent, url: string): Promise<void> {
        await shell.openExternal(url);
    }

    private async handleShellShowItem(_event: Electron.IpcMainInvokeEvent, fullPath: string): Promise<void> {
        shell.showItemInFolder(fullPath);
    }

    // Window Handlers
    private handleWindowMinimize(event: Electron.IpcMainInvokeEvent): void {
        BrowserWindow.fromWebContents(event.sender)?.minimize();
    }

    private handleWindowMaximize(event: Electron.IpcMainInvokeEvent): void {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win?.isMaximized()) {
            win.unmaximize();
        } else {
            win?.maximize();
        }
    }

    private handleWindowClose(event: Electron.IpcMainInvokeEvent): void {
        BrowserWindow.fromWebContents(event.sender)?.close();
    }

    // App Handlers
    private handleAppGetPath(_event: Electron.IpcMainInvokeEvent, name: string): string {
        const { app } = require('electron');
        return app.getPath(name as any);
    }

    private handleAppGetVersion(): string {
        const { app } = require('electron');
        return app.getVersion();
    }
}
