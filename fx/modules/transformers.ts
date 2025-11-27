// /modules/transformers.ts
/**
 * @module transformers
 * @description Data transformation functions for FX applications
 */

/**
 * Transform array to object using key selector
 */
export function arrayToObject<T>(
    array: T[],
    keySelector: (item: T) => string
): Record<string, T> {
    return array.reduce((obj, item) => {
        obj[keySelector(item)] = item;
        return obj;
    }, {} as Record<string, T>);
}

/**
 * Transform object to array
 */
export function objectToArray<T>(
    obj: Record<string, T>
): Array<T & { key: string }> {
    return Object.entries(obj).map(([key, value]) => ({
        ...value,
        key
    }));
}

/**
 * Transform nested path to value
 */
export function getPath(obj: any, path: string, defaultValue?: any): any {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
        if (result == null) return defaultValue;
        result = result[key];
    }

    return result !== undefined ? result : defaultValue;
}

/**
 * Set value at nested path
 */
export function setPath(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((curr, key) => {
        if (!(key in curr) || typeof curr[key] !== 'object') {
            curr[key] = {};
        }
        return curr[key];
    }, obj);

    target[lastKey] = value;
    return obj;
}

/**
 * Transform to query string
 */
export function toQueryString(params: Record<string, any>): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) continue;

        if (Array.isArray(value)) {
            value.forEach(v => parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`));
        } else {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
    }

    return parts.join('&');
}

/**
 * Transform from query string
 */
export function fromQueryString(queryString: string): Record<string, any> {
    const params: Record<string, any> = {};
    const searchParams = new URLSearchParams(queryString);

    for (const [key, value] of searchParams) {
        if (key in params) {
            if (Array.isArray(params[key])) {
                params[key].push(value);
            } else {
                params[key] = [params[key], value];
            }
        } else {
            params[key] = value;
        }
    }

    return params;
}

/**
 * Transform to FormData
 */
export function toFormData(obj: Record<string, any>): FormData {
    const formData = new FormData();

    function appendFormData(data: any, rootKey: string) {
        if (data instanceof File || data instanceof Blob) {
            formData.append(rootKey, data);
        } else if (Array.isArray(data)) {
            data.forEach((item, index) => {
                appendFormData(item, `${rootKey}[${index}]`);
            });
        } else if (typeof data === 'object' && data !== null) {
            Object.entries(data).forEach(([key, value]) => {
                appendFormData(value, rootKey ? `${rootKey}[${key}]` : key);
            });
        } else {
            formData.append(rootKey, data);
        }
    }

    appendFormData(obj, '');
    return formData;
}

/**
 * Transform to base64
 */
export function toBase64(str: string): string {
    if (typeof btoa !== 'undefined') {
        return btoa(str);
    }
    return Buffer.from(str).toString('base64');
}

/**
 * Transform from base64
 */
export function fromBase64(str: string): string {
    if (typeof atob !== 'undefined') {
        return atob(str);
    }
    return Buffer.from(str, 'base64').toString();
}

/**
 * Transform to slug
 */
export function toSlug(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Transform CSV to array of objects
 */
export function csvToArray(csv: string, delimiter = ','): any[] {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(delimiter).map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim());
        const obj: any = {};

        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });

        result.push(obj);
    }

    return result;
}

/**
 * Transform array of objects to CSV
 */
export function arrayToCSV(data: any[], delimiter = ','): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const lines = [headers.join(delimiter)];

    for (const item of data) {
        const values = headers.map(header => {
            const value = item[header];
            return typeof value === 'string' && value.includes(delimiter)
                ? `"${value}"`
                : value;
        });
        lines.push(values.join(delimiter));
    }

    return lines.join('\n');
}

/**
 * Transform to sentence case
 */
export function toSentenceCase(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Transform to title case
 */
export function toTitleCase(text: string): string {
    return text.replace(/\w\S*/g, txt =>
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
}

/**
 * Transform object keys recursively
 */
export function transformKeys(
    obj: any,
    transformer: (key: string) => string
): any {
    if (Array.isArray(obj)) {
        return obj.map(item => transformKeys(item, transformer));
    }

    if (obj !== null && typeof obj === 'object') {
        return Object.entries(obj).reduce((result, [key, value]) => {
            result[transformer(key)] = transformKeys(value, transformer);
            return result;
        }, {} as any);
    }

    return obj;
}

// Export as default for FX module loading
export default {
    arrayToObject,
    objectToArray,
    getPath,
    setPath,
    toQueryString,
    fromQueryString,
    toFormData,
    toBase64,
    fromBase64,
    toSlug,
    csvToArray,
    arrayToCSV,
    toSentenceCase,
    toTitleCase,
    transformKeys
};