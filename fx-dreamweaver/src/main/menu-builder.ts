/**
 * Menu Builder - Constructs the application menu
 */

import { Menu, MenuItem, MenuItemConstructorOptions, BrowserWindow, app, dialog } from 'electron';

export class MenuBuilder {
    /**
     * Build the application menu
     */
    build(): Menu {
        const template: MenuItemConstructorOptions[] = [
            this.buildFileMenu(),
            this.buildEditMenu(),
            this.buildViewMenu(),
            this.buildPanelsMenu(),
            this.buildAIMenu(),
            this.buildToolsMenu(),
            this.buildHelpMenu()
        ];

        // macOS app menu
        if (process.platform === 'darwin') {
            template.unshift(this.buildAppMenu());
        }

        return Menu.buildFromTemplate(template);
    }

    private buildAppMenu(): MenuItemConstructorOptions {
        return {
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                {
                    label: 'Preferences...',
                    accelerator: 'Cmd+,',
                    click: () => this.sendToFocused('menu:preferences')
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        };
    }

    private buildFileMenu(): MenuItemConstructorOptions {
        return {
            label: 'File',
            submenu: [
                {
                    label: 'New Project',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => this.sendToFocused('menu:new-project')
                },
                {
                    label: 'Open Project...',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => this.openProject()
                },
                {
                    label: 'Open Recent',
                    submenu: [
                        { label: 'No recent projects', enabled: false }
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => this.sendToFocused('menu:save')
                },
                {
                    label: 'Save All',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => this.sendToFocused('menu:save-all')
                },
                { type: 'separator' },
                {
                    label: 'Export Workspace...',
                    click: () => this.sendToFocused('menu:export-workspace')
                },
                {
                    label: 'Import Workspace...',
                    click: () => this.sendToFocused('menu:import-workspace')
                },
                { type: 'separator' },
                process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
            ]
        };
    }

    private buildEditMenu(): MenuItemConstructorOptions {
        return {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
                { type: 'separator' },
                {
                    label: 'Find',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => this.sendToFocused('menu:find')
                },
                {
                    label: 'Find in Files',
                    accelerator: 'CmdOrCtrl+Shift+F',
                    click: () => this.sendToFocused('menu:find-in-files')
                },
                {
                    label: 'Replace',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => this.sendToFocused('menu:replace')
                }
            ]
        };
    }

    private buildViewMenu(): MenuItemConstructorOptions {
        return {
            label: 'View',
            submenu: [
                {
                    label: 'Command Palette',
                    accelerator: 'CmdOrCtrl+Shift+P',
                    click: () => this.sendToFocused('menu:command-palette')
                },
                { type: 'separator' },
                {
                    label: '2D Layout',
                    accelerator: 'CmdOrCtrl+1',
                    click: () => this.sendToFocused('menu:view-2d')
                },
                {
                    label: '3D Layout',
                    accelerator: 'CmdOrCtrl+2',
                    click: () => this.sendToFocused('menu:view-3d')
                },
                {
                    label: 'Hybrid Layout',
                    accelerator: 'CmdOrCtrl+3',
                    click: () => this.sendToFocused('menu:view-hybrid')
                },
                { type: 'separator' },
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+Plus',
                    click: () => this.sendToFocused('menu:zoom-in')
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => this.sendToFocused('menu:zoom-out')
                },
                {
                    label: 'Reset Zoom',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => this.sendToFocused('menu:zoom-reset')
                },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { role: 'toggleDevTools' }
            ]
        };
    }

    private buildPanelsMenu(): MenuItemConstructorOptions {
        return {
            label: 'Panels',
            submenu: [
                {
                    label: 'File Explorer',
                    accelerator: 'CmdOrCtrl+Shift+E',
                    click: () => this.sendToFocused('menu:panel-explorer')
                },
                {
                    label: 'Code Editor',
                    accelerator: 'CmdOrCtrl+Shift+C',
                    click: () => this.sendToFocused('menu:panel-editor')
                },
                {
                    label: 'Terminal',
                    accelerator: 'CmdOrCtrl+`',
                    click: () => this.sendToFocused('menu:panel-terminal')
                },
                {
                    label: 'AI Chat',
                    accelerator: 'CmdOrCtrl+Shift+A',
                    click: () => this.sendToFocused('menu:panel-ai')
                },
                { type: 'separator' },
                {
                    label: 'Node Graph',
                    click: () => this.sendToFocused('menu:panel-node-graph')
                },
                {
                    label: 'Database Browser',
                    click: () => this.sendToFocused('menu:panel-database')
                },
                {
                    label: 'API Studio',
                    click: () => this.sendToFocused('menu:panel-api')
                },
                {
                    label: 'Git',
                    click: () => this.sendToFocused('menu:panel-git')
                },
                { type: 'separator' },
                {
                    label: 'Theme Lab',
                    click: () => this.sendToFocused('menu:panel-theme-lab')
                },
                {
                    label: 'Plugin Marketplace',
                    click: () => this.sendToFocused('menu:panel-marketplace')
                }
            ]
        };
    }

    private buildAIMenu(): MenuItemConstructorOptions {
        return {
            label: 'AI',
            submenu: [
                {
                    label: 'New Chat',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => this.sendToFocused('menu:ai-new-chat')
                },
                {
                    label: 'Clear Context',
                    click: () => this.sendToFocused('menu:ai-clear-context')
                },
                { type: 'separator' },
                {
                    label: 'Claude 3.5 Sonnet',
                    type: 'radio',
                    checked: true,
                    click: () => this.sendToFocused('menu:ai-model', 'claude-3.5-sonnet')
                },
                {
                    label: 'Claude 3.5 Haiku',
                    type: 'radio',
                    click: () => this.sendToFocused('menu:ai-model', 'claude-3.5-haiku')
                },
                {
                    label: 'GPT-4.1 Turbo',
                    type: 'radio',
                    click: () => this.sendToFocused('menu:ai-model', 'gpt-4.1-turbo')
                },
                { type: 'separator' },
                {
                    label: 'Permissions...',
                    click: () => this.sendToFocused('menu:ai-permissions')
                },
                {
                    label: 'MCP Server Status',
                    click: () => this.sendToFocused('menu:ai-mcp-status')
                }
            ]
        };
    }

    private buildToolsMenu(): MenuItemConstructorOptions {
        return {
            label: 'Tools',
            submenu: [
                {
                    label: 'Build Project',
                    accelerator: 'CmdOrCtrl+B',
                    click: () => this.sendToFocused('menu:build')
                },
                {
                    label: 'Run',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => this.sendToFocused('menu:run')
                },
                {
                    label: 'Run Tests',
                    accelerator: 'CmdOrCtrl+T',
                    click: () => this.sendToFocused('menu:run-tests')
                },
                { type: 'separator' },
                {
                    label: 'Lint',
                    click: () => this.sendToFocused('menu:lint')
                },
                {
                    label: 'Format',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click: () => this.sendToFocused('menu:format')
                },
                { type: 'separator' },
                {
                    label: 'Voice Commands',
                    click: () => this.sendToFocused('menu:voice-commands')
                }
            ]
        };
    }

    private buildHelpMenu(): MenuItemConstructorOptions {
        return {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => this.sendToFocused('menu:help-docs')
                },
                {
                    label: 'Keyboard Shortcuts',
                    accelerator: 'CmdOrCtrl+/',
                    click: () => this.sendToFocused('menu:help-shortcuts')
                },
                { type: 'separator' },
                {
                    label: 'Report Issue...',
                    click: () => this.sendToFocused('menu:help-report')
                },
                {
                    label: 'About FX Dreamweaver',
                    click: () => this.sendToFocused('menu:help-about')
                }
            ]
        };
    }

    private sendToFocused(channel: string, ...args: any[]): void {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            win.webContents.send(channel, ...args);
        }
    }

    private async openProject(): Promise<void> {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return;

        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory'],
            title: 'Open Project'
        });

        if (!result.canceled && result.filePaths.length > 0) {
            win.webContents.send('menu:open-project', result.filePaths[0]);
        }
    }
}
