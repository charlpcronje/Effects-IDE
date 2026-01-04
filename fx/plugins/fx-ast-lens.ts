// /plugins/fx-ast-lens.ts
/**
 * @fx-plugin fx-ast-lens
 * @fx-global $ast
 * @fx-description AST indexing, querying, diffing, and code intelligence
 * @fx-dependencies fx-jsx
 * @fx-provides $ast
 * @fx-version 1.0.0
 *
 * FX AST Lens Plugin - Provides AST parsing, indexing, semantic queries,
 * and incremental diffing for code intelligence features.
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// Get FXSuspend from global
const FXSuspend = (globalThis as any).FXSuspend;

// ============================================================================
// Types & Interfaces
// ============================================================================

export type ASTNodeType =
    | 'Program'
    | 'ImportDeclaration'
    | 'ExportDeclaration'
    | 'FunctionDeclaration'
    | 'ClassDeclaration'
    | 'VariableDeclaration'
    | 'InterfaceDeclaration'
    | 'TypeAliasDeclaration'
    | 'EnumDeclaration'
    | 'MethodDefinition'
    | 'PropertyDefinition'
    | 'CallExpression'
    | 'Identifier'
    | 'JSXElement'
    | 'JSXComponent'
    | 'BlockStatement'
    | 'ReturnStatement'
    | 'ArrowFunctionExpression'
    | 'ObjectExpression'
    | 'ArrayExpression'
    | 'StringLiteral'
    | 'NumericLiteral'
    | 'Unknown';

export interface ASTNode {
    id: string;
    type: ASTNodeType;
    name?: string;
    start: Position;
    end: Position;
    children: ASTNode[];
    parent?: string; // Parent node ID
    metadata?: Record<string, any>;
    source?: string; // Source code slice
}

export interface Position {
    line: number;
    column: number;
    offset: number;
}

export interface ASTDocument {
    path: string;
    language: string;
    version: number;
    root: ASTNode;
    symbols: Symbol[];
    imports: ImportInfo[];
    exports: ExportInfo[];
    errors: ParseError[];
    lastParsed: number;
}

export interface Symbol {
    name: string;
    kind: SymbolKind;
    nodeId: string;
    scope: string;
    references: Reference[];
    definition: Position;
    documentation?: string;
}

export type SymbolKind =
    | 'function'
    | 'class'
    | 'interface'
    | 'type'
    | 'variable'
    | 'constant'
    | 'method'
    | 'property'
    | 'enum'
    | 'component';

export interface Reference {
    position: Position;
    kind: 'read' | 'write' | 'call';
}

export interface ImportInfo {
    source: string;
    specifiers: ImportSpecifier[];
    position: Position;
    isTypeOnly: boolean;
}

export interface ImportSpecifier {
    name: string;
    alias?: string;
    isDefault: boolean;
    isNamespace: boolean;
}

export interface ExportInfo {
    name: string;
    kind: 'named' | 'default' | 'all';
    source?: string; // For re-exports
    position: Position;
}

export interface ParseError {
    message: string;
    position: Position;
    severity: 'error' | 'warning';
}

export interface ASTDiff {
    type: 'add' | 'remove' | 'modify' | 'move';
    path: string;
    oldNode?: ASTNode;
    newNode?: ASTNode;
}

export interface QueryResult {
    nodes: ASTNode[];
    symbols: Symbol[];
    total: number;
}

export interface ASTLensConfig {
    languages?: string[];
    indexOnParse?: boolean;
    cacheAST?: boolean;
    maxCacheSize?: number;
}

// ============================================================================
// Simple TypeScript/JavaScript Parser
// ============================================================================

class SimpleParser {
    private source: string = '';
    private pos: number = 0;
    private line: number = 1;
    private column: number = 0;
    private tokens: Token[] = [];

    parse(source: string, language: string): ASTNode {
        this.source = source;
        this.pos = 0;
        this.line = 1;
        this.column = 0;

        const root: ASTNode = {
            id: this.genId(),
            type: 'Program',
            start: { line: 1, column: 0, offset: 0 },
            end: { line: 1, column: 0, offset: 0 },
            children: []
        };

        // Tokenize
        this.tokens = this.tokenize();

        // Parse top-level statements
        let tokenIndex = 0;
        while (tokenIndex < this.tokens.length) {
            const result = this.parseStatement(tokenIndex);
            if (result.node) {
                result.node.parent = root.id;
                root.children.push(result.node);
            }
            tokenIndex = result.nextIndex;
            if (result.nextIndex === tokenIndex) {
                tokenIndex++; // Prevent infinite loop
            }
        }

        // Update end position
        if (this.tokens.length > 0) {
            const lastToken = this.tokens[this.tokens.length - 1];
            root.end = lastToken.end;
        }

        return root;
    }

    private genId(): string {
        return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    private tokenize(): Token[] {
        const tokens: Token[] = [];
        const patterns: Array<{ type: TokenType; regex: RegExp }> = [
            { type: 'keyword', regex: /^(import|export|from|function|class|const|let|var|interface|type|enum|extends|implements|return|if|else|for|while|async|await|default|as)\b/ },
            { type: 'identifier', regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*/ },
            { type: 'string', regex: /^(['"`])(?:(?!\1)[^\\]|\\.)*\1/ },
            { type: 'number', regex: /^[0-9]+(?:\.[0-9]+)?/ },
            { type: 'operator', regex: /^(=>|===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!&|^~])/ },
            { type: 'punctuation', regex: /^[{}()\[\];,.:?]/ },
            { type: 'whitespace', regex: /^\s+/ },
            { type: 'comment', regex: /^(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/ },
            { type: 'jsx', regex: /^<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s+[a-zA-Z][a-zA-Z0-9]*(?:=(?:"[^"]*"|'[^']*'|\{[^}]*\}))?)*\s*\/?>/ }
        ];

        while (this.pos < this.source.length) {
            let matched = false;

            for (const { type, regex } of patterns) {
                const match = this.source.slice(this.pos).match(regex);
                if (match) {
                    const value = match[0];
                    const start = { line: this.line, column: this.column, offset: this.pos };

                    // Update position
                    for (const char of value) {
                        if (char === '\n') {
                            this.line++;
                            this.column = 0;
                        } else {
                            this.column++;
                        }
                        this.pos++;
                    }

                    const end = { line: this.line, column: this.column, offset: this.pos };

                    // Skip whitespace and comments
                    if (type !== 'whitespace' && type !== 'comment') {
                        tokens.push({ type, value, start, end });
                    }

                    matched = true;
                    break;
                }
            }

            if (!matched) {
                this.pos++;
                this.column++;
            }
        }

        return tokens;
    }

    private parseStatement(index: number): { node: ASTNode | null; nextIndex: number } {
        if (index >= this.tokens.length) {
            return { node: null, nextIndex: index };
        }

        const token = this.tokens[index];

        switch (token.value) {
            case 'import':
                return this.parseImport(index);
            case 'export':
                return this.parseExport(index);
            case 'function':
                return this.parseFunction(index);
            case 'class':
                return this.parseClass(index);
            case 'interface':
                return this.parseInterface(index);
            case 'type':
                return this.parseTypeAlias(index);
            case 'enum':
                return this.parseEnum(index);
            case 'const':
            case 'let':
            case 'var':
                return this.parseVariable(index);
            default:
                // Skip to next statement
                return this.skipToNext(index);
        }
    }

    private parseImport(index: number): { node: ASTNode; nextIndex: number } {
        const startToken = this.tokens[index];
        let endIndex = index;

        // Find end of import (semicolon or next statement)
        while (endIndex < this.tokens.length && this.tokens[endIndex].value !== ';') {
            endIndex++;
        }

        const endToken = this.tokens[endIndex] || this.tokens[endIndex - 1];

        const node: ASTNode = {
            id: this.genId(),
            type: 'ImportDeclaration',
            start: startToken.start,
            end: endToken.end,
            children: [],
            source: this.source.slice(startToken.start.offset, endToken.end.offset)
        };

        return { node, nextIndex: endIndex + 1 };
    }

    private parseExport(index: number): { node: ASTNode; nextIndex: number } {
        const startToken = this.tokens[index];

        // Check what comes after export
        const nextToken = this.tokens[index + 1];
        if (nextToken) {
            if (nextToken.value === 'function') {
                const result = this.parseFunction(index + 1);
                result.node.type = 'ExportDeclaration';
                result.node.start = startToken.start;
                return result;
            }
            if (nextToken.value === 'class') {
                const result = this.parseClass(index + 1);
                result.node.type = 'ExportDeclaration';
                result.node.start = startToken.start;
                return result;
            }
            if (nextToken.value === 'default') {
                return this.parseExportDefault(index);
            }
        }

        // Generic export
        let endIndex = index;
        while (endIndex < this.tokens.length && this.tokens[endIndex].value !== ';') {
            endIndex++;
        }

        const endToken = this.tokens[endIndex] || this.tokens[endIndex - 1];

        return {
            node: {
                id: this.genId(),
                type: 'ExportDeclaration',
                start: startToken.start,
                end: endToken.end,
                children: []
            },
            nextIndex: endIndex + 1
        };
    }

    private parseExportDefault(index: number): { node: ASTNode; nextIndex: number } {
        const startToken = this.tokens[index];
        let endIndex = index + 2; // Skip 'export default'

        // Find end
        let braceCount = 0;
        while (endIndex < this.tokens.length) {
            const t = this.tokens[endIndex];
            if (t.value === '{') braceCount++;
            if (t.value === '}') braceCount--;
            if (braceCount === 0 && t.value === ';') break;
            endIndex++;
        }

        const endToken = this.tokens[endIndex] || this.tokens[endIndex - 1];

        return {
            node: {
                id: this.genId(),
                type: 'ExportDeclaration',
                name: 'default',
                start: startToken.start,
                end: endToken.end,
                children: []
            },
            nextIndex: endIndex + 1
        };
    }

    private parseFunction(index: number): { node: ASTNode; nextIndex: number } {
        const startToken = this.tokens[index];
        let nameToken: Token | undefined;

        // Get function name
        let i = index + 1;
        while (i < this.tokens.length) {
            if (this.tokens[i].type === 'identifier') {
                nameToken = this.tokens[i];
                break;
            }
            if (this.tokens[i].value === '(') break;
            i++;
        }

        // Find function body end
        let endIndex = i;
        let braceCount = 0;
        let foundBody = false;
        while (endIndex < this.tokens.length) {
            const t = this.tokens[endIndex];
            if (t.value === '{') {
                braceCount++;
                foundBody = true;
            }
            if (t.value === '}') {
                braceCount--;
                if (foundBody && braceCount === 0) {
                    endIndex++;
                    break;
                }
            }
            endIndex++;
        }

        const endToken = this.tokens[endIndex - 1] || startToken;

        return {
            node: {
                id: this.genId(),
                type: 'FunctionDeclaration',
                name: nameToken?.value,
                start: startToken.start,
                end: endToken.end,
                children: []
            },
            nextIndex: endIndex
        };
    }

    private parseClass(index: number): { node: ASTNode; nextIndex: number } {
        const startToken = this.tokens[index];
        let nameToken: Token | undefined;

        // Get class name
        let i = index + 1;
        while (i < this.tokens.length) {
            if (this.tokens[i].type === 'identifier' && this.tokens[i].value !== 'extends' && this.tokens[i].value !== 'implements') {
                nameToken = this.tokens[i];
                break;
            }
            if (this.tokens[i].value === '{') break;
            i++;
        }

        // Find class body end
        let endIndex = i;
        let braceCount = 0;
        let foundBody = false;
        while (endIndex < this.tokens.length) {
            const t = this.tokens[endIndex];
            if (t.value === '{') {
                braceCount++;
                foundBody = true;
            }
            if (t.value === '}') {
                braceCount--;
                if (foundBody && braceCount === 0) {
                    endIndex++;
                    break;
                }
            }
            endIndex++;
        }

        const endToken = this.tokens[endIndex - 1] || startToken;

        return {
            node: {
                id: this.genId(),
                type: 'ClassDeclaration',
                name: nameToken?.value,
                start: startToken.start,
                end: endToken.end,
                children: []
            },
            nextIndex: endIndex
        };
    }

    private parseInterface(index: number): { node: ASTNode; nextIndex: number } {
        const startToken = this.tokens[index];
        const nameToken = this.tokens[index + 1];

        let endIndex = index + 2;
        let braceCount = 0;
        while (endIndex < this.tokens.length) {
            const t = this.tokens[endIndex];
            if (t.value === '{') braceCount++;
            if (t.value === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endIndex++;
                    break;
                }
            }
            endIndex++;
        }

        const endToken = this.tokens[endIndex - 1] || startToken;

        return {
            node: {
                id: this.genId(),
                type: 'InterfaceDeclaration',
                name: nameToken?.type === 'identifier' ? nameToken.value : undefined,
                start: startToken.start,
                end: endToken.end,
                children: []
            },
            nextIndex: endIndex
        };
    }

    private parseTypeAlias(index: number): { node: ASTNode; nextIndex: number } {
        const startToken = this.tokens[index];
        const nameToken = this.tokens[index + 1];

        let endIndex = index + 2;
        while (endIndex < this.tokens.length && this.tokens[endIndex].value !== ';') {
            endIndex++;
        }

        const endToken = this.tokens[endIndex] || this.tokens[endIndex - 1];

        return {
            node: {
                id: this.genId(),
                type: 'TypeAliasDeclaration',
                name: nameToken?.type === 'identifier' ? nameToken.value : undefined,
                start: startToken.start,
                end: endToken.end,
                children: []
            },
            nextIndex: endIndex + 1
        };
    }

    private parseEnum(index: number): { node: ASTNode; nextIndex: number } {
        const startToken = this.tokens[index];
        const nameToken = this.tokens[index + 1];

        let endIndex = index + 2;
        let braceCount = 0;
        while (endIndex < this.tokens.length) {
            const t = this.tokens[endIndex];
            if (t.value === '{') braceCount++;
            if (t.value === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endIndex++;
                    break;
                }
            }
            endIndex++;
        }

        const endToken = this.tokens[endIndex - 1] || startToken;

        return {
            node: {
                id: this.genId(),
                type: 'EnumDeclaration',
                name: nameToken?.type === 'identifier' ? nameToken.value : undefined,
                start: startToken.start,
                end: endToken.end,
                children: []
            },
            nextIndex: endIndex
        };
    }

    private parseVariable(index: number): { node: ASTNode; nextIndex: number } {
        const startToken = this.tokens[index];
        const nameToken = this.tokens[index + 1];

        let endIndex = index + 2;
        let braceCount = 0;
        let parenCount = 0;
        while (endIndex < this.tokens.length) {
            const t = this.tokens[endIndex];
            if (t.value === '{') braceCount++;
            if (t.value === '}') braceCount--;
            if (t.value === '(') parenCount++;
            if (t.value === ')') parenCount--;
            if (braceCount === 0 && parenCount === 0 && t.value === ';') {
                endIndex++;
                break;
            }
            endIndex++;
        }

        const endToken = this.tokens[endIndex - 1] || startToken;

        return {
            node: {
                id: this.genId(),
                type: 'VariableDeclaration',
                name: nameToken?.type === 'identifier' ? nameToken.value : undefined,
                start: startToken.start,
                end: endToken.end,
                children: [],
                metadata: { kind: startToken.value }
            },
            nextIndex: endIndex
        };
    }

    private skipToNext(index: number): { node: null; nextIndex: number } {
        let endIndex = index;
        let braceCount = 0;
        while (endIndex < this.tokens.length) {
            const t = this.tokens[endIndex];
            if (t.value === '{') braceCount++;
            if (t.value === '}') braceCount--;
            if (braceCount === 0 && t.value === ';') {
                return { node: null, nextIndex: endIndex + 1 };
            }
            if (braceCount === 0 && (t.value === 'function' || t.value === 'class' || t.value === 'const' || t.value === 'let' || t.value === 'var' || t.value === 'import' || t.value === 'export')) {
                return { node: null, nextIndex: endIndex };
            }
            endIndex++;
        }
        return { node: null, nextIndex: this.tokens.length };
    }
}

interface Token {
    type: TokenType;
    value: string;
    start: Position;
    end: Position;
}

type TokenType = 'keyword' | 'identifier' | 'string' | 'number' | 'operator' | 'punctuation' | 'whitespace' | 'comment' | 'jsx';

// ============================================================================
// AST Lens Plugin Class
// ============================================================================

export class FXASTLens {
    public readonly name = 'ast-lens';
    public readonly version = '1.0.0';
    public readonly description = 'AST indexing, querying, and code intelligence';

    private fx: FXCore;
    private config: ASTLensConfig;
    private parser = new SimpleParser();
    private documents = new Map<string, ASTDocument>();
    private symbolIndex = new Map<string, Symbol[]>();

    constructor(fx: FXCore, config: ASTLensConfig = {}) {
        this.fx = fx;
        this.config = {
            languages: ['typescript', 'javascript', 'tsx', 'jsx'],
            indexOnParse: true,
            cacheAST: true,
            maxCacheSize: 100,
            ...config
        };

        this.initNodes();
    }

    private initNodes(): void {
        const $$ = this.fx.proxy();

        $$('workspace.ast').val({});
        $$('workspace.symbols').val({});
        $$('workspace.ast.stats').val({
            documentCount: 0,
            symbolCount: 0,
            lastParsed: null
        });
    }

    // ========================================================================
    // Parsing
    // ========================================================================

    /**
     * Parse source code and return AST
     */
    parse(source: string, path: string, language?: string): ASTDocument {
        const lang = language || this.detectLanguage(path);

        if (!this.config.languages!.includes(lang)) {
            throw new Error(`Unsupported language: ${lang}`);
        }

        const root = this.parser.parse(source, lang);
        const symbols = this.extractSymbols(root);
        const imports = this.extractImports(root, source);
        const exports = this.extractExports(root, source);

        const doc: ASTDocument = {
            path,
            language: lang,
            version: (this.documents.get(path)?.version || 0) + 1,
            root,
            symbols,
            imports,
            exports,
            errors: [],
            lastParsed: Date.now()
        };

        // Cache document
        if (this.config.cacheAST) {
            this.documents.set(path, doc);
            this.enforceMaxCache();
        }

        // Index symbols
        if (this.config.indexOnParse) {
            this.indexDocument(doc);
        }

        // Update FX nodes
        const $$ = this.fx.proxy();
        $$(`workspace.ast.${this.pathToKey(path)}`).val({
            path,
            language: lang,
            version: doc.version,
            symbolCount: symbols.length,
            lastParsed: doc.lastParsed
        });

        this.updateStats();

        return doc;
    }

    private detectLanguage(path: string): string {
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const langMap: Record<string, string> = {
            'ts': 'typescript',
            'tsx': 'tsx',
            'js': 'javascript',
            'jsx': 'jsx',
            'mjs': 'javascript',
            'mts': 'typescript'
        };
        return langMap[ext] || 'javascript';
    }

    private pathToKey(path: string): string {
        return path.replace(/[\/\\.]/g, '_');
    }

    private enforceMaxCache(): void {
        const max = this.config.maxCacheSize!;
        if (this.documents.size > max) {
            const sorted = Array.from(this.documents.entries())
                .sort((a, b) => a[1].lastParsed - b[1].lastParsed);

            const toRemove = sorted.slice(0, sorted.length - max);
            for (const [path] of toRemove) {
                this.documents.delete(path);
            }
        }
    }

    // ========================================================================
    // Symbol Extraction
    // ========================================================================

    private extractSymbols(node: ASTNode, scope: string = ''): Symbol[] {
        const symbols: Symbol[] = [];

        const walk = (n: ASTNode, currentScope: string) => {
            if (n.name) {
                const kind = this.nodeTypeToSymbolKind(n.type);
                if (kind) {
                    symbols.push({
                        name: n.name,
                        kind,
                        nodeId: n.id,
                        scope: currentScope,
                        references: [],
                        definition: n.start
                    });
                }
            }

            const newScope = n.name ? `${currentScope}.${n.name}` : currentScope;
            for (const child of n.children) {
                walk(child, newScope);
            }
        };

        walk(node, scope);
        return symbols;
    }

    private nodeTypeToSymbolKind(type: ASTNodeType): SymbolKind | null {
        const map: Partial<Record<ASTNodeType, SymbolKind>> = {
            'FunctionDeclaration': 'function',
            'ClassDeclaration': 'class',
            'InterfaceDeclaration': 'interface',
            'TypeAliasDeclaration': 'type',
            'EnumDeclaration': 'enum',
            'VariableDeclaration': 'variable',
            'MethodDefinition': 'method',
            'PropertyDefinition': 'property',
            'JSXComponent': 'component'
        };
        return map[type] || null;
    }

    private extractImports(root: ASTNode, source: string): ImportInfo[] {
        const imports: ImportInfo[] = [];

        const walk = (node: ASTNode) => {
            if (node.type === 'ImportDeclaration' && node.source) {
                const sourceMatch = node.source.match(/from\s+['"]([^'"]+)['"]/);
                if (sourceMatch) {
                    imports.push({
                        source: sourceMatch[1],
                        specifiers: this.parseImportSpecifiers(node.source),
                        position: node.start,
                        isTypeOnly: node.source.includes('import type')
                    });
                }
            }
            for (const child of node.children) {
                walk(child);
            }
        };

        walk(root);
        return imports;
    }

    private parseImportSpecifiers(source: string): ImportSpecifier[] {
        const specifiers: ImportSpecifier[] = [];

        // Default import
        const defaultMatch = source.match(/import\s+(\w+)\s+from/);
        if (defaultMatch) {
            specifiers.push({ name: defaultMatch[1], isDefault: true, isNamespace: false });
        }

        // Named imports
        const namedMatch = source.match(/\{([^}]+)\}/);
        if (namedMatch) {
            const names = namedMatch[1].split(',').map(s => s.trim());
            for (const name of names) {
                const aliasMatch = name.match(/(\w+)\s+as\s+(\w+)/);
                if (aliasMatch) {
                    specifiers.push({ name: aliasMatch[1], alias: aliasMatch[2], isDefault: false, isNamespace: false });
                } else if (name) {
                    specifiers.push({ name, isDefault: false, isNamespace: false });
                }
            }
        }

        // Namespace import
        const namespaceMatch = source.match(/\*\s+as\s+(\w+)/);
        if (namespaceMatch) {
            specifiers.push({ name: namespaceMatch[1], isDefault: false, isNamespace: true });
        }

        return specifiers;
    }

    private extractExports(root: ASTNode, source: string): ExportInfo[] {
        const exports: ExportInfo[] = [];

        const walk = (node: ASTNode) => {
            if (node.type === 'ExportDeclaration') {
                if (node.name === 'default') {
                    exports.push({ name: 'default', kind: 'default', position: node.start });
                } else if (node.name) {
                    exports.push({ name: node.name, kind: 'named', position: node.start });
                }
            }
            for (const child of node.children) {
                walk(child);
            }
        };

        walk(root);
        return exports;
    }

    // ========================================================================
    // Indexing
    // ========================================================================

    private indexDocument(doc: ASTDocument): void {
        // Index by symbol name
        for (const symbol of doc.symbols) {
            const key = symbol.name.toLowerCase();
            if (!this.symbolIndex.has(key)) {
                this.symbolIndex.set(key, []);
            }
            this.symbolIndex.get(key)!.push(symbol);
        }

        // Update FX symbol index
        const $$ = this.fx.proxy();
        const symbolData: Record<string, any> = {};
        for (const symbol of doc.symbols) {
            symbolData[symbol.name] = {
                kind: symbol.kind,
                path: doc.path,
                position: symbol.definition
            };
        }
        $$(`workspace.symbols.${this.pathToKey(doc.path)}`).val(symbolData);
    }

    // ========================================================================
    // Querying
    // ========================================================================

    /**
     * Find symbol by name
     */
    findSymbol(name: string): Symbol[] {
        return this.symbolIndex.get(name.toLowerCase()) || [];
    }

    /**
     * Search symbols by pattern
     */
    searchSymbols(pattern: string): Symbol[] {
        const regex = new RegExp(pattern, 'i');
        const results: Symbol[] = [];

        for (const [key, symbols] of this.symbolIndex) {
            if (regex.test(key)) {
                results.push(...symbols);
            }
        }

        return results;
    }

    /**
     * Get document for path
     */
    getDocument(path: string): ASTDocument | undefined {
        return this.documents.get(path);
    }

    /**
     * Find node at position
     */
    findNodeAtPosition(path: string, position: Position): ASTNode | null {
        const doc = this.documents.get(path);
        if (!doc) return null;

        const find = (node: ASTNode): ASTNode | null => {
            if (!this.positionInRange(position, node.start, node.end)) {
                return null;
            }

            // Check children first for more specific match
            for (const child of node.children) {
                const found = find(child);
                if (found) return found;
            }

            return node;
        };

        return find(doc.root);
    }

    private positionInRange(pos: Position, start: Position, end: Position): boolean {
        if (pos.line < start.line || pos.line > end.line) return false;
        if (pos.line === start.line && pos.column < start.column) return false;
        if (pos.line === end.line && pos.column > end.column) return false;
        return true;
    }

    /**
     * Query nodes by type
     */
    queryByType(path: string, type: ASTNodeType): ASTNode[] {
        const doc = this.documents.get(path);
        if (!doc) return [];

        const results: ASTNode[] = [];
        const walk = (node: ASTNode) => {
            if (node.type === type) {
                results.push(node);
            }
            for (const child of node.children) {
                walk(child);
            }
        };

        walk(doc.root);
        return results;
    }

    /**
     * Get all symbols in document
     */
    getSymbols(path: string): Symbol[] {
        return this.documents.get(path)?.symbols || [];
    }

    /**
     * Get imports for document
     */
    getImports(path: string): ImportInfo[] {
        return this.documents.get(path)?.imports || [];
    }

    /**
     * Get exports for document
     */
    getExports(path: string): ExportInfo[] {
        return this.documents.get(path)?.exports || [];
    }

    // ========================================================================
    // Diffing
    // ========================================================================

    /**
     * Compute diff between two ASTs
     */
    diff(oldPath: string, newPath: string): ASTDiff[] {
        const oldDoc = this.documents.get(oldPath);
        const newDoc = this.documents.get(newPath);

        if (!oldDoc || !newDoc) {
            throw new Error('Documents not found');
        }

        return this.computeDiff(oldDoc.root, newDoc.root, '');
    }

    /**
     * Compute incremental diff
     */
    incrementalDiff(path: string, newSource: string): ASTDiff[] {
        const oldDoc = this.documents.get(path);
        const newDoc = this.parse(newSource, path);

        if (!oldDoc) {
            return this.getAllNodes(newDoc.root).map(node => ({
                type: 'add' as const,
                path: node.id,
                newNode: node
            }));
        }

        return this.computeDiff(oldDoc.root, newDoc.root, '');
    }

    private computeDiff(oldNode: ASTNode, newNode: ASTNode, path: string): ASTDiff[] {
        const diffs: ASTDiff[] = [];

        // Compare types
        if (oldNode.type !== newNode.type) {
            diffs.push({
                type: 'modify',
                path,
                oldNode,
                newNode
            });
            return diffs;
        }

        // Compare names
        if (oldNode.name !== newNode.name) {
            diffs.push({
                type: 'modify',
                path,
                oldNode,
                newNode
            });
        }

        // Compare children
        const oldChildren = new Map(oldNode.children.map(c => [c.name || c.id, c]));
        const newChildren = new Map(newNode.children.map(c => [c.name || c.id, c]));

        // Find removed
        for (const [key, child] of oldChildren) {
            if (!newChildren.has(key)) {
                diffs.push({
                    type: 'remove',
                    path: `${path}/${key}`,
                    oldNode: child
                });
            }
        }

        // Find added
        for (const [key, child] of newChildren) {
            if (!oldChildren.has(key)) {
                diffs.push({
                    type: 'add',
                    path: `${path}/${key}`,
                    newNode: child
                });
            }
        }

        // Recurse into matching children
        for (const [key, oldChild] of oldChildren) {
            const newChild = newChildren.get(key);
            if (newChild) {
                diffs.push(...this.computeDiff(oldChild, newChild, `${path}/${key}`));
            }
        }

        return diffs;
    }

    private getAllNodes(node: ASTNode): ASTNode[] {
        const nodes: ASTNode[] = [node];
        for (const child of node.children) {
            nodes.push(...this.getAllNodes(child));
        }
        return nodes;
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    private updateStats(): void {
        const $$ = this.fx.proxy();

        let symbolCount = 0;
        for (const doc of this.documents.values()) {
            symbolCount += doc.symbols.length;
        }

        $$('workspace.ast.stats').val({
            documentCount: this.documents.size,
            symbolCount,
            lastParsed: Date.now()
        });
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.documents.clear();
        this.symbolIndex.clear();

        const $$ = this.fx.proxy();
        $$('workspace.ast').val({});
        $$('workspace.symbols').val({});

        this.updateStats();
    }

    /**
     * Get cached document count
     */
    getCacheSize(): number {
        return this.documents.size;
    }
}

// ============================================================================
// Plugin Export
// ============================================================================

export default function(fx: FXCore, config: ASTLensConfig = {}): FXASTLens {
    return new FXASTLens(fx, config);
}
