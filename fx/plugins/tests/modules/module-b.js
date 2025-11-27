// Test Module B - Intermediate module that imports C
import { utilityC, helperC } from './module-c.js';

export function greetFromB() {
    return "Hello from Module B";
}

export function callDeeperNesting() {
    return `Module B calling: ${utilityC()}`;
}

export function useHelper() {
    return `Module B helper: ${helperC()}`;
}

export default {
    greetFromB,
    callDeeperNesting,
    useHelper
};