// /plugins/fx-dom-dollar.ts
import type { FXCore as FX, FXNodeProxy } from "../fx.v4";

type FXN = FXNodeProxy<any, any>;
type Setter<T = any> = T | FXN;

function isFXNode(x: any): x is FXN {
  return x && typeof x === "function" && typeof x.node === "function";
}

function needsUnit(prop: string) {
  return /^(width|height|top|left|right|bottom|margin|padding|font(size)?)$/i.test(prop);
}

function autoPath(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  const parts: string[] = [];
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body) {
    let part = cur.tagName.toLowerCase();
    const parentEl: HTMLElement | null = cur.parentElement;
    if (parentEl) {
      const idx = Array.from(parentEl.children).indexOf(cur);
      part += `:${idx}`;
    }
    parts.unshift(part);
    cur = parentEl;
  }
  return parts.join(".");
}

export default function domDollarPlugin(fx: FX) {
  // ——————————————————————————————————————————————————————————
  // Mount map + helpers (lazy)
  // ——————————————————————————————————————————————————————————
  const elToPath = new WeakMap<HTMLElement, string>();
  const mounted = new WeakSet<HTMLElement>();

  function mount(el: HTMLElement): FXN {
    if (!mounted.has(el)) {
      const path = "dom." + autoPath(el);
      elToPath.set(el, path);
      mounted.add(el);
      (fx as any).$$(path).set(el); // store the real HTMLElement as value
      // Optional: inherit a DOM behavior to allow $$("dom.…").dom.css(...)
      // Not required for $(), but nice if you also use $$.
      (fx as any).$$(path).inherit(DomBehavior);
    }
    const p = elToPath.get(el)!;
    return (fx as any).$$(p);
  }

  function applyReactive<T>(valueOrNode: Setter<T>, apply: (v: T)=>void) {
    if (isFXNode(valueOrNode)) {
      const src = valueOrNode;
      const push = () => apply(src.get() as T);
      push();
      src.watch(() => push());
    } else {
      apply(valueOrNode as T);
    }
  }

  // ——————————————————————————————————————————————————————————
  // DOM Behavior (for $$("dom.…") usage; optional but tiny)
  // ——————————————————————————————————————————————————————————
  const DomBehavior = {
    name: "dom",

    css(this: FXN, prop: string | Record<string, Setter>, v?: Setter) {
      const el = this.get() as HTMLElement;
      if (!(el instanceof HTMLElement)) return this;
      const setOne = (k: string, vv: Setter) =>
        applyReactive(vv, (nv: any) => {
          (el.style as any)[k] = typeof nv === "number" && needsUnit(k) ? `${nv}px` : String(nv);
        });
      if (typeof prop === "string") {
        if (v === undefined) return getComputedStyle(el).getPropertyValue(prop);
        setOne(prop, v);
      } else {
        for (const [k, vv] of Object.entries(prop)) setOne(k, vv);
      }
      return this;
    },

    attr(this: FXN, name: string | Record<string, Setter<string>>, v?: Setter<string>) {
      const el = this.get() as HTMLElement;
      if (!(el instanceof HTMLElement)) return this;
      const setOne = (k: string, vv: Setter<string>) =>
        applyReactive(vv, (nv) => el.setAttribute(k, String(nv ?? "")));
      if (typeof name === "string") {
        if (v === undefined) return el.getAttribute(name);
        setOne(name, v);
      } else {
        for (const [k, vv] of Object.entries(name)) setOne(k, vv);
      }
      return this;
    },

    text(this: FXN, v?: Setter<string>) {
      const el = this.get() as HTMLElement;
      if (!(el instanceof HTMLElement)) return v === undefined ? undefined : this;
      if (v === undefined) return el.textContent || "";
      applyReactive(v, (nv) => { el.textContent = String(nv ?? ""); });
      return this;
    },

    html(this: FXN, v?: Setter<string>) {
      const el = this.get() as HTMLElement;
      if (!(el instanceof HTMLElement)) return v === undefined ? undefined : this;
      if (v === undefined) return el.innerHTML;
      applyReactive(v, (nv) => { el.innerHTML = String(nv ?? ""); });
      return this;
    },

    val(this: FXN, v?: Setter) {
      const el = this.get() as HTMLElement;
      if (!(el instanceof HTMLElement)) return v === undefined ? undefined : this;
      if (v === undefined) {
        if (el instanceof HTMLInputElement) {
          return el.type === "checkbox" ? !!el.checked : el.value;
        }
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
          return el.value;
        }
        return el.textContent ?? "";
      }
      applyReactive(v, (nv: any) => {
        if (el instanceof HTMLInputElement) {
          if (el.type === "checkbox") el.checked = !!nv;
          else el.value = nv ?? "";
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
          el.value = nv ?? "";
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          el.textContent = nv == null ? "" : String(nv);
        }
      });
      return this;
    },

    addClass(this: FXN, ...names: string[]) {
      const el = this.get() as HTMLElement; if (!(el instanceof HTMLElement)) return this;
      names.flatMap(n=>n.split(/\s+/)).filter(Boolean).forEach(c=>el.classList.add(c));
      return this;
    },
    removeClass(this: FXN, ...names: string[]) {
      const el = this.get() as HTMLElement; if (!(el instanceof HTMLElement)) return this;
      names.flatMap(n=>n.split(/\s+/)).filter(Boolean).forEach(c=>el.classList.remove(c));
      return this;
    },
    toggleClass(this: FXN, name: string, state?: boolean) {
      const el = this.get() as HTMLElement; if (!(el instanceof HTMLElement)) return this;
      el.classList.toggle(name, state ?? !el.classList.contains(name));
      return this;
    },

    on(this: FXN, evt: string, handler: EventListener, opts?: AddEventListenerOptions) {
      const el = this.get() as HTMLElement; if (!(el instanceof HTMLElement)) return this;
      evt.split(/\s+/).forEach(e => el.addEventListener(e, handler, opts));
      return this;
    },
    off(this: FXN, evt: string, handler?: EventListener) {
      const el = this.get() as HTMLElement; if (!(el instanceof HTMLElement)) return this;
      evt.split(/\s+/).forEach(e => handler ? el.removeEventListener(e, handler) : null);
      return this;
    },
    trigger(this: FXN, evt: string, detail?: any) {
      const el = this.get() as HTMLElement; if (!(el instanceof HTMLElement)) return this;
      el.dispatchEvent(new CustomEvent(evt, { bubbles: true, cancelable: true, detail }));
      return this;
    },
  };

  // ——————————————————————————————————————————————————————————
  // Animation support (synchronous API)
  // ——————————————————————————————————————————————————————————
  interface AnimationOptions {
    duration?: number;
    easing?: string;
    complete?: () => void;
  }

  function animate(el: HTMLElement, props: Record<string, any>, options: AnimationOptions = {}) {
    const duration = options.duration ?? 400;
    const easing = options.easing ?? 'ease';
    const complete = options.complete;

    // Store original values
    const originalTransition = el.style.transition;

    // Set transition
    el.style.transition = `all ${duration}ms ${easing}`;

    // Apply properties
    for (const [key, value] of Object.entries(props)) {
      const propName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      if (typeof value === 'number' && needsUnit(key)) {
        (el.style as any)[key] = `${value}px`;
      } else {
        (el.style as any)[key] = String(value);
      }
    }

    // Cleanup after animation
    setTimeout(() => {
      el.style.transition = originalTransition;
      if (complete) complete();
    }, duration);
  }

  function fadeIn(el: HTMLElement, duration: number = 400, complete?: () => void) {
    el.style.opacity = '0';
    el.style.display = '';
    // Force reflow
    el.offsetHeight;
    animate(el, { opacity: 1 }, { duration, complete });
  }

  function fadeOut(el: HTMLElement, duration: number = 400, complete?: () => void) {
    animate(el, { opacity: 0 }, {
      duration,
      complete: () => {
        el.style.display = 'none';
        if (complete) complete();
      }
    });
  }

  function slideDown(el: HTMLElement, duration: number = 400, complete?: () => void) {
    // Save original styles
    const origHeight = el.style.height;
    const origOverflow = el.style.overflow;

    // Setup
    el.style.height = '0';
    el.style.overflow = 'hidden';
    el.style.display = '';

    // Measure natural height
    const naturalHeight = el.scrollHeight;

    // Animate
    animate(el, { height: naturalHeight }, {
      duration,
      complete: () => {
        el.style.height = origHeight;
        el.style.overflow = origOverflow;
        if (complete) complete();
      }
    });
  }

  function slideUp(el: HTMLElement, duration: number = 400, complete?: () => void) {
    const origHeight = el.style.height;
    const origOverflow = el.style.overflow;

    el.style.overflow = 'hidden';

    animate(el, { height: 0 }, {
      duration,
      complete: () => {
        el.style.display = 'none';
        el.style.height = origHeight;
        el.style.overflow = origOverflow;
        if (complete) complete();
      }
    });
  }

  // ——————————————————————————————————————————————————————————
  // $ HANDLE + GROUP (lazy)
  // ——————————————————————————————————————————————————————————
  type Handle = ReturnType<typeof makeHandle>;
  type Group = ReturnType<typeof makeGroup>;

  function makeHandle(el: HTMLElement) {
    // We only mount when any method is called (lazy):
    const h = {
      el,
      // Value-ish
      val(v?: Setter) {
        const n = mount(el);
        return (DomBehavior.val as any).call(n, v);
      },
      text(v?: Setter<string>) {
        const n = mount(el);
        return (DomBehavior.text as any).call(n, v);
      },
      html(v?: Setter<string>) {
        const n = mount(el);
        return (DomBehavior.html as any).call(n, v);
      },

      // Attributes / CSS
      attr(name: string | Record<string, Setter<string>>, v?: Setter<string>) {
        const n = mount(el);
        return (DomBehavior.attr as any).call(n, name, v);
      },
      css(prop: string | Record<string, Setter>, v?: Setter) {
        const n = mount(el);
        return (DomBehavior.css as any).call(n, prop, v);
      },

      // Classes
      addClass(...names: string[]) { (DomBehavior.addClass as any).call(mount(el), ...names); return h; },
      removeClass(...names: string[]) { (DomBehavior.removeClass as any).call(mount(el), ...names); return h; },
      toggleClass(name: string, state?: boolean) { (DomBehavior.toggleClass as any).call(mount(el), name, state); return h; },
      hasClass(name: string) { const n = mount(el); const _el = n.get() as HTMLElement; return _el.classList.contains(name); },

      // Events
      on(evt: string, handler: EventListener, opts?: AddEventListenerOptions) { (DomBehavior.on as any).call(mount(el), evt, handler, opts); return h; },
      off(evt: string, handler?: EventListener) { (DomBehavior.off as any).call(mount(el), evt, handler); return h; },
      trigger(evt: string, detail?: any) { (DomBehavior.trigger as any).call(mount(el), evt, detail); return h; },

      // Traversal (still lazy; mounts only returned elements)
      find(sel: string) {
        const found = el.querySelector(sel) as HTMLElement | null;
        return found ? makeHandle(found) : null;
      },
      children(sel?: string) {
        const kids = Array.from(el.children) as HTMLElement[];
        const filtered = sel ? kids.filter(k => k.matches(sel)) : kids;
        return makeGroup(filtered);
      },
      parent(sel?: string) {
        const p = el.parentElement; if (!p) return null;
        if (sel && !p.matches(sel)) return null;
        return makeHandle(p);
      },
      closest(sel: string) {
        const c = (el.closest as any)(sel) as HTMLElement | null;
        return c ? makeHandle(c) : null;
      },
      next(sel?: string) {
        let n = el.nextElementSibling as HTMLElement | null;
        while (n) { if (!sel || n.matches(sel)) return makeHandle(n); n = n.nextElementSibling as any; }
        return null;
      },
      prev(sel?: string) {
        let p = el.previousElementSibling as HTMLElement | null;
        while (p) { if (!sel || p.matches(sel)) return makeHandle(p); p = p.previousElementSibling as any; }
        return null;
      },

      // Animation methods
      animate(props: Record<string, any>, options?: AnimationOptions) {
        animate(el, props, options);
        return h;
      },
      fadeIn(duration?: number, complete?: () => void) {
        fadeIn(el, duration, complete);
        return h;
      },
      fadeOut(duration?: number, complete?: () => void) {
        fadeOut(el, duration, complete);
        return h;
      },
      slideDown(duration?: number, complete?: () => void) {
        slideDown(el, duration, complete);
        return h;
      },
      slideUp(duration?: number, complete?: () => void) {
        slideUp(el, duration, complete);
        return h;
      },
      show() {
        el.style.display = '';
        return h;
      },
      hide() {
        el.style.display = 'none';
        return h;
      },
      toggle() {
        el.style.display = el.style.display === 'none' ? '' : 'none';
        return h;
      },

      // DOM manipulation
      append(content: string | HTMLElement | Handle) {
        if (typeof content === 'string') {
          el.insertAdjacentHTML('beforeend', content);
        } else if (content instanceof HTMLElement) {
          el.appendChild(content);
        } else if (content && 'raw' in content) {
          el.appendChild(content.raw());
        }
        return h;
      },
      prepend(content: string | HTMLElement | Handle) {
        if (typeof content === 'string') {
          el.insertAdjacentHTML('afterbegin', content);
        } else if (content instanceof HTMLElement) {
          el.prepend(content);
        } else if (content && 'raw' in content) {
          el.prepend(content.raw());
        }
        return h;
      },
      remove() {
        el.remove();
        return h;
      },
      empty() {
        el.innerHTML = '';
        return h;
      },
      clone(deep: boolean = true) {
        const cloned = el.cloneNode(deep) as HTMLElement;
        return makeHandle(cloned);
      },

      // Two-way binding helper
      bind(node: FXN) {
        // Bind value to FX node
        const inputHandler = () => {
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
            const value = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
            node.set(value);
          }
        };
        el.addEventListener('input', inputHandler);
        el.addEventListener('change', inputHandler);

        // Watch FX node for changes
        node.watch(() => {
          const value = node.get();
          if (el instanceof HTMLInputElement) {
            if (el.type === 'checkbox') {
              el.checked = !!value;
            } else {
              el.value = String(value ?? '');
            }
          } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
            el.value = String(value ?? '');
          }
        });

        return h;
      },

      // Escape hatch: get the FX node for this element (forces mount)
      fx(): FXN { return mount(el); },
      // Raw element (no mount)
      raw(): HTMLElement { return el; }
    };
    return h;
  }

  function makeGroup(els: HTMLElement[]) {
    const g = {
      elements: els.map(makeHandle),
      get length() { return g.elements.length; },

      // Fan-out operations (chainable)
      val(v?: Setter) { g.elements.forEach(h => h.val(v as any)); return g; },
      text(v?: Setter<string>) { g.elements.forEach(h => h.text(v as any)); return g; },
      html(v?: Setter<string>) { g.elements.forEach(h => h.html(v as any)); return g; },
      attr(name: any, v?: any) { g.elements.forEach(h => h.attr(name as any, v)); return g; }
      ,
      css(prop: any, v?: any) { g.elements.forEach(h => h.css(prop as any, v)); return g; },
      addClass(...names: string[]) { g.elements.forEach(h => h.addClass(...names)); return g; },
      removeClass(...names: string[]) { g.elements.forEach(h => h.removeClass(...names)); return g; },
      toggleClass(name: string, state?: boolean) { g.elements.forEach(h => h.toggleClass(name, state)); return g; },

      on(evt: string, handler: EventListener, opts?: AddEventListenerOptions) { g.elements.forEach(h => h.on(evt, handler, opts)); return g; },
      off(evt: string, handler?: EventListener) { g.elements.forEach(h => h.off(evt, handler)); return g; },
      trigger(evt: string, detail?: any) { g.elements.forEach(h => h.trigger(evt, detail)); return g; },

      // Traversal returns new groups/handles lazily
      find(sel: string) {
        const found: HTMLElement[] = [];
        g.elements.forEach(h => {
          const f = h.raw().querySelectorAll(sel);
          f && found.push(...Array.from(f) as HTMLElement[]);
        });
        const uniq = Array.from(new Set(found));
        return uniq.length === 1 ? makeHandle(uniq[0]) : makeGroup(uniq);
      },
      children(sel?: string) {
        const acc: HTMLElement[] = [];
        g.elements.forEach(h => {
          const kids = Array.from(h.raw().children) as HTMLElement[];
          const filtered = sel ? kids.filter(k => k.matches(sel)) : kids;
          acc.push(...filtered);
        });
        const uniq = Array.from(new Set(acc));
        return uniq.length === 1 ? makeHandle(uniq[0]) : makeGroup(uniq);
      },
      parent(sel?: string) {
        const acc: HTMLElement[] = [];
        g.elements.forEach(h => {
          const p = h.raw().parentElement;
          if (p && (!sel || p.matches(sel))) acc.push(p);
        });
        const uniq = Array.from(new Set(acc));
        return uniq.length === 1 ? makeHandle(uniq[0]) : makeGroup(uniq);
      },

      // Animation methods
      animate(props: Record<string, any>, options?: AnimationOptions) { g.elements.forEach(h => h.animate(props, options)); return g; },
      fadeIn(duration?: number, complete?: () => void) { g.elements.forEach(h => h.fadeIn(duration, complete)); return g; },
      fadeOut(duration?: number, complete?: () => void) { g.elements.forEach(h => h.fadeOut(duration, complete)); return g; },
      slideDown(duration?: number, complete?: () => void) { g.elements.forEach(h => h.slideDown(duration, complete)); return g; },
      slideUp(duration?: number, complete?: () => void) { g.elements.forEach(h => h.slideUp(duration, complete)); return g; },
      show() { g.elements.forEach(h => h.show()); return g; },
      hide() { g.elements.forEach(h => h.hide()); return g; },
      toggle() { g.elements.forEach(h => h.toggle()); return g; },

      // DOM manipulation
      append(content: string | HTMLElement | Handle) { g.elements.forEach(h => h.append(content)); return g; },
      prepend(content: string | HTMLElement | Handle) { g.elements.forEach(h => h.prepend(content)); return g; },
      remove() { g.elements.forEach(h => h.remove()); return g; },
      empty() { g.elements.forEach(h => h.empty()); return g; },
      clone(deep: boolean = true) {
        const cloned = g.elements.map(h => h.clone(deep));
        return makeGroup(cloned.map(h => h.raw()));
      },

      // Two-way binding
      bind(node: FXN) { g.elements.forEach(h => h.bind(node)); return g; },

      // Convenience
      fxAll(): FXN[] { return g.elements.map(h => h.fx()); },
      rawAll(): HTMLElement[] { return g.elements.map(h => h.raw()); }
    };
    return g;
  }

  // ——————————————————————————————————————————————————————————
  // Global $ (single access point)
  // ——————————————————————————————————————————————————————————
  function $(sel: string | HTMLElement | NodeListOf<HTMLElement> | HTMLElement[]) {
    if (typeof sel === "string") {
      // Fast id shortcut (common case)
      if (sel.startsWith("#") && !sel.includes(" ") && !sel.includes(".")) {
        const el = document.getElementById(sel.slice(1)) as HTMLElement | null;
        if (!el) return null;
        return makeHandle(el);
      }
      const list = document.querySelectorAll<HTMLElement>(sel);
      if (list.length === 0) return null;
      if (list.length === 1) return makeHandle(list[0]);
      return makeGroup(Array.from(list));
    }
    if (sel instanceof HTMLElement) return makeHandle(sel);
    const arr = sel instanceof NodeList ? Array.from(sel) : (sel as HTMLElement[]);
    if (arr.length === 0) return null;
    if (arr.length === 1) return makeHandle(arr[0]);
    return makeGroup(arr);
  }

  (globalThis as any).$ = $;

  return { name: "fx-dom-dollar", version: "1.0.0" };
}
