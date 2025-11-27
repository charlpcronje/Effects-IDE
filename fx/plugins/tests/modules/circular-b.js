// Circular dependency test - Module B
import { functionFromA } from './circular-a.js';

export function functionFromB() {
    return "Function from Circular B";
}

export function callA() {
    try {
        return functionFromA();
    } catch (e) {
        return "Circular dependency detected";
    }
}