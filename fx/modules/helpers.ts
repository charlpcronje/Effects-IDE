// /modules/helpers.ts
/**
 * @module helpers
 * @description Helper functions for FX applications
 */

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parse a duration string to milliseconds
 */
export function parseDuration(duration: string): number {
    const units: Record<string, number> = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };

    const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) throw new Error(`Invalid duration: ${duration}`);

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
}

/**
 * Format a date to ISO string or relative time
 */
export function formatDate(date: Date, relative = false): string {
    if (!relative) return date.toISOString();

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Convert camelCase to kebab-case
 */
export function camelToKebab(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 */
export function kebabToCamel(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number, suffix = '...'): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Group array items by key
 */
export function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce((result, item) => {
        const group = String(item[key]);
        if (!result[group]) result[group] = [];
        result[group].push(item);
        return result;
    }, {} as Record<string, T[]>);
}

/**
 * Pick specific keys from an object
 */
export function pick<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}

/**
 * Omit specific keys from an object
 */
export function omit<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result as Omit<T, K>;
}

// Export as default for FX module loading
export default {
    formatBytes,
    parseDuration,
    formatDate,
    escapeHtml,
    camelToKebab,
    kebabToCamel,
    truncate,
    groupBy,
    pick,
    omit
};