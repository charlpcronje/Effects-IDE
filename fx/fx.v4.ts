/**
 * @file fx.v4.ts
 * @description Re-export of the FX Core Framework types and classes for plugin compatibility
 *
 * This file serves as the canonical entry point for all FX plugins and ensures
 * consistent module exports across the entire framework.
 */

// Re-export all types and interfaces from fx.ts
export type {
    FXNode,
    FXMutableValue,
    FXOpts,
    FXBuiltInViews,
    FXNodeProxy
} from './fx';

// Re-export the main class
export { FXCore } from './fx';

// Re-export the singleton instance and utilities
export {
    fx,
    $_$$,
    $$,
    $root,
    $val,
    $set,
    $get,
    $has,
    $app,
    $config,
    $plugins,
    $modules,
    $atomics,
    $dom,
    $session,
    $system,
    $cache,
    patchDollarAtSyntax,
    invokeWithSuspendReplay
} from './fx';

// Export default
import fx from './fx';
export default fx;

// Export global helper functions for initialization
export const initGlobals = () => {
    if (typeof globalThis !== 'undefined') {
        // Export $$ helper
        const $$ = fx.proxy();
        (globalThis as any).$$ = $$;

        // Export _$$ as global accessor
        (globalThis as any)._$$ = (path: string) => fx.proxy()(path);

        // Export $_$$ for compatibility
        (globalThis as any).$_$$ = (path: string) => fx.proxy()(path);

        // Export fx itself
        (globalThis as any).fx = fx;

        return { fx, $$, _$$: (globalThis as any)._$$, $_$$: (globalThis as any).$_$$ };
    }
    return null;
};

// Auto-initialize in browser context
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    initGlobals();
}