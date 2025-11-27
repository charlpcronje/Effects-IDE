/**
 * Enhanced CSS Selector Engine for FX Framework
 * Provides full CSS selector support including:
 * - All combinators (>, +, ~, space)
 * - All pseudo-selectors (:first-child, :last-child, :nth-child, etc.)
 * - Attribute selectors with all operators
 * - Complex selectors
 */

import type { FXCore, FXNode, FXNodeProxy } from './fx';

// Enhanced selector types
type SelSimple =
    | { kind: "class"; name: string }
    | { kind: "id"; id: string }
    | { kind: "tag"; name: string }
    | { kind: "attr"; key: string; op: string; value?: string }
    | { kind: "pseudo"; name: string; value?: string }
    | { kind: "not"; inner: SelCompound }
    | { kind: "has"; inner: SelCompound }
    | { kind: "is"; inner: SelCompound }
    | { kind: "where"; inner: SelCompound };

type SelCombinator = "desc" | "child" | "adjacent" | "sibling";
type SelStep = { simple: SelSimple[] };
type SelCompound = { chain: Array<SelStep | SelCombinator> };
type SelList = SelCompound[];

/**
 * Enhanced CSS Selector Parser
 */
export class CSSParser {
    static parse(selector: string): SelList {
        // Split by comma for multiple selectors
        const tokens = selector.split(",").map(s => s.trim()).filter(Boolean);
        return tokens.map(token => this.parseCompound(token));
    }

    private static parseCompound(selector: string): SelCompound {
        const chain: Array<SelStep | SelCombinator> = [];
        let i = 0;
        const s = selector;

        const ws = () => {
            while (i < s.length && /\s/.test(s[i])) i++;
        };

        const readIdent = () => {
            const start = i;
            while (i < s.length && /[A-Za-z0-9_\-]/.test(s[i])) i++;
            return s.slice(start, i);
        };

        const readValue = () => {
            ws();
            if (s[i] === '"' || s[i] === "'") {
                const quote = s[i++];
                const start = i;
                while (i < s.length && s[i] !== quote) {
                    if (s[i] === '\\') i++; // Skip escaped chars
                    i++;
                }
                const value = s.slice(start, i);
                i++; // Skip closing quote
                return value;
            } else {
                const start = i;
                while (i < s.length && !/[\s\]\)]/.test(s[i])) i++;
                return s.slice(start, i);
            }
        };

        const readBalanced = (open: string, close: string) => {
            let depth = 1;
            let result = "";
            i++; // Skip opening
            while (i < s.length && depth > 0) {
                if (s[i] === open) depth++;
                else if (s[i] === close) {
                    depth--;
                    if (depth === 0) break;
                }
                result += s[i];
                i++;
            }
            i++; // Skip closing
            return result.trim();
        };

        let currentStep: SelStep = { simple: [] };

        const pushStep = () => {
            if (currentStep.simple.length > 0) {
                chain.push({ ...currentStep });
                currentStep = { simple: [] };
            }
        };

        while (i < s.length) {
            ws();
            if (i >= s.length) break;

            const c = s[i];

            // Universal selector
            if (c === '*') {
                i++;
                currentStep.simple.push({ kind: "tag", name: "*" });
            }
            // Class selector
            else if (c === '.') {
                i++;
                const name = readIdent();
                if (name) {
                    currentStep.simple.push({ kind: "class", name });
                }
            }
            // ID selector
            else if (c === '#') {
                i++;
                const id = readIdent();
                if (id) {
                    currentStep.simple.push({ kind: "id", id });
                }
            }
            // Attribute selector
            else if (c === '[') {
                i++; // Skip [
                ws();
                const key = readIdent();
                ws();

                let op = "exists";
                let value: string | undefined;

                if (i < s.length && s[i] !== ']') {
                    // Check for operator
                    if (s[i] === '=') {
                        op = "=";
                        i++;
                    } else if (s[i] === '!' && s[i + 1] === '=') {
                        op = "!=";
                        i += 2;
                    } else if (s[i] === '^' && s[i + 1] === '=') {
                        op = "^=";
                        i += 2;
                    } else if (s[i] === '$' && s[i + 1] === '=') {
                        op = "$=";
                        i += 2;
                    } else if (s[i] === '*' && s[i + 1] === '=') {
                        op = "*=";
                        i += 2;
                    } else if (s[i] === '~' && s[i + 1] === '=') {
                        op = "~=";
                        i += 2;
                    } else if (s[i] === '|' && s[i + 1] === '=') {
                        op = "|=";
                        i += 2;
                    }

                    if (op !== "exists") {
                        value = readValue();
                    }
                }

                ws();
                if (s[i] === ']') i++;

                currentStep.simple.push({ kind: "attr", key, op, value });
            }
            // Pseudo-selector
            else if (c === ':') {
                i++;

                // Handle double colon (::) as single colon
                if (s[i] === ':') i++;

                const name = readIdent();
                let value: string | undefined;

                if (s[i] === '(') {
                    // Special handling for :not, :is, :where, :has
                    if (["not", "is", "where", "has"].includes(name)) {
                        const inner = readBalanced('(', ')');
                        const innerCompound = this.parseCompound(inner);
                        currentStep.simple.push({ kind: name as any, inner: innerCompound });
                    } else {
                        // Regular pseudo with value
                        value = readBalanced('(', ')');
                        currentStep.simple.push({ kind: "pseudo", name, value });
                    }
                } else {
                    currentStep.simple.push({ kind: "pseudo", name });
                }
            }
            // Child combinator
            else if (c === '>') {
                pushStep();
                chain.push("child");
                i++;
                ws();
            }
            // Adjacent sibling combinator
            else if (c === '+') {
                pushStep();
                chain.push("adjacent");
                i++;
                ws();
            }
            // General sibling combinator
            else if (c === '~') {
                pushStep();
                chain.push("sibling");
                i++;
                ws();
            }
            // Descendant combinator (space)
            else if (/\s/.test(c)) {
                pushStep();
                if (chain.length > 0 && chain[chain.length - 1] !== "desc") {
                    chain.push("desc");
                }
                ws();
            }
            // Tag selector
            else if (/[A-Za-z]/.test(c)) {
                const tag = readIdent();
                if (tag) {
                    currentStep.simple.push({ kind: "tag", name: tag });
                }
            }
            else {
                i++; // Skip unknown characters
            }
        }

        pushStep();
        return { chain };
    }
}

/**
 * Enhanced CSS Selector Matcher
 */
export class CSSMatcher {
    private fx: FXCore;

    constructor(fx: FXCore) {
        this.fx = fx;
    }

    match(node: FXNode, selector: string): boolean {
        const selList = CSSParser.parse(selector);
        return selList.some(compound => this.matchCompound(node, compound));
    }

    private matchCompound(node: FXNode, compound: SelCompound): boolean {
        const parts = compound.chain.filter(Boolean);
        if (parts.length === 0) return false;

        let currentNodes: FXNode[] = [node];

        // Process from right to left (starting from the target element)
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];

            if (typeof part === "string") {
                // It's a combinator, handled with the next step
                continue;
            }

            // It's a step, match it
            currentNodes = currentNodes.filter(n => this.matchStep(n, part as SelStep));

            if (currentNodes.length === 0) return false;

            // Check for combinator before this step
            if (i > 0) {
                const prevPart = parts[i - 1];
                if (typeof prevPart === "string") {
                    const combinator = prevPart as SelCombinator;
                    const nextNodes: FXNode[] = [];

                    for (const node of currentNodes) {
                        switch (combinator) {
                            case "child":
                                const parent = this.getParent(node);
                                if (parent) nextNodes.push(parent);
                                break;

                            case "desc":
                                const ancestors = this.getAncestors(node);
                                nextNodes.push(...ancestors);
                                break;

                            case "adjacent":
                                const prevSibling = this.getPreviousSibling(node);
                                if (prevSibling) nextNodes.push(prevSibling);
                                break;

                            case "sibling":
                                const prevSiblings = this.getPreviousSiblings(node);
                                nextNodes.push(...prevSiblings);
                                break;
                        }
                    }

                    currentNodes = nextNodes;
                    i--; // Skip the combinator in next iteration
                }
            }
        }

        return currentNodes.length > 0;
    }

    private matchStep(node: FXNode, step: SelStep): boolean {
        return step.simple.every(simple => this.matchSimple(node, simple));
    }

    private matchSimple(node: FXNode, simple: SelSimple): boolean {
        switch (simple.kind) {
            case "tag":
                if (simple.name === "*") return true;
                return node.__type === simple.name;

            case "class":
                // Check __type or __proto array for class match
                return node.__type === simple.name ||
                       (node.__proto && node.__proto.includes(simple.name));

            case "id":
                return node.__id === simple.id;

            case "attr":
                return this.matchAttribute(node, simple.key, simple.op, simple.value);

            case "pseudo":
                return this.matchPseudo(node, simple.name, simple.value);

            case "not":
                return !this.matchCompound(node, simple.inner);

            case "is":
            case "where":
                return this.matchCompound(node, simple.inner);

            case "has":
                return this.hasDescendant(node, simple.inner);

            default:
                return false;
        }
    }

    private matchAttribute(node: FXNode, key: string, op: string, value?: string): boolean {
        const nodeValue = (node as any)[key] ?? node.__value?.[key] ?? node.__meta?.[key];

        if (op === "exists") {
            return nodeValue !== undefined;
        }

        if (value === undefined) return false;

        const strValue = String(nodeValue);
        const testValue = String(value);

        switch (op) {
            case "=":
                return strValue === testValue;
            case "!=":
                return strValue !== testValue;
            case "^=": // Starts with
                return strValue.startsWith(testValue);
            case "$=": // Ends with
                return strValue.endsWith(testValue);
            case "*=": // Contains
                return strValue.includes(testValue);
            case "~=": // Word match
                return strValue.split(/\s+/).includes(testValue);
            case "|=": // Prefix match (exact or followed by -)
                return strValue === testValue || strValue.startsWith(testValue + "-");
            default:
                return false;
        }
    }

    private matchPseudo(node: FXNode, name: string, value?: string): boolean {
        switch (name) {
            case "first-child":
                return this.isFirstChild(node);

            case "last-child":
                return this.isLastChild(node);

            case "only-child":
                return this.isOnlyChild(node);

            case "nth-child":
                return this.isNthChild(node, value || "1");

            case "nth-last-child":
                return this.isNthLastChild(node, value || "1");

            case "first-of-type":
                return this.isFirstOfType(node);

            case "last-of-type":
                return this.isLastOfType(node);

            case "only-of-type":
                return this.isOnlyOfType(node);

            case "nth-of-type":
                return this.isNthOfType(node, value || "1");

            case "nth-last-of-type":
                return this.isNthLastOfType(node, value || "1");

            case "empty":
                return this.isEmpty(node);

            case "root":
                return node === this.fx.root;

            case "enabled":
                return !node.__meta?.disabled;

            case "disabled":
                return !!node.__meta?.disabled;

            case "checked":
                return !!node.__meta?.checked || !!node.__value?.checked;

            case "focus":
                return !!node.__meta?.focused;

            case "hover":
                return !!node.__meta?.hovered;

            case "active":
                return !!node.__meta?.active || node.__value?.active === true;

            case "visited":
                return !!node.__meta?.visited;

            default:
                return false;
        }
    }

    // Helper methods for traversal

    private getParent(node: FXNode): FXNode | null {
        if (node.__parent_id) {
            // Use parent_id if available
            return this.findNodeById(node.__parent_id);
        }

        // Otherwise, search the tree
        const stack: FXNode[] = [this.fx.root];
        while (stack.length > 0) {
            const current = stack.pop()!;
            for (const key in current.__nodes) {
                const child = current.__nodes[key];
                if (child === node) {
                    return current;
                }
                stack.push(child);
            }
        }
        return null;
    }

    private getAncestors(node: FXNode): FXNode[] {
        const ancestors: FXNode[] = [];
        let current = this.getParent(node);
        while (current) {
            ancestors.push(current);
            current = this.getParent(current);
        }
        return ancestors;
    }

    private getSiblings(node: FXNode): FXNode[] {
        const parent = this.getParent(node);
        if (!parent) return [];

        return Object.values(parent.__nodes).filter(n => n !== node);
    }

    private getPreviousSibling(node: FXNode): FXNode | null {
        const parent = this.getParent(node);
        if (!parent) return null;

        const siblings = Object.values(parent.__nodes);
        const index = siblings.indexOf(node);
        return index > 0 ? siblings[index - 1] : null;
    }

    private getPreviousSiblings(node: FXNode): FXNode[] {
        const parent = this.getParent(node);
        if (!parent) return [];

        const siblings = Object.values(parent.__nodes);
        const index = siblings.indexOf(node);
        return index > 0 ? siblings.slice(0, index) : [];
    }

    private getNextSibling(node: FXNode): FXNode | null {
        const parent = this.getParent(node);
        if (!parent) return null;

        const siblings = Object.values(parent.__nodes);
        const index = siblings.indexOf(node);
        return index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
    }

    private hasDescendant(node: FXNode, compound: SelCompound): boolean {
        const stack: FXNode[] = [node];
        while (stack.length > 0) {
            const current = stack.pop()!;
            for (const key in current.__nodes) {
                const child = current.__nodes[key];
                if (this.matchCompound(child, compound)) {
                    return true;
                }
                stack.push(child);
            }
        }
        return false;
    }

    // Pseudo-class helpers

    private isFirstChild(node: FXNode): boolean {
        const parent = this.getParent(node);
        if (!parent) return false;

        const siblings = Object.values(parent.__nodes);
        return siblings[0] === node;
    }

    private isLastChild(node: FXNode): boolean {
        const parent = this.getParent(node);
        if (!parent) return false;

        const siblings = Object.values(parent.__nodes);
        return siblings[siblings.length - 1] === node;
    }

    private isOnlyChild(node: FXNode): boolean {
        const parent = this.getParent(node);
        if (!parent) return false;

        return Object.keys(parent.__nodes).length === 1;
    }

    private isNthChild(node: FXNode, formula: string): boolean {
        const parent = this.getParent(node);
        if (!parent) return false;

        const siblings = Object.values(parent.__nodes);
        const index = siblings.indexOf(node) + 1; // 1-based index

        return this.matchNthFormula(index, formula);
    }

    private isNthLastChild(node: FXNode, formula: string): boolean {
        const parent = this.getParent(node);
        if (!parent) return false;

        const siblings = Object.values(parent.__nodes);
        const index = siblings.length - siblings.indexOf(node); // 1-based from end

        return this.matchNthFormula(index, formula);
    }

    private isFirstOfType(node: FXNode): boolean {
        const parent = this.getParent(node);
        if (!parent) return false;

        const sameType = Object.values(parent.__nodes).filter(n => n.__type === node.__type);
        return sameType[0] === node;
    }

    private isLastOfType(node: FXNode): boolean {
        const parent = this.getParent(node);
        if (!parent) return false;

        const sameType = Object.values(parent.__nodes).filter(n => n.__type === node.__type);
        return sameType[sameType.length - 1] === node;
    }

    private isOnlyOfType(node: FXNode): boolean {
        const parent = this.getParent(node);
        if (!parent) return false;

        const sameType = Object.values(parent.__nodes).filter(n => n.__type === node.__type);
        return sameType.length === 1 && sameType[0] === node;
    }

    private isNthOfType(node: FXNode, formula: string): boolean {
        const parent = this.getParent(node);
        if (!parent) return false;

        const sameType = Object.values(parent.__nodes).filter(n => n.__type === node.__type);
        const index = sameType.indexOf(node) + 1; // 1-based index

        return this.matchNthFormula(index, formula);
    }

    private isNthLastOfType(node: FXNode, formula: string): boolean {
        const parent = this.getParent(node);
        if (!parent) return false;

        const sameType = Object.values(parent.__nodes).filter(n => n.__type === node.__type);
        const index = sameType.length - sameType.indexOf(node); // 1-based from end

        return this.matchNthFormula(index, formula);
    }

    private isEmpty(node: FXNode): boolean {
        // Check if node has no children and no text content
        return Object.keys(node.__nodes).length === 0 &&
               (!node.__value || (typeof node.__value === "string" && node.__value.trim() === ""));
    }

    private matchNthFormula(index: number, formula: string): boolean {
        // Handle special cases
        if (formula === "odd") return index % 2 === 1;
        if (formula === "even") return index % 2 === 0;

        // Handle an+b formula
        const match = formula.match(/^(?:(-?\d+)?n)?(?:([+-]\d+))?$/);
        if (!match) {
            // Try to parse as a simple number
            const num = parseInt(formula, 10);
            if (!isNaN(num)) {
                return index === num;
            }
            return false;
        }

        const a = match[1] ? parseInt(match[1] === "-" ? "-1" : match[1], 10) : 0;
        const b = match[2] ? parseInt(match[2], 10) : 0;

        if (a === 0) {
            return index === b;
        }

        return (index - b) % a === 0 && (index - b) / a >= 0;
    }

    private findNodeById(id: string): FXNode | null {
        const stack: FXNode[] = [this.fx.root];
        while (stack.length > 0) {
            const current = stack.pop()!;
            if (current.__id === id) return current;
            for (const key in current.__nodes) {
                stack.push(current.__nodes[key]);
            }
        }
        return null;
    }

    /**
     * Query all nodes matching the selector
     */
    queryAll(selector: string, root: FXNode = this.fx.root): FXNode[] {
        const results: FXNode[] = [];
        const selList = CSSParser.parse(selector);

        const visit = (node: FXNode) => {
            if (selList.some(compound => this.matchCompound(node, compound))) {
                results.push(node);
            }
            for (const key in node.__nodes) {
                visit(node.__nodes[key]);
            }
        };

        visit(root);
        return results;
    }

    /**
     * Query first node matching the selector
     */
    query(selector: string, root: FXNode = this.fx.root): FXNode | null {
        const selList = CSSParser.parse(selector);

        const visit = (node: FXNode): FXNode | null => {
            if (selList.some(compound => this.matchCompound(node, compound))) {
                return node;
            }
            for (const key in node.__nodes) {
                const result = visit(node.__nodes[key]);
                if (result) return result;
            }
            return null;
        };

        return visit(root);
    }
}

/**
 * Export the enhanced selector functionality for integration
 */
export function enhanceFXSelectors(fx: FXCore): void {
    const matcher = new CSSMatcher(fx);

    // Extend FX with enhanced selector methods
    (fx as any).cssMatch = (node: FXNode, selector: string) => matcher.match(node, selector);
    (fx as any).cssQuery = (selector: string, root?: FXNode) => matcher.query(selector, root);
    (fx as any).cssQueryAll = (selector: string, root?: FXNode) => matcher.queryAll(selector, root);

    // Override the existing parseSelector function with enhanced version
    (globalThis as any).parseSelector = CSSParser.parse;
}