// /plugins/fx-jsx.ts
/**
 * @fx-plugin fx-jsx
 * @fx-global jsx,FXJSXComponent
 * @fx-description Native JSX parsing with FX reactivity
 * @fx-dependencies $
 * @fx-provides jsx,FXJSXComponent
 * @fx-version 2.0.0
 *
 * FX JSX Parser with Native Reactivity
 * Provides JSX parsing, rendering, and reactive binding with FX nodes
 */

import type { FXCore as FX, FXNodeProxy } from "../fx.v4";

type FXN = FXNodeProxy<any, any>;

interface FXLoggerInterface {
  log(level: string, message: string, data?: any): void;
  error(message: string, error?: any): void;
  warn(message: string, data?: any): void;
  info(message: string, data?: any): void;
}

class FXLogger implements FXLoggerInterface {
  static log(level: string, message: string, data: any = {}): void {
    console.log(`[FX-JSX:${level.toUpperCase()}]`, message, data);
  }

  static error(message: string, error?: any): void {
    this.log('error', message, { error });
  }

  static warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  static info(message: string, data?: any): void {
    this.log('info', message, data);
  }
}

// Token types for JSX parsing
interface BaseToken {
  type: string;
}

interface OpeningTagToken extends BaseToken {
  type: 'opening-tag';
  tagName: string;
  attributes: AttributeInfo[];
  selfClosing: boolean;
}

interface ClosingTagToken extends BaseToken {
  type: 'closing-tag';
  tagName: string;
}

interface TextToken extends BaseToken {
  type: 'text';
  value: string;
}

interface ExpressionToken extends BaseToken {
  type: 'expression';
  value: string;
}

type JSXToken = OpeningTagToken | ClosingTagToken | TextToken | ExpressionToken;

interface AttributeInfo {
  name: string;
  value: string | ExpressionToken | null;
}

interface ParseResult {
  token: JSXToken;
  newPosition: number;
}

interface AttributeParseResult {
  attribute: AttributeInfo;
  newPosition: number;
}

// JSX element types
interface BaseJSXElement {
  type: string;
}

interface JSXElement extends BaseJSXElement {
  type: 'element';
  tagName: string;
  attributes: AttributeInfo[];
  children: JSXNode[];
}

interface JSXText extends BaseJSXElement {
  type: 'text';
  content: string;
}

interface JSXExpression extends BaseJSXElement {
  type: 'expression';
  content: string;
}

interface JSXFragment extends BaseJSXElement {
  type: 'fragment';
  children: JSXNode[];
}

type JSXNode = JSXElement | JSXText | JSXExpression | JSXFragment;

// Component interfaces
interface ComponentProps {
  [key: string]: any;
}

interface ComponentState {
  [key: string]: any;
}

interface ComponentClass {
  new (props: ComponentProps, children: JSXNode[]): FXJSXComponent;
}

interface ComponentRegistry {
  get(name: string): ComponentClass | undefined;
  has(name: string): boolean;
  set(name: string, component: ComponentClass): void;
}

interface RenderContext {
  [key: string]: any;
  component?: FXJSXComponent;
}

/**
 * @class FXJSXParser
 * @description Simple but powerful JSX parser
 */
class FXJSXParser {
  private tokens: JSXToken[] = [];
  private position = 0;

  public parse(jsxString: string): JSXNode {
    try {
      this.tokens = this.tokenize(jsxString);
      this.position = 0;
      return this.parseElement();
    } catch (error) {
      FXLogger.error('JSX parsing failed', error);
      throw error;
    }
  }

  private tokenize(jsx: string): JSXToken[] {
    const tokens: JSXToken[] = [];
    let i = 0;

    while (i < jsx.length) {
      const char = jsx[i];

      if (char === '<') {
        const tagResult = this.parseTag(jsx, i);
        tokens.push(tagResult.token);
        i = tagResult.newPosition;
      } else if (char === '{') {
        const exprResult = this.parseExpression(jsx, i);
        tokens.push(exprResult.token);
        i = exprResult.newPosition;
      } else if (char.trim()) {
        const textResult = this.parseText(jsx, i);
        if (textResult.token.value.trim()) {
          tokens.push(textResult.token);
        }
        i = textResult.newPosition;
      } else {
        i++;
      }
    }

    return tokens;
  }

  private parseTag(jsx: string, start: number): ParseResult {
    let i = start + 1; // Skip '<'
    let tagName = '';
    let attributes: AttributeInfo[] = [];
    let selfClosing = false;
    let closing = false;

    // Check if closing tag
    if (jsx[i] === '/') {
      closing = true;
      i++;
    }

    // Parse tag name
    while (i < jsx.length && jsx[i] !== ' ' && jsx[i] !== '>' && jsx[i] !== '/') {
      tagName += jsx[i];
      i++;
    }

    // Skip whitespace
    while (jsx[i] === ' ') i++;

    // Parse attributes (if not closing tag)
    if (!closing) {
      while (i < jsx.length && jsx[i] !== '>' && jsx[i] !== '/') {
        const attrResult = this.parseAttribute(jsx, i);
        attributes.push(attrResult.attribute);
        i = attrResult.newPosition;

        // Skip whitespace
        while (jsx[i] === ' ') i++;
      }
    }

    // Check for self-closing
    if (jsx[i] === '/') {
      selfClosing = true;
      i++;
    }

    // Skip '>'
    i++;

    const token: JSXToken = closing
      ? { type: 'closing-tag', tagName }
      : { type: 'opening-tag', tagName, attributes, selfClosing };

    return { token, newPosition: i };
  }

  private parseAttribute(jsx: string, start: number): AttributeParseResult {
    let i = start;
    let name = '';
    let value: string | ExpressionToken | null = null;

    // Parse attribute name
    while (i < jsx.length && jsx[i] !== '=' && jsx[i] !== ' ' && jsx[i] !== '>' && jsx[i] !== '/') {
      name += jsx[i];
      i++;
    }

    // Skip whitespace
    while (jsx[i] === ' ') i++;

    // Parse value if present
    if (jsx[i] === '=') {
      i++; // Skip '='
      while (jsx[i] === ' ') i++; // Skip whitespace

      if (jsx[i] === '"' || jsx[i] === "'") {
        // String value
        const quote = jsx[i];
        i++; // Skip opening quote
        value = '';
        while (i < jsx.length && jsx[i] !== quote) {
          value += jsx[i];
          i++;
        }
        i++; // Skip closing quote
      } else if (jsx[i] === '{') {
        // Expression value
        const exprResult = this.parseExpression(jsx, i);
        value = exprResult.token as ExpressionToken;
        i = exprResult.newPosition;
      }
    }

    return {
      attribute: { name, value },
      newPosition: i
    };
  }

  private parseExpression(jsx: string, start: number): ParseResult {
    let i = start + 1; // Skip '{'
    let expression = '';
    let braceCount = 1;

    while (i < jsx.length && braceCount > 0) {
      if (jsx[i] === '{') {
        braceCount++;
      } else if (jsx[i] === '}') {
        braceCount--;
      }

      if (braceCount > 0) {
        expression += jsx[i];
      }
      i++;
    }

    return {
      token: {
        type: 'expression',
        value: expression.trim()
      },
      newPosition: i
    };
  }

  private parseText(jsx: string, start: number): ParseResult {
    let i = start;
    let text = '';

    while (i < jsx.length && jsx[i] !== '<' && jsx[i] !== '{') {
      text += jsx[i];
      i++;
    }

    return {
      token: {
        type: 'text',
        value: text
      },
      newPosition: i
    };
  }

  private parseElement(): JSXNode {
    const elements: JSXNode[] = [];

    while (this.position < this.tokens.length) {
      const token = this.tokens[this.position];

      if (token.type === 'opening-tag') {
        const element = this.parseCompleteElement();
        elements.push(element);
      } else if (token.type === 'text') {
        elements.push({
          type: 'text',
          content: (token as TextToken).value
        });
        this.position++;
      } else if (token.type === 'expression') {
        elements.push({
          type: 'expression',
          content: (token as ExpressionToken).value
        });
        this.position++;
      } else {
        this.position++;
      }
    }

    return elements.length === 1 ? elements[0] : { type: 'fragment', children: elements };
  }

  private parseCompleteElement(): JSXElement {
    const openingTag = this.tokens[this.position] as OpeningTagToken;
    this.position++;

    if (openingTag.selfClosing) {
      return {
        type: 'element',
        tagName: openingTag.tagName,
        attributes: openingTag.attributes,
        children: []
      };
    }

    const children: JSXNode[] = [];

    while (this.position < this.tokens.length) {
      const token = this.tokens[this.position];

      if (token.type === 'closing-tag' && (token as ClosingTagToken).tagName === openingTag.tagName) {
        this.position++;
        break;
      } else if (token.type === 'opening-tag') {
        children.push(this.parseCompleteElement());
      } else if (token.type === 'text') {
        children.push({
          type: 'text',
          content: (token as TextToken).value
        });
        this.position++;
      } else if (token.type === 'expression') {
        children.push({
          type: 'expression',
          content: (token as ExpressionToken).value
        });
        this.position++;
      } else {
        this.position++;
      }
    }

    return {
      type: 'element',
      tagName: openingTag.tagName,
      attributes: openingTag.attributes,
      children
    };
  }
}

/**
 * @class FXJSXRenderer
 * @description Renders JSX to reactive DOM with FX integration
 */
class FXJSXRenderer {
  private fx: FX;
  private componentRegistry: ComponentRegistry;
  private elementRegistry = new WeakMap<Element, string>();
  private watchers = new Map<string, Set<() => void>>();
  private $: any; // fx-dom-dollar $ function

  constructor(fx: FX) {
    this.fx = fx;
    this.componentRegistry = new Map() as ComponentRegistry;

    // Get fx-dom-dollar $ function if available
    this.$ = (globalThis as any).$;

    if (!this.$) {
      FXLogger.warn('fx-dom-dollar not found. JSX will use basic DOM manipulation.');
    }
  }

  public registerComponent(name: string, component: ComponentClass): void {
    this.componentRegistry.set(name, component);
    FXLogger.info(`JSX Component registered: ${name}`);
  }

  public render(jsxElement: JSXNode, container?: string | Element, context: RenderContext = {}): Element | DocumentFragment {
    try {
      const element = this.renderElement(jsxElement, context);

      if (container) {
        const containerElement = typeof container === 'string'
          ? document.querySelector(container)
          : container;

        if (containerElement) {
          containerElement.appendChild(element);
        }
      }

      return element;
    } catch (error) {
      FXLogger.error('JSX rendering failed', error);
      throw error;
    }
  }

  private renderElement(jsxElement: JSXNode, context: RenderContext): Element | DocumentFragment | Text {
    switch (jsxElement.type) {
      case 'element':
        return this.renderHTMLElement(jsxElement as JSXElement, context);
      case 'text':
        return this.renderText(jsxElement as JSXText, context);
      case 'expression':
        return this.renderExpression(jsxElement as JSXExpression, context);
      case 'fragment':
        return this.renderFragment(jsxElement as JSXFragment, context);
      default:
        return document.createTextNode('');
    }
  }

  private renderHTMLElement(jsxElement: JSXElement, context: RenderContext): Element {
    const { tagName, attributes, children } = jsxElement;

    // Check if it's a custom component
    if (this.componentRegistry.has(tagName)) {
      return this.renderComponent(tagName, attributes, children, context);
    }

    // Create HTML element
    const element = document.createElement(tagName);

    // Set attributes with reactivity
    attributes.forEach(attr => {
      this.setReactiveAttribute(element, attr, context);
    });

    // Render children
    children.forEach(child => {
      const childElement = this.renderElement(child, context);
      if (childElement) {
        element.appendChild(childElement);
      }
    });

    return element;
  }

  private renderComponent(componentName: string, attributes: AttributeInfo[], children: JSXNode[], context: RenderContext): Element {
    const ComponentClass = this.componentRegistry.get(componentName);
    if (!ComponentClass) {
      throw new Error(`Component ${componentName} not found`);
    }

    // Build props from attributes
    const props: ComponentProps = {};
    attributes.forEach(attr => {
      if (attr.value && typeof attr.value === 'object' && attr.value.type === 'expression') {
        props[attr.name] = this.evaluateExpression(attr.value.value, context);
      } else {
        props[attr.name] = attr.value;
      }
    });

    // Create component instance
    const component = new ComponentClass(props, children);

    // Create FX node for component state
    const nodePath = `jsx.components.${componentName}.${Date.now()}`;
    const componentNode = (this.fx as any).$$(nodePath);
    component.$$node = componentNode;

    // Set up component state reactivity
    if (component.state) {
      Object.keys(component.state).forEach(key => {
        componentNode[key] = component.state[key];
      });
    }

    // Render component
    const jsxResult = component.render();
    const element = this.renderElement(jsxResult, { ...context, component }) as Element;

    // Set up reactivity watchers
    this.setupComponentReactivity(component, element, context);

    return element;
  }

  private renderText(jsxElement: JSXText, context: RenderContext): Text {
    return document.createTextNode(jsxElement.content);
  }

  private renderExpression(jsxElement: JSXExpression, context: RenderContext): Text {
    const value = this.evaluateExpression(jsxElement.content, context);
    const textNode = document.createTextNode(String(value));

    // Use fx-dom-dollar for reactive text updates if available
    if (this.$) {
      const $textNode = this.$(textNode as any);
      if ($textNode && typeof $textNode.text === 'function') {
        const fxExpr = this.buildFXExpression(jsxElement.content, context);
        if (typeof fxExpr === 'object' && fxExpr.watch) {
          // It's an FX node - use fx-dom-dollar's reactive text binding
          $textNode.text(fxExpr);
          return textNode;
        }
      }
    }

    // Fallback to manual reactivity setup
    this.setupExpressionReactivity(jsxElement.content, textNode, context);
    return textNode;
  }

  private renderFragment(jsxElement: JSXFragment, context: RenderContext): DocumentFragment {
    const fragment = document.createDocumentFragment();

    jsxElement.children.forEach(child => {
      const element = this.renderElement(child, context);
      if (element) {
        fragment.appendChild(element);
      }
    });

    return fragment;
  }

  private setReactiveAttribute(element: Element, attr: AttributeInfo, context: RenderContext): void {
    const { name, value } = attr;

    if (value && typeof value === 'object' && value.type === 'expression') {
      // Use fx-dom-dollar for reactive attributes if available
      if (this.$) {
        const $element = this.$(element);
        if ($element) {
          if (name === 'className') {
            // Use fx-dom-dollar's reactive class handling
            const classExpr = this.buildFXExpression(value.value, context);
            $element.attr('class', classExpr);
          } else if (name.startsWith('on')) {
            // Event handler through fx-dom-dollar
            const eventName = name.slice(2).toLowerCase();
            const handler = this.evaluateExpression(value.value, context);
            $element.on(eventName, handler);
          } else {
            // Generic reactive attribute through fx-dom-dollar
            const attrExpr = this.buildFXExpression(value.value, context);
            $element.attr(name, attrExpr);
          }
          return;
        }
      }

      // Fallback to manual DOM manipulation if fx-dom-dollar not available
      const updateAttribute = () => {
        const newValue = this.evaluateExpression(value.value, context);

        if (name === 'className') {
          (element as HTMLElement).className = newValue;
        } else if (name.startsWith('on')) {
          const eventName = name.slice(2).toLowerCase();
          element.addEventListener(eventName, newValue);
        } else {
          element.setAttribute(name, newValue);
        }
      };

      updateAttribute();
      this.setupExpressionReactivity(value.value, updateAttribute, context);
    } else {
      // Static attribute - use fx-dom-dollar if available
      if (this.$ && element) {
        const $element = this.$(element);
        if ($element) {
          if (name === 'className') {
            $element.attr('class', (value as string) || '');
          } else {
            $element.attr(name, (value as string) || '');
          }
          return;
        }
      }

      // Fallback to direct DOM manipulation
      if (name === 'className') {
        (element as HTMLElement).className = (value as string) || '';
      } else {
        element.setAttribute(name, (value as string) || '');
      }
    }
  }

  private setupExpressionReactivity(expression: string, updateTarget: Text | (() => void), context: RenderContext): void {
    // Extract FX paths from expression
    const fxPaths = this.extractFXPaths(expression);

    fxPaths.forEach(path => {
      const node = (this.fx as any).$$(path);
      const watcher = node.watch(() => {
        if (typeof updateTarget === 'function') {
          updateTarget();
        } else {
          // updateTarget is a text node
          const newValue = this.evaluateExpression(expression, context);
          updateTarget.textContent = String(newValue);
        }
      });

      // Store watcher for cleanup
      if (!this.watchers.has(path)) {
        this.watchers.set(path, new Set());
      }
      this.watchers.get(path)!.add(watcher);
    });
  }

  private setupComponentReactivity(component: FXJSXComponent, element: Element, context: RenderContext): void {
    if (!component.$$node) return;

    // Watch component state changes
    component.$$node.watch(() => {
      // Re-render component
      const newJsxResult = component.render();
      const newElement = this.renderElement(newJsxResult, { ...context, component }) as Element;

      // Replace element in DOM
      if (element.parentNode) {
        element.parentNode.replaceChild(newElement, element);
      }
    });
  }

  private extractFXPaths(expression: string): string[] {
    // Simple regex to find FX node references
    const pathRegex = /\$\$(\w+(?:\.\w+)*)/g;
    const paths: string[] = [];
    let match;

    while ((match = pathRegex.exec(expression)) !== null) {
      paths.push(match[1]);
    }

    return paths;
  }

  private evaluateExpression(expression: string, context: RenderContext): any {
    try {
      // Build evaluation context
      const evalContext = {
        ...context,
        // Add FX node accessors
        ...this.buildFXContext()
      };

      const func = new Function(...Object.keys(evalContext), `return ${expression}`);
      return func(...Object.values(evalContext));
    } catch (error) {
      FXLogger.error('Expression evaluation failed', error);
      return '';
    }
  }

  private buildFXContext(): Record<string, any> {
    // Create context with FX node accessors
    return new Proxy({}, {
      get: (target, prop) => {
        if (typeof prop === 'string' && prop.startsWith('$$')) {
          const path = prop.slice(2);
          return (this.fx as any).$$(path);
        }
        return (target as any)[prop];
      }
    });
  }

  private buildFXExpression(expression: string, context: RenderContext): any {
    // Extract FX paths and create reactive expression for fx-dom-dollar
    const fxPaths = this.extractFXPaths(expression);

    if (fxPaths.length === 1 && expression.trim() === `$$("${fxPaths[0]}")`) {
      // Simple FX node reference - return the node directly for fx-dom-dollar
      return (this.fx as any).$$(fxPaths[0]);
    }

    // Complex expression - evaluate and set up manual reactivity
    return this.evaluateExpression(expression, context);
  }
}

/**
 * @class FXJSXComponent
 * @description Base class for FX JSX components
 */
export class FXJSXComponent {
  public props: ComponentProps;
  public children: JSXNode[];
  public state: ComponentState = {};
  public $$node: FXN | null = null;

  constructor(props: ComponentProps = {}, children: JSXNode[] = []) {
    this.props = props;
    this.children = children;
  }

  public setState(updates: Partial<ComponentState>): void {
    if (this.$$node) {
      Object.keys(updates).forEach(key => {
        (this.$$node as any)[key] = updates[key];
      });
    }
    Object.assign(this.state, updates);
  }

  public render(): JSXNode {
    // Override in subclasses
    return { type: 'text', content: 'Override render() method' };
  }
}

/**
 * @class FXJSXEngine
 * @description Main JSX engine
 */
class FXJSXEngine {
  private fx: FX;
  private parser: FXJSXParser;
  private renderer: FXJSXRenderer;

  constructor(fx: FX) {
    this.fx = fx;
    this.parser = new FXJSXParser();
    this.renderer = new FXJSXRenderer(fx);

    this.initGlobals();
    FXLogger.info('FX JSX Engine initialized');
  }

  private initGlobals(): void {
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).jsx = this;
      (globalThis as any).FXJSXComponent = FXJSXComponent;
    }
  }

  // Transform and render JSX
  public render(jsxString: string, container?: string | Element, context: RenderContext = {}): Element | DocumentFragment {
    const parsed = this.parser.parse(jsxString);
    return this.renderer.render(parsed, container, context);
  }

  // Register component
  public component(name: string, componentClass: ComponentClass): void {
    this.renderer.registerComponent(name, componentClass);
  }

  // Template literal helper
  public jsx(strings: TemplateStringsArray, ...expressions: any[]): Element | DocumentFragment {
    let result = strings[0];

    for (let i = 0; i < expressions.length; i++) {
      result += `{${expressions[i]}}${strings[i + 1]}`;
    }

    return this.render(result);
  }
}

// Plugin factory function
export default function fxJSXPlugin(fx: FX, options: any = {}): FXJSXEngine {
  return new FXJSXEngine(fx);
}

// Export types for external use
export type {
  JSXNode,
  JSXElement,
  JSXText,
  JSXExpression,
  JSXFragment,
  ComponentProps,
  ComponentState,
  ComponentClass,
  RenderContext
};