// /modules/utils.ts
/**
 * @module utils
 * @description Common utility functions for FX applications
 */

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as any;
    if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
    if (obj instanceof Map) {
        const cloned = new Map();
        obj.forEach((value, key) => cloned.set(key, deepClone(value)));
        return cloned as any;
    }
    if (obj instanceof Set) {
        const cloned = new Set();
        obj.forEach(value => cloned.add(deepClone(value)));
        return cloned as any;
    }
    const cloned = {} as T;
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: any;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = 'fx'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    delay = 1000
): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await sleep(delay * Math.pow(2, attempt - 1));
            }
        }
    }

    throw lastError;
}

/**
 * Memoize a function
 */
export function memoize<T extends (...args: any[]) => any>(
    fn: T
): T {
    const cache = new Map();

    return ((...args: Parameters<T>) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    }) as T;
}

/**
 * Pipe functions together
 */
export function pipe<T>(...fns: Array<(arg: any) => any>) {
    return (value: T) => fns.reduce((acc, fn) => fn(acc), value);
}

/**
 * Compose functions together (reverse of pipe)
 */
export function compose<T>(...fns: Array<(arg: any) => any>) {
    return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value);
}

/**
 * Flatten a nested object
 */
export function flatten(obj: any, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                Object.assign(result, flatten(obj[key], newKey));
            } else {
                result[newKey] = obj[key];
            }
        }
    }

    return result;
}

// Export as default for FX module loading
export default {
    deepClone,
    debounce,
    throttle,
    generateId,
    sleep,
    retry,
    memoize,
    pipe,
    compose,
    flatten
};