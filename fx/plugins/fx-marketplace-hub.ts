// /plugins/fx-marketplace-hub.ts
/**
 * @fx-plugin fx-marketplace-hub
 * @fx-global $marketplace
 * @fx-description Plugin marketplace UI and installer backend
 * @fx-dependencies fx-bundle-vault
 * @fx-provides $marketplace
 * @fx-version 1.0.0
 *
 * FX Marketplace Hub Plugin - Plugin discovery, installation, updates,
 * and marketplace management for the FX ecosystem.
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MarketplacePlugin {
    id: string;
    name: string;
    displayName: string;
    description: string;
    version: string;
    author: Author;
    repository?: string;
    homepage?: string;
    license: string;
    tags: string[];
    category: string;
    downloads: number;
    rating: number;
    ratingCount: number;
    publishedAt: number;
    updatedAt: number;
    size: number;
    dependencies: string[];
    fxVersions: string[]; // Compatible FX versions
    verified: boolean;
    featured: boolean;
    icon?: string;
    screenshots?: string[];
    readme?: string;
}

export interface Author {
    name: string;
    email?: string;
    url?: string;
    verified: boolean;
}

export interface InstalledPlugin {
    id: string;
    name: string;
    version: string;
    installedAt: number;
    updatedAt: number;
    enabled: boolean;
    autoUpdate: boolean;
    path: string;
}

export interface PluginUpdate {
    id: string;
    currentVersion: string;
    latestVersion: string;
    changelog?: string;
    breaking: boolean;
}

export interface SearchOptions {
    query?: string;
    category?: string;
    tags?: string[];
    sort?: 'downloads' | 'rating' | 'recent' | 'name';
    order?: 'asc' | 'desc';
    verified?: boolean;
    featured?: boolean;
    limit?: number;
    offset?: number;
}

export interface SearchResult {
    plugins: MarketplacePlugin[];
    total: number;
    page: number;
    pageSize: number;
}

export interface InstallResult {
    success: boolean;
    plugin: InstalledPlugin | null;
    error?: string;
    warnings?: string[];
}

export interface MarketplaceConfig {
    registryUrl?: string;
    cacheTimeout?: number;
    autoCheckUpdates?: boolean;
    updateCheckInterval?: number;
    allowUnsigned?: boolean;
}

// ============================================================================
// Logger
// ============================================================================

class MarketplaceLogger {
    static log(level: string, message: string, data?: any): void {
        console.log(`[FX-MARKETPLACE:${level.toUpperCase()}]`, message, data ?? '');
    }
    static info(message: string, data?: any): void { this.log('info', message, data); }
    static warn(message: string, data?: any): void { this.log('warn', message, data); }
    static error(message: string, data?: any): void { this.log('error', message, data); }
    static debug(message: string, data?: any): void { this.log('debug', message, data); }
}

// ============================================================================
// Mock Registry Data (for development)
// ============================================================================

const MOCK_PLUGINS: MarketplacePlugin[] = [
    {
        id: 'fx-theme-pack',
        name: 'fx-theme-pack',
        displayName: 'FX Theme Pack',
        description: 'A collection of beautiful themes for FX Dreamweaver IDE',
        version: '1.2.0',
        author: { name: 'FX Team', verified: true },
        license: 'MIT',
        tags: ['themes', 'ui', 'customization'],
        category: 'themes',
        downloads: 12500,
        rating: 4.8,
        ratingCount: 245,
        publishedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
        size: 256000,
        dependencies: [],
        fxVersions: ['1.0.0'],
        verified: true,
        featured: true
    },
    {
        id: 'fx-snippets',
        name: 'fx-snippets',
        displayName: 'FX Code Snippets',
        description: 'Essential code snippets for FX development',
        version: '2.0.1',
        author: { name: 'Community', verified: false },
        license: 'MIT',
        tags: ['snippets', 'productivity', 'code'],
        category: 'productivity',
        downloads: 8750,
        rating: 4.5,
        ratingCount: 156,
        publishedAt: Date.now() - 120 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
        size: 45000,
        dependencies: [],
        fxVersions: ['1.0.0'],
        verified: false,
        featured: false
    },
    {
        id: 'fx-icons',
        name: 'fx-icons',
        displayName: 'FX Icon Pack',
        description: 'Beautiful file icons for the FX IDE explorer',
        version: '1.0.0',
        author: { name: 'FX Team', verified: true },
        license: 'MIT',
        tags: ['icons', 'ui', 'files'],
        category: 'themes',
        downloads: 15200,
        rating: 4.9,
        ratingCount: 312,
        publishedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        size: 1200000,
        dependencies: [],
        fxVersions: ['1.0.0'],
        verified: true,
        featured: true
    },
    {
        id: 'fx-linter',
        name: 'fx-linter',
        displayName: 'FX Linter',
        description: 'Advanced linting and code quality checks for FX projects',
        version: '1.5.2',
        author: { name: 'DevTools Inc', verified: true },
        license: 'Apache-2.0',
        tags: ['linting', 'quality', 'typescript'],
        category: 'linters',
        downloads: 9800,
        rating: 4.6,
        ratingCount: 189,
        publishedAt: Date.now() - 150 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
        size: 380000,
        dependencies: ['fx-ast-lens'],
        fxVersions: ['1.0.0'],
        verified: true,
        featured: false
    }
];

// ============================================================================
// Marketplace Hub Plugin Class
// ============================================================================

export class FXMarketplaceHub {
    public readonly name = 'marketplace-hub';
    public readonly version = '1.0.0';
    public readonly description = 'Plugin marketplace UI and installer';

    private fx: FXCore;
    private config: MarketplaceConfig;

    private installed = new Map<string, InstalledPlugin>();
    private cache = new Map<string, { data: any; timestamp: number }>();
    private updateCheckInterval: NodeJS.Timeout | number | null = null;

    constructor(fx: FXCore, config: MarketplaceConfig = {}) {
        this.fx = fx;
        this.config = {
            registryUrl: 'https://marketplace.fx.dev/api/v1',
            cacheTimeout: 5 * 60 * 1000, // 5 minutes
            autoCheckUpdates: true,
            updateCheckInterval: 60 * 60 * 1000, // 1 hour
            allowUnsigned: false,
            ...config
        };

        this.initNodes();
        this.loadInstalled();

        if (this.config.autoCheckUpdates) {
            this.startUpdateChecker();
        }

        MarketplaceLogger.info('FX Marketplace Hub initialized');
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    private initNodes(): void {
        const $$ = this.fx.proxy();

        $$('marketplace.installed').val({});
        $$('marketplace.available').val([]);
        $$('marketplace.featured').val([]);
        $$('marketplace.updates').val([]);
        $$('marketplace.categories').val([
            'all', 'themes', 'productivity', 'linters', 'formatters',
            'languages', 'debuggers', 'testing', 'snippets', 'other'
        ]);
        $$('marketplace.stats').val({
            installedCount: 0,
            availableUpdates: 0,
            lastCheck: null
        });
    }

    private loadInstalled(): void {
        // Load from storage/registry
        // For now, use empty state
        this.updateStats();
    }

    private startUpdateChecker(): void {
        this.updateCheckInterval = setInterval(() => {
            this.checkUpdates().catch(e => MarketplaceLogger.error('Update check failed', e));
        }, this.config.updateCheckInterval!);
    }

    // ========================================================================
    // Search & Discovery
    // ========================================================================

    /**
     * Search plugins in marketplace
     */
    async search(options: SearchOptions = {}): Promise<SearchResult> {
        const cacheKey = JSON.stringify(options);
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        // In production, this would call the registry API
        // For now, use mock data
        let plugins = [...MOCK_PLUGINS];

        // Apply filters
        if (options.query) {
            const query = options.query.toLowerCase();
            plugins = plugins.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.displayName.toLowerCase().includes(query) ||
                p.description.toLowerCase().includes(query) ||
                p.tags.some(t => t.toLowerCase().includes(query))
            );
        }

        if (options.category && options.category !== 'all') {
            plugins = plugins.filter(p => p.category === options.category);
        }

        if (options.tags && options.tags.length > 0) {
            plugins = plugins.filter(p =>
                options.tags!.some(t => p.tags.includes(t))
            );
        }

        if (options.verified) {
            plugins = plugins.filter(p => p.verified);
        }

        if (options.featured) {
            plugins = plugins.filter(p => p.featured);
        }

        // Sort
        const sort = options.sort || 'downloads';
        const order = options.order || 'desc';

        plugins.sort((a, b) => {
            let cmp = 0;
            switch (sort) {
                case 'downloads': cmp = a.downloads - b.downloads; break;
                case 'rating': cmp = a.rating - b.rating; break;
                case 'recent': cmp = a.updatedAt - b.updatedAt; break;
                case 'name': cmp = a.name.localeCompare(b.name); break;
            }
            return order === 'desc' ? -cmp : cmp;
        });

        // Pagination
        const offset = options.offset || 0;
        const limit = options.limit || 20;
        const total = plugins.length;
        plugins = plugins.slice(offset, offset + limit);

        const result: SearchResult = {
            plugins,
            total,
            page: Math.floor(offset / limit) + 1,
            pageSize: limit
        };

        this.setCache(cacheKey, result);

        // Update available in FX nodes
        const $$ = this.fx.proxy();
        $$('marketplace.available').val(plugins);

        return result;
    }

    /**
     * Get featured plugins
     */
    async getFeatured(): Promise<MarketplacePlugin[]> {
        const result = await this.search({ featured: true, limit: 10 });

        const $$ = this.fx.proxy();
        $$('marketplace.featured').val(result.plugins);

        return result.plugins;
    }

    /**
     * Get plugin details
     */
    async getPlugin(id: string): Promise<MarketplacePlugin | null> {
        const cacheKey = `plugin:${id}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        // In production, call API
        const plugin = MOCK_PLUGINS.find(p => p.id === id);

        if (plugin) {
            this.setCache(cacheKey, plugin);
        }

        return plugin || null;
    }

    // ========================================================================
    // Installation
    // ========================================================================

    /**
     * Install a plugin
     */
    async install(id: string): Promise<InstallResult> {
        MarketplaceLogger.info(`Installing plugin: ${id}`);

        // Get plugin details
        const plugin = await this.getPlugin(id);
        if (!plugin) {
            return { success: false, plugin: null, error: 'Plugin not found' };
        }

        // Check if already installed
        if (this.installed.has(id)) {
            return { success: false, plugin: null, error: 'Plugin already installed' };
        }

        // Check signature/verification
        if (!this.config.allowUnsigned && !plugin.verified) {
            return {
                success: false,
                plugin: null,
                error: 'Plugin is not verified. Enable allowUnsigned to install.'
            };
        }

        // Check dependencies
        const warnings: string[] = [];
        for (const dep of plugin.dependencies) {
            if (!this.installed.has(dep)) {
                warnings.push(`Missing dependency: ${dep}`);
            }
        }

        try {
            // Download and install
            // In production, this would download the bundle
            const installed: InstalledPlugin = {
                id: plugin.id,
                name: plugin.name,
                version: plugin.version,
                installedAt: Date.now(),
                updatedAt: Date.now(),
                enabled: true,
                autoUpdate: true,
                path: `plugins/${plugin.name}`
            };

            this.installed.set(id, installed);

            // Update FX nodes
            const $$ = this.fx.proxy();
            $$(`marketplace.installed.${id}`).val(installed);
            this.updateStats();

            MarketplaceLogger.info(`Plugin installed: ${id}`);

            return { success: true, plugin: installed, warnings };

        } catch (e: any) {
            MarketplaceLogger.error(`Install failed: ${id}`, e);
            return { success: false, plugin: null, error: e.message };
        }
    }

    /**
     * Uninstall a plugin
     */
    async uninstall(id: string): Promise<boolean> {
        const installed = this.installed.get(id);
        if (!installed) {
            MarketplaceLogger.warn(`Plugin not installed: ${id}`);
            return false;
        }

        try {
            // Remove plugin files
            // In production, this would delete the plugin directory

            this.installed.delete(id);

            const $$ = this.fx.proxy();
            $$(`marketplace.installed.${id}`).val(undefined);
            this.updateStats();

            MarketplaceLogger.info(`Plugin uninstalled: ${id}`);
            return true;

        } catch (e: any) {
            MarketplaceLogger.error(`Uninstall failed: ${id}`, e);
            return false;
        }
    }

    /**
     * Enable/disable a plugin
     */
    async setEnabled(id: string, enabled: boolean): Promise<boolean> {
        const installed = this.installed.get(id);
        if (!installed) return false;

        installed.enabled = enabled;

        const $$ = this.fx.proxy();
        $$(`marketplace.installed.${id}.enabled`).val(enabled);

        MarketplaceLogger.info(`Plugin ${enabled ? 'enabled' : 'disabled'}: ${id}`);
        return true;
    }

    // ========================================================================
    // Updates
    // ========================================================================

    /**
     * Check for updates
     */
    async checkUpdates(): Promise<PluginUpdate[]> {
        MarketplaceLogger.info('Checking for updates');

        const updates: PluginUpdate[] = [];

        for (const [id, installed] of this.installed) {
            const latest = await this.getPlugin(id);
            if (!latest) continue;

            if (this.compareVersions(installed.version, latest.version) < 0) {
                updates.push({
                    id,
                    currentVersion: installed.version,
                    latestVersion: latest.version,
                    breaking: this.isBreakingUpdate(installed.version, latest.version)
                });
            }
        }

        const $$ = this.fx.proxy();
        $$('marketplace.updates').val(updates);
        $$('marketplace.stats.lastCheck').val(Date.now());
        $$('marketplace.stats.availableUpdates').val(updates.length);

        MarketplaceLogger.info(`Found ${updates.length} updates`);
        return updates;
    }

    /**
     * Update a plugin
     */
    async update(id: string): Promise<InstallResult> {
        const installed = this.installed.get(id);
        if (!installed) {
            return { success: false, plugin: null, error: 'Plugin not installed' };
        }

        // Uninstall old version
        await this.uninstall(id);

        // Install new version
        return this.install(id);
    }

    /**
     * Update all plugins
     */
    async updateAll(): Promise<Map<string, InstallResult>> {
        const updates = await this.checkUpdates();
        const results = new Map<string, InstallResult>();

        for (const update of updates) {
            if (!update.breaking) {
                const result = await this.update(update.id);
                results.set(update.id, result);
            }
        }

        return results;
    }

    // ========================================================================
    // Installed Plugins
    // ========================================================================

    /**
     * Get installed plugins
     */
    getInstalled(): InstalledPlugin[] {
        return Array.from(this.installed.values());
    }

    /**
     * Get installed plugin by ID
     */
    getInstalledPlugin(id: string): InstalledPlugin | undefined {
        return this.installed.get(id);
    }

    /**
     * Check if plugin is installed
     */
    isInstalled(id: string): boolean {
        return this.installed.has(id);
    }

    // ========================================================================
    // Version Utilities
    // ========================================================================

    private compareVersions(a: string, b: string): number {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            const diff = (pa[i] || 0) - (pb[i] || 0);
            if (diff !== 0) return diff;
        }

        return 0;
    }

    private isBreakingUpdate(current: string, latest: string): boolean {
        const currMajor = parseInt(current.split('.')[0]);
        const latestMajor = parseInt(latest.split('.')[0]);
        return latestMajor > currMajor;
    }

    // ========================================================================
    // Cache
    // ========================================================================

    private getCache(key: string): any | null {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout!) {
            return cached.data;
        }
        return null;
    }

    private setCache(key: string, data: any): void {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
        MarketplaceLogger.info('Cache cleared');
    }

    // ========================================================================
    // Stats
    // ========================================================================

    private updateStats(): void {
        const $$ = this.fx.proxy();
        const stats = $$('marketplace.stats').val() || {};

        $$('marketplace.stats').val({
            ...stats,
            installedCount: this.installed.size
        });

        // Update installed list
        const installedList: Record<string, any> = {};
        for (const [id, plugin] of this.installed) {
            installedList[id] = {
                name: plugin.name,
                version: plugin.version,
                enabled: plugin.enabled
            };
        }
        $$('marketplace.installed').val(installedList);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval as number);
        }
        this.cache.clear();
        MarketplaceLogger.info('FX Marketplace Hub disposed');
    }
}

// ============================================================================
// Plugin Export
// ============================================================================

export default function(fx: FXCore, config: MarketplaceConfig = {}): FXMarketplaceHub {
    return new FXMarketplaceHub(fx, config);
}
