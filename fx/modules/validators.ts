// /modules/validators.ts
/**
 * @module validators
 * @description Validation functions for FX applications
 */

export interface ValidationResult {
    valid: boolean;
    errors?: string[];
}

/**
 * Validate email address
 */
export function isEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate URL
 */
export function isURL(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate phone number (basic international format)
 */
export function isPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Validate UUID
 */
export function isUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Validate IPv4 address
 */
export function isIPv4(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
}

/**
 * Validate IPv6 address
 */
export function isIPv6(ip: string): boolean {
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv6Regex.test(ip);
}

/**
 * Validate credit card number (Luhn algorithm)
 */
export function isCreditCard(cardNumber: string): boolean {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length < 13 || cleaned.length > 19) return false;

    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i], 10);

        if (isEven) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }

        sum += digit;
        isEven = !isEven;
    }

    return sum % 10 === 0;
}

/**
 * Validate date string
 */
export function isDate(date: string): boolean {
    const parsed = Date.parse(date);
    return !isNaN(parsed);
}

/**
 * Validate JSON string
 */
export function isJSON(str: string): boolean {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate hex color
 */
export function isHexColor(color: string): boolean {
    const hexColorRegex = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color);
}

/**
 * Create a schema validator
 */
export function createValidator(schema: Record<string, any>) {
    return function validate(data: any): ValidationResult {
        const errors: string[] = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];

            // Required check
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }

            // Skip optional empty fields
            if (!rules.required && (value === undefined || value === null || value === '')) {
                continue;
            }

            // Type check
            if (rules.type) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== rules.type) {
                    errors.push(`${field} must be of type ${rules.type}`);
                    continue;
                }
            }

            // String validations
            if (typeof value === 'string') {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} must be at most ${rules.maxLength} characters`);
                }
                if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
                    errors.push(`${field} does not match the required pattern`);
                }
                if (rules.email && !isEmail(value)) {
                    errors.push(`${field} must be a valid email`);
                }
                if (rules.url && !isURL(value)) {
                    errors.push(`${field} must be a valid URL`);
                }
            }

            // Number validations
            if (typeof value === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`${field} must be at least ${rules.min}`);
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`${field} must be at most ${rules.max}`);
                }
            }

            // Array validations
            if (Array.isArray(value)) {
                if (rules.minItems && value.length < rules.minItems) {
                    errors.push(`${field} must have at least ${rules.minItems} items`);
                }
                if (rules.maxItems && value.length > rules.maxItems) {
                    errors.push(`${field} must have at most ${rules.maxItems} items`);
                }
            }

            // Custom validator
            if (rules.validator && typeof rules.validator === 'function') {
                const result = rules.validator(value);
                if (result !== true) {
                    errors.push(typeof result === 'string' ? result : `${field} is invalid`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    };
}

// Export as default for FX module loading
export default {
    isEmail,
    isURL,
    isPhoneNumber,
    isUUID,
    isIPv4,
    isIPv6,
    isCreditCard,
    isDate,
    isJSON,
    isHexColor,
    createValidator
};