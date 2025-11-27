// Test Module A - Root module that imports B
import { greetFromB } from './module-b.js';
import { utilityC } from './module-c.js';

export function greetFromA() {
    return "Hello from Module A";
}

export function callNestedGreeting() {
    return `Module A calling: ${greetFromB()}`;
}

export function useUtility() {
    return `Module A using: ${utilityC()}`;
}

export default {
    greetFromA,
    callNestedGreeting,
    useUtility
};