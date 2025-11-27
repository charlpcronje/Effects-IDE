/**
 * fx-reality-engine.ts — TypeScript port + selective enhancements
 * - Reality bubbles
 * - Quantum superpositions with collapse()
 * - Dream state + thoughts
 */
import type { FX, FXPlugin } from "./fx-types";

type RealityLaws = {
  causality?: boolean;
  time?: "linear" | "circular" | "branching" | "quantum";
  logic?: "boolean" | "fuzzy" | "quantum" | "emotional";
  gravity?: number;
  entropy?: number;
  coherence?: number;
};

type Superposition = {
  id: string; path: string;
  probabilities: Map<string, number>;
  collapsed?: boolean;
  collapsedValue?: string;
  entangled: Set<string>;
};

export class FXRealityEngine implements FXPlugin {
  public name = "reality";
  public version = "1.1.0";
  public description = "Reality bubbles + quantum API";
  private fx: FX;

  private currentReality = "baseline";
  private realities = new Map<string, { name: string; laws: RealityLaws }>();
  private quantum = new Map<string, Superposition>();
  private thoughts: string[] = [];

  constructor(fx: FX, opts: Partial<{ enableDreams: boolean; dreamEveryMs: number }> = {}) {
    this.fx = fx;
    this.createReality("baseline", {});
    if (opts.enableDreams) setInterval(() => this._dream(), opts.dreamEveryMs || 30000);
  }

  install = (fx: FX) => void 0;

  createReality(name: string, laws: RealityLaws) {
    this.realities.set(name, { name, laws: { causality: true, time: "linear", logic: "boolean", gravity: 1, entropy: 0.1, coherence: 1, ...laws } });
    if (typeof globalThis.$$ === "function") globalThis.$$("reality.bubbles." + name).val(this.realities.get(name));
  }

  enterReality(name: string) {
    if (!this.realities.has(name)) throw new Error(`Reality not found: ${name}`);
    const prev = this.currentReality;
    this.currentReality = name;
    if (typeof globalThis.$$ === "function") {
      globalThis.$$("reality.current").val(name);
      globalThis.$$("reality.previous").val(prev);
    }
    this._think(`Entered reality: ${name}`);
    return { exit: () => this.enterReality(prev) };
  }

  quantumState(path: string, states: Record<string, number>) {
    const id = `quantum_${path.replace(/\./g, "_")}`;
    const probs = new Map<string, number>();
    let total = 0;
    for (const [k, p] of Object.entries(states)) { probs.set(k, p); total += p; }
    if (total !== 1) for (const k of probs.keys()) probs.set(k, (probs.get(k)! / total));
    const s: Superposition = { id, path, probabilities: probs, entangled: new Set() };
    this.quantum.set(id, s);
    if (typeof globalThis.$$ === "function") globalThis.$$("reality.quantum." + id).val(s);

    const observe = () => {
      if (s.collapsed) return s.collapsedValue;
      const r = Math.random();
      let acc = 0;
      for (const [state, p] of s.probabilities) {
        acc += p;
        if (r <= acc) { s.collapsed = true; s.collapsedValue = state; this.fx.setPath(path, state, this.fx.root); break; }
      }
      this._think(`Quantum collapse at ${path} => ${s.collapsedValue}`);
      return s.collapsedValue;
    };

    return new Proxy({}, {
      get: (_t, prop) => {
        if (prop === "observe") return observe;
        if (prop === "collapse") return (state: string) => { s.collapsed = true; s.collapsedValue = state; this.fx.setPath(path, state, this.fx.root); };
        if (prop === "probability") return (state: string) => s.probabilities.get(state) || 0;
        return observe();
      }
    });
  }

  private _dream() {
    this._think("I am dreaming. Logic turns poetic.");
    // create whimsical connections
    const t = Date.now().toString(36);
    this.fx.setPath(`reality.dream.${t}`, { mood: "curious" }, this.fx.root);
  }

  private _think(msg: string) {
    this.thoughts.push(`[${new Date().toISOString()}] ${msg}`);
    if (this.thoughts.length > 200) this.thoughts.shift();
    this.fx.setPath("reality.consciousness.thoughts", this.thoughts.slice(), this.fx.root);
  }
}

export default FXRealityEngine;
