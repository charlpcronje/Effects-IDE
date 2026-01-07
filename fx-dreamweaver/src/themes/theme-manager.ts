/**
 * Theme Manager - Manages IDE themes and appearance
 */

import { FXBridge } from '../renderer/fx-bridge';

export interface Theme {
    id: string;
    name: string;
    colors: {
        background: string;
        surface: string;
        surfaceHover: string;
        primary: string;
        primaryDark: string;
        secondary: string;
        text: string;
        textSecondary: string;
        border: string;
        success: string;
        warning: string;
        error: string;
    };
    fonts: {
        ui: string;
        code: string;
    };
}

export class ThemeManager {
    private fxBridge: FXBridge;
    private currentTheme: Theme;
    private themes: Map<string, Theme> = new Map();
    private styleElement: HTMLStyleElement | null = null;

    constructor(fxBridge: FXBridge) {
        this.fxBridge = fxBridge;
        this.currentTheme = this.createDefaultDarkTheme();
        this.registerBuiltinThemes();
    }

    /**
     * Initialize theme manager
     */
    async init(): Promise<void> {
        // Create style element
        this.styleElement = document.createElement('style');
        this.styleElement.id = 'fx-theme';
        document.head.appendChild(this.styleElement);

        // Apply current theme
        this.applyTheme(this.currentTheme);

        // Watch for theme changes
        this.fxBridge.watch('settings.theme', (themeId) => {
            if (themeId && this.themes.has(themeId)) {
                this.setTheme(themeId);
            }
        });

        console.log('[ThemeManager] Initialized');
    }

    /**
     * Register built-in themes
     */
    private registerBuiltinThemes(): void {
        // Dark theme
        this.themes.set('dark', this.createDefaultDarkTheme());

        // Light theme
        this.themes.set('light', {
            id: 'light',
            name: 'Light',
            colors: {
                background: '#ffffff',
                surface: '#f8fafc',
                surfaceHover: '#f1f5f9',
                primary: '#3b82f6',
                primaryDark: '#1d4ed8',
                secondary: '#64748b',
                text: '#0f172a',
                textSecondary: '#64748b',
                border: '#e2e8f0',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444'
            },
            fonts: {
                ui: 'system-ui, -apple-system, sans-serif',
                code: 'JetBrains Mono, Fira Code, monospace'
            }
        });

        // High contrast theme
        this.themes.set('high-contrast', {
            id: 'high-contrast',
            name: 'High Contrast',
            colors: {
                background: '#000000',
                surface: '#1a1a1a',
                surfaceHover: '#333333',
                primary: '#00ff00',
                primaryDark: '#00cc00',
                secondary: '#00ffff',
                text: '#ffffff',
                textSecondary: '#cccccc',
                border: '#ffffff',
                success: '#00ff00',
                warning: '#ffff00',
                error: '#ff0000'
            },
            fonts: {
                ui: 'system-ui, -apple-system, sans-serif',
                code: 'JetBrains Mono, Fira Code, monospace'
            }
        });

        // Midnight theme
        this.themes.set('midnight', {
            id: 'midnight',
            name: 'Midnight',
            colors: {
                background: '#0d1117',
                surface: '#161b22',
                surfaceHover: '#21262d',
                primary: '#58a6ff',
                primaryDark: '#388bfd',
                secondary: '#8b949e',
                text: '#c9d1d9',
                textSecondary: '#8b949e',
                border: '#30363d',
                success: '#3fb950',
                warning: '#d29922',
                error: '#f85149'
            },
            fonts: {
                ui: 'system-ui, -apple-system, sans-serif',
                code: 'JetBrains Mono, Fira Code, monospace'
            }
        });

        // Cyberpunk theme
        this.themes.set('cyberpunk', {
            id: 'cyberpunk',
            name: 'Cyberpunk',
            colors: {
                background: '#0a0a0f',
                surface: '#12121a',
                surfaceHover: '#1a1a25',
                primary: '#ff00ff',
                primaryDark: '#cc00cc',
                secondary: '#00ffff',
                text: '#f0f0f0',
                textSecondary: '#888888',
                border: '#2a2a35',
                success: '#00ff88',
                warning: '#ffcc00',
                error: '#ff3366'
            },
            fonts: {
                ui: 'system-ui, -apple-system, sans-serif',
                code: 'JetBrains Mono, Fira Code, monospace'
            }
        });
    }

    /**
     * Create default dark theme
     */
    private createDefaultDarkTheme(): Theme {
        return {
            id: 'dark',
            name: 'Dark',
            colors: {
                background: '#0f172a',
                surface: '#1e293b',
                surfaceHover: '#334155',
                primary: '#3b82f6',
                primaryDark: '#1d4ed8',
                secondary: '#64748b',
                text: '#f1f5f9',
                textSecondary: '#94a3b8',
                border: '#334155',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444'
            },
            fonts: {
                ui: 'system-ui, -apple-system, sans-serif',
                code: 'JetBrains Mono, Fira Code, monospace'
            }
        };
    }

    /**
     * Set theme by ID
     */
    setTheme(themeId: string): void {
        const theme = this.themes.get(themeId);
        if (theme) {
            this.currentTheme = theme;
            this.applyTheme(theme);
            this.fxBridge.set('settings.theme', themeId);
            this.fxBridge.emit('theme.change', { themeId });
        }
    }

    /**
     * Get current theme
     */
    getTheme(): Theme {
        return this.currentTheme;
    }

    /**
     * Get all themes
     */
    getAllThemes(): Theme[] {
        return Array.from(this.themes.values());
    }

    /**
     * Register custom theme
     */
    registerTheme(theme: Theme): void {
        this.themes.set(theme.id, theme);
    }

    /**
     * Apply theme to document
     */
    private applyTheme(theme: Theme): void {
        if (!this.styleElement) return;

        const css = `
            :root {
                --background: ${theme.colors.background};
                --surface: ${theme.colors.surface};
                --surface-hover: ${theme.colors.surfaceHover};
                --primary: ${theme.colors.primary};
                --primary-dark: ${theme.colors.primaryDark};
                --secondary: ${theme.colors.secondary};
                --text: ${theme.colors.text};
                --text-secondary: ${theme.colors.textSecondary};
                --border: ${theme.colors.border};
                --success: ${theme.colors.success};
                --warning: ${theme.colors.warning};
                --error: ${theme.colors.error};
                --yellow: ${theme.colors.warning};
                --green: ${theme.colors.success};
                --red: ${theme.colors.error};
                --font-ui: ${theme.fonts.ui};
                --font-code: ${theme.fonts.code};
            }

            body {
                background-color: var(--background);
                color: var(--text);
                font-family: var(--font-ui);
            }

            * {
                scrollbar-width: thin;
                scrollbar-color: var(--border) var(--surface);
            }

            *::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }

            *::-webkit-scrollbar-track {
                background: var(--surface);
            }

            *::-webkit-scrollbar-thumb {
                background: var(--border);
                border-radius: 4px;
            }

            *::-webkit-scrollbar-thumb:hover {
                background: var(--secondary);
            }

            ::selection {
                background: var(--primary);
                color: white;
            }
        `;

        this.styleElement.textContent = css;

        console.log('[ThemeManager] Applied theme:', theme.id);
    }

    /**
     * Export theme as JSON
     */
    exportTheme(themeId: string): string | null {
        const theme = this.themes.get(themeId);
        if (theme) {
            return JSON.stringify(theme, null, 2);
        }
        return null;
    }

    /**
     * Import theme from JSON
     */
    importTheme(json: string): Theme | null {
        try {
            const theme = JSON.parse(json) as Theme;
            if (theme.id && theme.name && theme.colors) {
                this.themes.set(theme.id, theme);
                return theme;
            }
        } catch (error) {
            console.error('[ThemeManager] Failed to import theme:', error);
        }
        return null;
    }
}
