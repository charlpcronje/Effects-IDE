# FX DREAMWEAVER 3D — MASTER IMPLEMENTATION BLUEPRINT

> **Audience:** Autonomous FX-specialized AI engineering teams, systems architects, shader engineers, UX futurists, and resident MCP-integrated copilots.
>
> **Purpose:** Deliver a line-by-line, subsystem-by-subsystem specification that enables multiple AI agents to build, verify, and launch the FX Dreamweaver 3D IDE without human ambiguity.

---

## 11. Theme Lab, Personalization, and Accessibility

### 11.1 Theme Architecture
1. **Theme Definition Files:** Stored under `themes/*.json`; loaded into `settings.themes` nodes.
2. **Theme Attributes:** Colors, typography, panel textures, animation curves, sound cues.
3. **Theme Application Flow:**
   - User selects theme -> Theme Lab writes to `settings.themes.active`.
   - Watchers update shader uniforms (via `fx-shader-forge`) and DOM variables.
4. **Custom Theme Builder:** Visual interface to tweak colors, gradients, noise parameters, saves as new theme bundle.

### 11.2 Personalization Controls
1. **Layout Presets:** Save/restore panel arrangements via `fx-bundle-vault` snapshots.
2. **Interaction Settings:** Adjust panel inertia, snapping, drag sensitivity. Stored under `settings.interactions`.
3. **Shortcut Profiles:** Configurable keybindings stored under `settings.shortcuts`; AI can modify via MCP.

### 11.3 Accessibility Features
1. **High Contrast Mode:** Overrides theme colors with accessible palette; toggled via `settings.accessibility.contrast`.
2. **Text Scaling:** Global scale factor applied to UI text nodes.
3. **Screen Reader Hooks:** `fx-voice-bridge` exposes node metadata for narration.
4. **Motion Reduction:** Disable certain animations for users sensitive to motion.

---

## 12. Data Persistence, Storage, and Bundling Strategy

### 12.1 Storage Layers
1. **Project Files:** Stored on disk; manipulated through FS APIs.
2. **State Snapshots:** Managed by `fx-bundle-vault`, stored as compressed JSON + assets.
3. **Cache Layer:** `fx-cache` handles hot data (thumbnails, schema, AI context).

### 12.2 Bundle Format
1. **FX Bundle:** Contains plugins, modules, assets, manifests. Built via FXDisk bundler.
2. **Workspace Bundle:** Contains layout, theme, open files, AI sessions for project portability.

### 12.3 Versioning & Migration
1. **Manifest:** Each bundle includes version metadata + migration scripts.
2. **Migration Plugins:** `fx-bundle-vault` runs migrations when loading older bundles; logs conversions.

---

## 13. Observability, Telemetry, and Health Insights

### 13.1 Metrics Pipeline
1. **Collector Plugin:** `fx-analytics-beacon` aggregates metrics from nodes.
2. **Metrics Nodes:** `metrics.*` store counters, histograms, timers.
3. **Dashboards:** WebGL overlays showing FPS, sync latency, AI turnaround.

### 13.2 Logging Strategy
1. Structured logs written to `observability.events`.
2. Export via MCP tool for external analysis.
3. AI agents can subscribe to certain event types for proactive fixes.

### 13.3 Alerts & Health Checks
1. Threshold-based alerts (e.g., FPS < 60) trigger visual cues + notifications.
2. AI agent `fx-health-bot` (new plugin) monitors metrics, proposes fixes.

---

## 14. Security, Identity, and Permissions Matrix

### 14.1 Identity Providers
1. Local user identity managed by workspace config.
2. AI agents identified by provider + key hash.

### 14.2 Permissions Model
| Actor | Capabilities |
| --- | --- |
| Human Owner | Full access |
| Guest User | Read-only, limited editing |
| AI Builder | Scoped to granted tools |

### 14.3 Secrets Handling
1. Use OS keychain/secure storage for DB credentials.
2. `fx-safe` mediates secret access; AI must request tokens explicitly.

### 14.4 Audit Trail
1. All privileged actions logged with actor ID, diff summary.
2. Stored under `security.audit` nodes.

---

## 15. Implementation Playbook & Phase Gates

### 15.1 Phases
1. **Phase 0 – Foundations:** FX integration, plugin loader, minimal scene.
2. **Phase 1 – Spatial Canvas:** 2D/3D panels, drag/drop, basic theme.
3. **Phase 2 – Code & Sync:** Editor integration, AST pipeline, diff timeline.
4. **Phase 3 – AI & Tools:** MCP server, PTY, Git, DB, API studio.
5. **Phase 4 – Marketplace & Extensibility:** Plugin hub, theme lab, sharing.

### 15.2 Gate Criteria
1. Each phase requires demo + metrics meeting success thresholds.
2. Automated test suites must pass at ≥95% coverage for critical modules.

### 15.3 Coordination Mechanism
1. Weekly sync between pods (Visual, Code, AI, Ops, Marketplace).
2. AI agents assigned as maintainers per subsystem.

---

## Document Control & Traceability

| Field | Value |
| --- | --- |
| Document ID | FX-DW3D-BLUEPRINT-001 |
| Version | 0.1.0 (living document to be extended beyond 2500 lines) |
| Owners | FX Architecture Guild + Resident AI Council |
| Source Repos | `fx/fx.ts`, `fx/fx-disk`, `fx/plugins`, Electron shell |
| Toolchain | Node 22+, Deno latest, Electron 32+, WebGL2/WebGPU, MCP stack |
| Review Cadence | Weekly asynchronous AI quorum, human sign-off optional |

### Change Ledger
| Line Range | Description | Authoring Agent | Timestamp |
| --- | --- | --- | --- |
| 1-60 | Document control, mission framing, baseline ToC | Cascade | 2025-11-27 |
| 61-?? | (To be auto-populated as additional sections are appended) | TBD | TBD |

---

## Table of Contents (Living Index)

1. Executive Charter and Mission Objectives
2. Experience Tenets and Success Metrics
3. Multilayer Architecture Overview
4. Spatial User Experience Doctrine
5. Codeflow Synchronization Doctrine
6. Node Graph & Data Fabric Specification
7. AI + MCP Federation Protocols
8. Plugin Strategy, Inventory, and Roadmap
9. Developer Tool Constellation (PTY, Git, DB, Router, API)
10. Shader + WebGL/WebGPU Rendering System
11. Theme Lab, Personalization, and Accessibility
12. Data Persistence, Storage, and Bundling Strategy
13. Observability, Telemetry, and Health Insights
14. Security, Identity, and Permissions Matrix
15. Implementation Playbook & Phase Gates
16. Automated Testing & Verification Harnesses
17. Risk Registry, Mitigations, and Fallback Paths
18. Appendix A: Plugin-to-Requirement Trace Matrix
19. Appendix B: Data Schemas & Node Contracts
20. Appendix C: AI Agent Operating Manual & Tool Tokens

> **Instruction:** Every section will cite the FX plugin(s) that implement it or call out new plugins to author. Any gap MUST include a stub spec for a new plugin module so the AI marketplace team can implement it.

---

## 1. Executive Charter and Mission Objectives

1. **Primary Goal:** Ship an Electron-based FX studio where visual layout, live code, node graphs, AI agents, and workflow orchestration live inside a single WebGL-powered universe.
2. **Non-Negotiable Outcomes:**
   - Visual + code parity within 50 ms, measured via watchers attached to `workspace.sync.latency` nodes.
   - Resident AI agent maintains full view of node graph, layout metadata, and file system through MCP endpoints with deterministic permission scopes.
   - Drag-and-drop operations never orphan DOM nodes; every change is mirrored to FX graph and code view.
3. **Key Enablers:**
   - FX Core runtime (`fx.ts`) with plugin patching via `patchFXWithPluginLoader`.
   - FXDiskSyncLoader for zero-latency plugin modules.
   - Plugin ecosystem spanning DOM manipulation, caching, ORM, router introspection, shader control, etc.
4. **Stakeholders:**
   - Spatial UX Pod: prototypes 3D interactions.
   - Code Intelligence Pod: ensures AST ↔ node graph fidelity.
   - AI Federation Pod: manages MCP contracts, tool tokens, anthropic/OpenAI toggles.
   - Platform Reliability Pod: observability, telemetry, incident response.

### 1.1 Mission Threads
1. **Thread A – Visual Dreamcraft:** Build the canvas, panel morphing, shader lab, layout solver.
2. **Thread B – Codeflow Continuum:** Build editors, diff timeline, code generation, lint + compile loops.
3. **Thread C – AI Symbiosis:** Build MCP server, AI chat, action queue, guardrails, analytics for AI suggestions.
4. **Thread D – Ops & Tooling:** Build PTY, Git workflows, DB browser, API studio, release automation.
5. **Thread E – Marketplace & Extensibility:** Build plugin marketplace, schema for contributions, licensing hooks.

Each thread is mapped to sprints and to FX plugins or new modules enumerated later.

---

## 2. Experience Tenets and Success Metrics

### 2.1 Tenets
1. **Dual-Modality Truth:** Whatever the user (or agent) does visually must instantly reflect in code, and vice versa. Achieved by linking `ui.panels.*` nodes with `workspace.files.*` nodes using watchers + `fx-dom-dollar` for DOM injection and `fx-jsx` for source transformations.
2. **Spatial Literacy:** Panels behave like tangible artifacts. Users can lift a panel into 3D, rotate it, inspect metadata etched onto faces. WebGL scene graph + FX nodes maintain canonical transforms.
3. **AI-native Collaboration:** The interface assumes AI agents co-create. Chat, suggestions, and automated edits are first-class.
4. **Modular Sovereignty:** Everything is built as a plugin or bundle. If a feature is missing, document which plugin to write.
5. **Observability Everywhere:** Every interaction emits telemetry to `observability.events`. Agents rely on this feed for closed-loop control.

### 2.2 Success Metrics
| Metric | Target | Measurement Node | Notes |
| --- | --- | --- | --- |
| Visual↔Code Sync Latency | ≤ 50 ms P95 | `metrics.sync.latency` | Backed by `fx-time-travel` snapshots for validation |
| AI Turnaround Time | ≤ 5 s per complex request | `metrics.ai.turnaround` | Measured from MCP request to UI update |
| Panel Recomposition FPS | 120fps target, 90fps floor | `metrics.scene.fps` | Driven by WebGL profiling; degrade gracefully |
| Plugin Load Latency | < 5 ms from command to mount | `metrics.plugins.loadTime` | Use FXDiskSyncLoader + caching |
| Database Query Surfacing | < 200 ms to render result grid | `metrics.db.renderTime` | Backed by `fx-orm` wrappers |

### 2.3 Validation Gates
1. **Gate 1:** Canvas + Code view parity demo with instrumentation.
2. **Gate 2:** AI agent edits files, runs PTY command, updates layout, all logged.
3. **Gate 3:** WebGL panels animated into cubes with real shader adjustments from Theme Lab.
4. **Gate 4:** Plugin marketplace installs a third-party component pack and exposes it to canvas.
5. **Gate 5:** MySQL + SQLite browsers show live schema, run queries, export results.

---

## 3. Multilayer Architecture Overview

### 3.1 Stack Diagram
```
┌─────────────────────────────────────────────────────────────┐
│ Electron Host (Chromium + Node + OS bridges)                │
├──────────────┬──────────────────────────┬───────────────────┤
│ WebGL Scene  │ Workflow & Data Fabric   │ AI + MCP Stack    │
│ (FX panels)  │ (FX nodes + storage)     │ (Agents, tools)   │
├──────────────┴──────────────────────────┴───────────────────┤
│ FX Core Runtime (fx.ts) + Plugin Loader + Disk Bundles      │
├─────────────────────────────────────────────────────────────┤
│ OS/Cloud Services (PTY, Git, DB drivers, secrets, auth)     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Layer Responsibilities
1. **Presentation Layer:** WebGL renderer + DOM overlays. Uses `fx-dom-dollar` for DOM bridges, custom shader manager plugin for GPU resources (new plugin: `fx-shader-forge`).
2. **Application Layer:** Node graph orchestrator, layout solver, undo/redo engine. Powered by core FX behaviors plus `fx-flow` for worker delegation.
3. **Integration Layer:** PTY interface, DB connectors, Git automation, HTTP clients. Leveraging `fx-api`, `fx-orm`, new plugin `fx-git-ops`, and service wrappers.
4. **AI Layer:** MCP server, AI session manager, conversation store, tool permission system. Requires new `fx-mcp-bridge` plugin to expose node graph.
5. **Data Layer:** FX Disk (VFS), workspace storage, theme assets, plugin bundles. Uses FXDiskSyncLoader, `fx-cache`, custom storage plugin `fx-bundle-vault` (new) for project snapshots.

### 3.3 Flow of Control
1. **User Action → Node Graph:** Dragging a panel triggers WebGL events -> `ui.panels.{id}` node updated -> watchers propagate to code.
2. **Node Graph → Code:** `fx-jsx` plugin rewrites JSX/HTML -> file buffer updates -> Code editor displays diff.
3. **AI Action → Tools:** AI agent requests action via MCP -> `fx-mcp-bridge` validates -> triggers PTY/FS/DOM operations.
4. **Telemetry Loop:** Every critical action writes to `observability.events`. `fx-visualizer` plugin consumes for 3D graphs; AI uses for reasoning.

---

## 4. Spatial User Experience Doctrine

### 4.1 Panel Taxonomy
1. **Canvas Cubes:** Represent layout surfaces, show DOM tree on side faces.
2. **Inspector Prisms:** Multi-face panels showing styles, bindings, watchers.
3. **Data Vault Orbs:** Spherical overlays for DB connections; rotate to switch schemas.
4. **AI Constellation Nodes:** Floating chat orbs that can dock to surfaces; color-coded per model provider.
5. **Terminal Tunnels:** Cylindrical panels representing PTY sessions; scrolling text wraps along curvature.

### 4.2 Interaction Grammar
1. **Grab & Lift:** User grips corner -> panel extrudes out of plane -> Z-depth indicates priority. Implementation uses WebGL picking + FX node `ui.panels.{id}.transform.z`.
2. **Slice & Reveal:** Swipe gesture slices panel, revealing nested layers (DOM tree, CSS). Requires shader-based clipping + overlay nodes.
3. **Snap & Merge:** Dragging two panels near each other triggers magnet behavior -> merges into multi-pane cube. Layout solver uses `fx-flow` worker to recompute constraints.
4. **AI Suggest Docking:** AI agent can spawn suggestion cards that magnetically dock to relevant panel edges.

### 4.3 Accessibility Considerations
1. Provide keyboard + voice commands for every action. Voice commands routed through new `fx-voice-bridge` plugin.
2. Maintain high-contrast themes and text-to-speech descriptions when panel lifts.
3. Provide haptic-equivalent cues (visual pulses) for notifications.

---

## 5. Codeflow Synchronization Doctrine

1. **Canonical Data Flow:**
   - Visual edit -> Node graph -> AST -> File buffer -> On-disk file.
   - Code edit -> Parser -> Node graph -> Visual scene update.
2. **Engines Involved:**
   - `fx-dom-dollar` for DOM node updates.
   - `fx-jsx` for AST parsing & serialization.
   - `fx-time-travel` for snapshotting.
   - New plugin `fx-codegen-vault` to manage scaffolds and templates.
3. **Conflict Resolution:**
   - When simultaneous edits occur, use CRDT-inspired merge stored under `workspace.conflicts` nodes.
   - AI agents resolve conflicts by applying prioritized diffs logged to `workspace.audit`.
4. **Testing Hooks:**
   - Every save triggers lint + type check pipeline (ESLint, tsc) orchestrated by `fx-flow` tasks.

---

*(Subsequent sections continue below and will be appended in later edits to surpass 2500 lines while preserving this structure.)*

---

## 6. Node Graph & Data Fabric Specification

### 6.1 Canonical Node Paths
| Node Path | Purpose | Plugin(s) | Notes |
| --- | --- | --- | --- |
| `ui.panels.*` | Stores panel metadata (position, rotation, type, docking) | Core + `fx-dom-dollar` | Each panel node contains `transform`, `style`, `bindings` children |
| `workspace.files.*` | File buffers with metadata (language, status, lastEdit) | `fx-cache` for snapshots | Each buffer has `content`, `ast`, `dirty`, `agentLocks` |
| `workspace.ast.*` | Parsed AST fragments for JSX/TS/HTML | `fx-jsx`, new `fx-ast-lens` plugin | Enables incremental rebuilds |
| `observability.events` | Stream of structured telemetry objects | `fx-visualizer`, `fx-devtools` | Append-only log, capped via retention policy |
| `settings.*` | Themes, AI models, permissions | `fx-safe`, Theme Lab plugin | Write-protected by permissions matrix |
| `ai.sessions.*` | Conversation logs, tool calls, results | `fx-mcp-bridge`, `fx-cache` | Each session has `timeline`, `actions`, `summaries` |
| `db.connections.*` | Connection configs, credentials, schema caches | `fx-orm`, `fx-safe` | Secrets encrypted, not persisted in plain text |

### 6.2 Data Types & Schemas
1. **Panel Node Schema:**
   ```json
   {
     "id": "panel-uuid",
     "type": "canvas" | "inspector" | "terminal" | ...,
     "transform": { "x": 0, "y": 0, "z": 0, "rx": 0, "ry": 0, "rz": 0 },
     "bounds": { "width": 640, "height": 480 },
     "docking": { "group": "main", "slot": 1 },
     "state": { "selected": false, "locked": false },
     "bindings": { "filePath": "src/App.tsx", "nodePath": "dom.root" }
   }
   ```
2. **File Buffer Schema:**
   ```json
   {
     "path": "src/App.tsx",
     "language": "typescript",
     "content": "string",
     "astNode": "workspace.ast.app",
     "dirty": true,
     "lastEdit": 1732700000000,
     "agentLocks": [{ "agent": "Claude-Dev", "expires": 1732700060000 }]
   }
   ```
3. **Observability Event Schema:**
   ```json
   {
     "timestamp": 1732700012345,
     "actor": "user" | "ai:openai" | "system",
     "action": "panel.move",
     "payload": { "panelId": "panel-1", "delta": { "x": 12, "y": -5 } },
     "traceId": "fx-...",
     "severity": "info"
   }
   ```

### 6.3 Persistence Strategy
1. **Transient Data:** Node graph states kept in memory, checkpointed via `fx-time-travel` snapshots.
2. **Durable Data:** Project files stored on disk; theme presets and workspace layouts stored via `fx-bundle-vault` plugin using JSON bundles.
3. **Sync & Backup:** Auto-save to `.fxdw/state.json` every 60 seconds; optional cloud sync by exporting FX bundle.

### 6.4 Watcher Network
1. **Panel Watchers:** On `ui.panels.*` change, update WebGL transforms, code bindings, telemetry.
2. **File Watchers:** On `workspace.files.*.content` change, trigger AST rebuild, layout update, plugin hooks.
3. **AI Session Watchers:** Notify UI when AI posts message, highlight affected panels.

---

## 7. AI + MCP Federation Protocols

### 7.1 MCP Server Topology
1. **Core Tools:**
   - `fs.read`, `fs.write`, `fs.diff`
   - `fx.node.inspect`, `fx.node.update`
   - `scene.capture` (exports WebGL layout snapshot)
   - `pty.exec`
   - `db.query`
2. **Provider Integration:**
   - OpenAI GPT-4.1 Turbo, GPT-4.1 Omni
   - Anthropic Claude 3.5 Sonnet, Claude 3.5 Haiku
   - Future providers stubbed via `fx-mcp-provider-registry` (new plugin)

### 7.2 Session Lifecycle
1. **Initiation:** User opens AI chat cube -> selects model -> `ai.sessions.{id}` node created.
2. **Context Gathering:** MCP server compiles toolkit: node graph snapshot, open files, telemetry.
3. **Action Execution:** AI triggers tool -> `fx-mcp-bridge` validates scope -> executes underlying plugin (e.g., `fx-orm` for DB query).
4. **Logging:** Every action appended to `ai.sessions.{id}.timeline` with diff previews.
5. **Review & Undo:** User or supervisor agent can roll back actions using `fx-time-travel` snapshots linked to action IDs.

### 7.3 Permission Model
| Role | Tools | Notes |
| --- | --- | --- |
| `ai.observer` | read-only tools | Can inspect nodes, files, telemetry |
| `ai.builder` | read/write FS, node updates, PTY | Default for resident AI |
| `ai.dbAdmin` | DB queries + schema changes | Requires explicit grant |
| `ai.marketplace` | Plugin install/uninstall | Limited to signed bundles |

### 7.4 Guardrails
1. **Dry Run Mode:** AI proposes diff; user approves before apply.
2. **Resource Budgeting:** Each session has token budget tracked in `ai.sessions.{id}.budget`.
3. **Safety Checks:** `fx-safe` plugin ensures FS writes stay inside workspace; DB queries run inside transaction wrappers by default.

---

## 8. Plugin Strategy, Inventory, and Roadmap

### 8.1 Existing Plugins & Roles
| Plugin | Role in IDE | Notes |
| --- | --- | --- |
| `fx-dom-dollar` | DOM/visual binding | Core for layout editing |
| `fx-cache` | Caching/snapshots | Stores thumbnails, AI context |
| `fx-api` | HTTP client | API studio + AI webhooks |
| `fx-orm` | DB browser | Primary DB engine |
| `fx-router` | Route visualization | Canvas displays page graph |
| `fx-jsx` | JSX parsing | Code→visual sync |
| `fx-react` | React bridge | Allows embedding React views |
| `fx-devtools` | Quake console | Automation hooks |
| `fx-visualizer` | Graph inspector | Node graph view |
| `fx-flow` | Worker orchestration | Layout solver, lint tasks |

### 8.2 New Plugins to Author
1. **`fx-shader-forge`** – Manages shader programs, materials, theme integration.
2. **`fx-mcp-bridge`** – Exposes FX nodes + files over MCP; enforces permissions.
3. **`fx-git-ops`** – Git command abstraction, history view, branch management.
4. **`fx-bundle-vault`** – Handles workspace snapshots, exports, imports.
5. **`fx-ast-lens`** – Provides AST indexing, diffing, and queries for code intelligence.
6. **`fx-codegen-vault`** – Template + scaffold generator used by AI.
7. **`fx-voice-bridge`** – Voice command ingestion and mapping to FX actions.
8. **`fx-marketplace-hub`** – Plugin marketplace UI + installer backend.
9. **`fx-analytics-beacon`** – Observability aggregator for metrics/alerts.

Each new plugin requires:
1. TypeScript source in `fx/plugins` with metadata header.
2. Unit tests under `fx/plugins/tests`.
3. Documentation stub in `fx/plugins/docs`.

### 8.3 Plugin Lifecycle
1. **Development:** Authored in repo, tested via `fx/tests` harness.
2. **Bundling:** Added to `bundle.config.json` and packaged via FXDisk bundler.
3. **Distribution:** Marketplace surfaces signed bundles; AI agents can install when permitted.
4. **Hot Reload:** `fx-flow` monitors plugin directory; triggers reload using `loader.unload` + `$$("@plugin").options()`.

---

## 9. Developer Tool Constellation

### 9.1 PTY Terminal System
1. **Implementation:** Node-pty spawned in Electron main; events bridged via `fx-git-ops` plugin to FX nodes.
2. **UI Representation:** Terminal Tunnel panel with curved text. FX node `tools.pty.sessions.{id}` stores history.
3. **AI Integration:** MCP tool `pty.exec` allows AI to run commands; outputs logged under session node with references to snapshot.

### 9.2 Git Workflow
1. **Features:** Branch switcher, commit composer, diff visualizer, history timeline.
2. **Data Nodes:** `tools.git.status`, `tools.git.branches`, `tools.git.history`.
3. **Plugin:** `fx-git-ops` handles command batching, credential prompts, signing.

### 9.3 Database Browser
1. **Supported Engines:** SQLite (local), MySQL (remote). Future: Postgres plugin.
2. **UI:** Data Vault Orbs representing connections; table list on faces; query results as floating grids.
3. **Workflows:** Connect -> introspect schema -> run queries -> save results -> AI suggestions.
4. **Plugins:** `fx-orm`, `fx-cache` for schema caching, `fx-safe` for credentials.

### 9.4 API Studio
1. **Purpose:** Test HTTP endpoints, websockets, GraphQL, and serverless functions.
2. **Implementation:** Uses `fx-api` plugin; requests defined in `tools.api.requests` nodes.
3. **Features:**
   - Request builder with auth, headers, body.
   - Response visualizer (JSON tree, chart, raw).
   - AI diffing vs previous responses.

### 9.5 Router & Flow Inspector
1. **Router View:** 3D graph of app routes using `fx-router` data; edges highlight middleware.
2. **Flow Engine:** `fx-flow` tasks visualized as pipelines; agent can rerun tasks or inspect logs.

---

## 10. Shader + WebGL/WebGPU Rendering System

### 10.1 Rendering Pipeline
1. **Renderer Choice:** Start with WebGL2 for compatibility, abstract for future WebGPU.
2. **Scene Graph:** Mirrors FX nodes; each panel instantiates mesh object with material referencing theme.
3. **Render Loop:**
   - Gather dirty panels from `ui.panels.*` watchers.
   - Update GPU buffers.
   - Render passes: base geometry, outline/highlight, post-processing (bloom, SSAO).

### 10.2 Shader Management (`fx-shader-forge`)
1. **Responsibilities:**
   - Compile/link shaders; cache per material.
   - Expose shader parameter nodes under `ui.shaders.*`.
   - Provide editor UI for custom shader authoring.
2. **Features:**
   - Theme-driven uniforms (primary/secondary colors, accent pulses).
   - Procedural textures for holographic effects.
   - Depth-based outlines for selected panels.

### 10.3 Performance Considerations
1. **Frustum Culling:** Skip rendering off-screen panels.
2. **Level of Detail:** Panels far away reduce detail; text replaced with icons.
3. **GPU Budget:** Keep under ~8M tris/frame; dynamic scaling.

### 10.4 WebGPU Migration Plan
1. Abstract renderer interface now.
2. Implement WebGPU backend once stable; reuse `fx-shader-forge` for pipeline definitions.

---
