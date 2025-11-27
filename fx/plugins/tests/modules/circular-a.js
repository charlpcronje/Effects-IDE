// Circular dependency test - Module A
import { functionFromB } from './circular-b.js';

export function functionFromA() {
    return "Function from Circular A";
}

export function callB() {
    try {
        return functionFromB();
    } catch (e) {
        return "Circular dependency detected";
    }
}