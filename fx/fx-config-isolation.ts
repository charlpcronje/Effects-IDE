/**
 * Config Isolation for FX Framework
 * Ensures that config is only accessible through $config, not through $$
 */

import type { FXCore, FXNode, FXNodeProxy } from './fx';

/**
 * ConfigIsolationError - Thrown when trying to access config through $$
 */
export class ConfigIsolationError extends Error {
    constructor(path: string) {
        super(
            `Config access blocked: Cannot access 'config.${path}' through $$.\n` +
            `Use $config('${path}') instead.\n` +
            `Config must be accessed through the dedicated $config interface for security and consistency.`
        );
        this.name = 'ConfigIsolationError';
    }
}

/**
 * Check if a path is trying to access config
 */
function isConfigPath(path: string): boolean {
    if (!path) return false;

    // Check if path starts with config
    const normalized = path.trim();
    return normalized === 'config' ||
           normalized.startsWith('config.') ||
           normalized.startsWith('config[') ||
           normalized.startsWith('config/');
}

/**
 * Extract the config subpath from a full path
 */
function extractConfigSubpath(path: string): string {
    const normalized = path.trim();

    if (normalized === 'config') return '';

    // Remove config prefix
    if (normalized.startsWith('config.')) {
        return normalized.slice(7);
    }
    if (normalized.startsWith('config[')) {
        // Handle bracket notation like config['theme']
        return normalized.slice(6);
    }
    if (normalized.startsWith('config/')) {
        return normalized.slice(7);
    }

    return '';
}

/**
 * Intercept and block config access in path resolution
 */
export function interceptConfigAccess(
    originalResolvePath: (path: string, from?: FXNode) => FXNode | null
): (path: string, from?: FXNode) => FXNode | null {
    return function(path: string, from?: FXNode): FXNode | null {
        // Check if trying to access config
        if (isConfigPath(path)) {
            const subpath = extractConfigSubpath(path);
            throw new ConfigIsolationError(subpath || 'root');
        }

        // Also check each segment of the path
        const segments = path.split(/[\.\[\]\/]/).filter(Boolean);
        if (segments[0] === 'config') {
            const remainingPath = segments.slice(1).join('.');
            throw new ConfigIsolationError(remainingPath || 'root');
        }

        // Call original function if not config
        return originalResolvePath.call(this, path, from);
    };
}

/**
 * Wrap the proxy to prevent config access
 */
export function wrapProxyForConfigIsolation(
    originalProxy: FXNodeProxy,
    fx: FXCore
): FXNodeProxy {
    const handler: ProxyHandler<any> = {
        apply(target, thisArg, args: [string, any?]) {
            const path = args[0];
            if (typeof path === 'string' && isConfigPath(path)) {
                const subpath = extractConfigSubpath(path);
                throw new ConfigIsolationError(subpath || 'root');
            }
            return Reflect.apply(target, thisArg, args);
        },

        get(target, prop, receiver) {
            // Block direct property access to config
            if (prop === 'config') {
                throw new ConfigIsolationError('root');
            }

            // Get the original value
            const value = Reflect.get(target, prop, receiver);

            // If it's a function that takes a path, wrap it
            if (typeof value === 'function' && ['get', 'set', 'val'].includes(String(prop))) {
                return new Proxy(value, {
                    apply(fn, thisArg, args) {
                        // Check if first argument is a path that accesses config
                        if (args.length > 0 && typeof args[0] === 'string') {
                            const path = args[0];
                            if (isConfigPath(path)) {
                                const subpath = extractConfigSubpath(path);
                                throw new ConfigIsolationError(subpath || 'root');
                            }
                        }
                        return Reflect.apply(fn, thisArg, args);
                    }
                });
            }

            return value;
        }
    };

    return new Proxy(originalProxy, handler);
}

/**
 * Create a safe config accessor that is the ONLY way to access config
 */
export function createSafeConfigAccessor(fx: FXCore): (path?: string, value?: any) => any {
    // Get the actual config node (assumes it's at fx.root.__nodes.config)
    const getConfigNode = () => {
        const root = fx.root;
        if (!root.__nodes.config) {
            // Create config node if it doesn't exist
            (fx as any).setPath('config', {}, root);
        }
        return root.__nodes.config;
    };

    return function $config(path?: string, value?: any) {
        const configNode = getConfigNode();
        const configProxy = (fx as any).createNodeProxy(configNode);

        // If no path, return the config proxy
        if (!path) {
            return configProxy;
        }

        // If value provided, set it
        if (arguments.length > 1) {
            return configProxy(path, value);
        }

        // Otherwise, get the value
        return configProxy(path);
    };
}

/**
 * Apply config isolation to FX
 */
export function applyConfigIsolation(fx: FXCore): void {
    // Intercept resolvePath
    const originalResolvePath = (fx as any).resolvePath;
    if (originalResolvePath) {
        (fx as any).resolvePath = interceptConfigAccess(originalResolvePath.bind(fx));
    }

    // Intercept setPath
    const originalSetPath = (fx as any).setPath;
    if (originalSetPath) {
        (fx as any).setPath = function(path: string, value: any, from?: FXNode) {
            if (isConfigPath(path)) {
                const subpath = extractConfigSubpath(path);
                throw new ConfigIsolationError(subpath || 'root');
            }
            return originalSetPath.call(this, path, value, from);
        };
    }

    // Wrap the main proxy function
    const originalProxy = (fx as any).proxy;
    if (originalProxy) {
        (fx as any).proxy = function(path?: string) {
            if (path && isConfigPath(path)) {
                const subpath = extractConfigSubpath(path);
                throw new ConfigIsolationError(subpath || 'root');
            }
            const proxy = originalProxy.call(this, path);
            return wrapProxyForConfigIsolation(proxy, fx);
        };
    }

    // Create the safe $config accessor
    const $config = createSafeConfigAccessor(fx);
    (globalThis as any).$config = $config;

    // Also prevent access through the dollar-dollar syntax
    const $$ = (globalThis as any).$$;
    if ($$) {
        (globalThis as any).$$ = new Proxy($$, {
            apply(target, thisArg, args) {
                const path = args[0];
                if (typeof path === 'string' && isConfigPath(path)) {
                    const subpath = extractConfigSubpath(path);
                    throw new ConfigIsolationError(subpath || 'root');
                }
                return Reflect.apply(target, thisArg, args);
            },
            get(target, prop) {
                if (prop === 'config') {
                    throw new ConfigIsolationError('root');
                }
                return Reflect.get(target, prop);
            }
        });
    }

    console.log('[FX] Config isolation enabled. Use $config() to access configuration.');
}

/**
 * Validate config isolation is working
 */
export function validateConfigIsolation(): boolean {
    const tests: Array<{ name: string; fn: () => void; shouldThrow: boolean }> = [
        {
            name: 'Block $$("config")',
            fn: () => (globalThis as any).$$('config'),
            shouldThrow: true
        },
        {
            name: 'Block $$("config.theme")',
            fn: () => (globalThis as any).$$('config.theme'),
            shouldThrow: true
        },
        {
            name: 'Block $$.config',
            fn: () => (globalThis as any).$$.config,
            shouldThrow: true
        },
        {
            name: 'Allow $config()',
            fn: () => (globalThis as any).$config(),
            shouldThrow: false
        },
        {
            name: 'Allow $config("theme")',
            fn: () => (globalThis as any).$config('theme'),
            shouldThrow: false
        },
        {
            name: 'Allow $$("app.data")',
            fn: () => (globalThis as any).$$('app.data'),
            shouldThrow: false
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            test.fn();
            if (test.shouldThrow) {
                console.error(`❌ ${test.name} - Should have thrown but didn't`);
                failed++;
            } else {
                console.log(`✅ ${test.name} - Passed`);
                passed++;
            }
        } catch (error) {
            if (!test.shouldThrow) {
                console.error(`❌ ${test.name} - Should not have thrown but did:`, error);
                failed++;
            } else if (error instanceof ConfigIsolationError) {
                console.log(`✅ ${test.name} - Correctly blocked`);
                passed++;
            } else {
                console.error(`❌ ${test.name} - Wrong error type:`, error);
                failed++;
            }
        }
    }

    console.log(`\nConfig Isolation Validation: ${passed}/${tests.length} tests passed`);
    return failed === 0;
}