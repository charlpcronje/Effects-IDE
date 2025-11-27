# FX Project Generator - Design Document

**Version:** 1.0.0
**Date:** 2025-01-26
**Status:** Design Phase
**Project Code:** FX-GEN

---

## 📋 Executive Summary

**Project Name:** FX Project Generator (`fx.exe`)

**Purpose:** A single-executable Deno application that generates fully-configured, tested FX projects through an interactive CLI wizard.

**Deliverable:** One executable file (`fx.exe`) that runs on Windows, macOS, and Linux, generating production-ready FX applications with zero configuration required.

**User Experience:**
```bash
$ fx.exe
? Project name: my-awesome-app
? Type: App
? Loader: WASM VFS
? Template: Full FX Wiki
? Select plugins: [x] DOM, [x] Cache, [ ] ORM
✓ Project created: ./my-awesome-app
✓ 100% tested and working
$ cd my-awesome-app && npm start
```

---

## 🎯 Goals & Objectives

### Primary Goals

1. **Zero Configuration** - User gets working project immediately
2. **100% Tested** - Every generated project must pass full test suite
3. **Production Ready** - Generated code follows best practices
4. **Single Binary** - One executable, no dependencies
5. **Cross-Platform** - Works on Windows, macOS, Linux

### Success Metrics

- ✅ Project generation time: <30 seconds
- ✅ Generated project passes all tests: 100%
- ✅ User can run project immediately: Yes
- ✅ No manual configuration needed: None
- ✅ File size of fx.exe: <50MB

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    fx.exe (Deno Compiled)                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ CLI Wizard │→ │ Generator    │→ │ Validator/     │ │
│  │ (Prompts)  │  │ Engine       │  │ Tester         │ │
│  └────────────┘  └──────────────┘  └────────────────┘ │
│         ↓               ↓                    ↓          │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ User Input │  │ Template     │  │ Test Suite     │ │
│  │ Collector  │  │ Renderer     │  │ Runner         │ │
│  └────────────┘  └──────────────┘  └────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │        Embedded Resources (Base64/Bundled)        │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ • FX Core Files (fx.ts, fx.v4.ts)                 │  │
│  │ • FX-Disk System (VFS, Loaders, Bundler)          │  │
│  │ • Plugin Sources (fx-dom-dollar, fx-cache, etc.)  │  │
│  │ • Templates (Counter, CRUD, Flow, Wiki)           │  │
│  │ • Test Suites (Unit, Integration, E2E)            │  │
│  │ • Build Configs (package.json, tsconfig.json)     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          ↓
              ┌───────────────────────┐
              │  Generated Project    │
              ├───────────────────────┤
              │  • FX Core            │
              │  • Selected Plugins   │
              │  • Template Code      │
              │  • Tests              │
              │  • Build Config       │
              │  • Documentation      │
              └───────────────────────┘
```

### Component Breakdown

#### 1. CLI Wizard (`src/cli/wizard.ts`)
- Interactive prompts for user input
- Validation of user choices
- Progress indicators
- Error handling

#### 2. Generator Engine (`src/generator/engine.ts`)
- Orchestrates project creation
- Manages file generation
- Handles dependencies
- Coordinates testing

#### 3. Template Renderer (`src/generator/templates.ts`)
- Renders template files
- Variable substitution
- Code generation
- File structure creation

#### 4. Validator/Tester (`src/validator/tester.ts`)
- Runs generated project tests
- Validates configuration
- Checks for errors
- Reports results

#### 5. Resource Manager (`src/resources/manager.ts`)
- Manages embedded resources
- Extracts bundled files
- Handles compression
- Version management

---

## 📊 Data Flow

```
User runs fx.exe
    ↓
Display Welcome Screen
    ↓
Collect User Input (Wizard)
    ├─ Project Name
    ├─ Type (App/Plugin)
    ├─ Loader Type (WASM/Suspend)
    ├─ Template Selection
    └─ Plugin Selection
    ↓
Validate Input
    ↓
Generate Project Structure
    ├─ Create directories
    ├─ Extract core FX files
    ├─ Copy selected plugins
    ├─ Render template
    └─ Generate config files
    ↓
Install Dependencies
    ├─ Generate package.json
    ├─ Setup build scripts
    └─ Configure TypeScript
    ↓
Build Bundle (if WASM VFS selected)
    ├─ Bundle plugins
    ├─ Compress files
    └─ Create VFS bundle
    ↓
Run Test Suite
    ├─ Unit tests
    ├─ Integration tests
    └─ E2E tests
    ↓
Validate 100% Pass Rate
    ↓
Generate Documentation
    ├─ README.md
    ├─ GETTING_STARTED.md
    └─ API_DOCS.md
    ↓
Success Report
    └─ Display next steps
```

---

## 🎨 User Interface Design

### Welcome Screen

```
╔════════════════════════════════════════════════════════╗
║                                                        ║
║              🚀 FX Project Generator v1.0              ║
║                                                        ║
║     Create production-ready FX applications           ║
║     with zero configuration                           ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

Press Enter to begin...
```

### Step 1: Project Name

```
📁 Project Name
─────────────────────────────────────────────────────────
? What is your project name?
  (use lowercase with hyphens)

  › my-awesome-app

  Example: todo-app, wiki-system, admin-panel
```

### Step 2: Project Type

```
📦 Project Type
─────────────────────────────────────────────────────────
? What type of project?

  ❯ App       - Full application with UI
    Plugin    - Reusable FX plugin

  [↑↓ to move, Enter to select]
```

### Step 3: Loader Selection

```
⚡ Module Loader
─────────────────────────────────────────────────────────
? Which loader do you want to use?

  ❯ WASM VFS         - Instant loading (<1ms) [Recommended]
    Suspend Loader   - Standard async loading

  WASM VFS bundles all code for instant loading.
  Best for production apps.

  [↑↓ to move, Enter to select]
```

### Step 4: Template Selection

```
📋 Starter Template
─────────────────────────────────────────────────────────
? Select a template to start with:

  ❯ Basic Counter      - Simple counter app (great for learning)
    Basic CRUD         - Todo/task manager with CRUD operations
    Flow Cross Realm   - Multi-worker flow processing
    Full FX Wiki       - Notion-style wiki with pages & components

  Templates include complete working code and tests.

  [↑↓ to move, Enter to select, i for info]
```

#### Template Info (when 'i' pressed)

```
┌─────────────────────────────────────────────────────────┐
│ 📋 Basic Counter Template                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ A simple counter application perfect for learning FX.   │
│                                                          │
│ Features:                                                │
│  • State management with FX                              │
│  • Reactive UI updates                                   │
│  • Event handling                                        │
│  • Basic styling                                         │
│                                                          │
│ Included:                                                │
│  • Counter component                                     │
│  • Test suite (10 tests)                                 │
│  • Documentation                                         │
│  • Development server                                    │
│                                                          │
│ Ideal for: Beginners, Learning FX basics                │
│ Complexity: ⭐ (1/5)                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘

Press Enter to select, Esc to go back
```

### Step 5: Plugin Selection

```
🔌 Plugins
─────────────────────────────────────────────────────────
? Select plugins to include:
  (Space to select, Enter to confirm)

  [x] fx-dom-dollar    - DOM manipulation ($dom)
  [x] fx-cache         - Caching system ($cache)
  [ ] fx-orm           - Database ORM ($db)
  [ ] fx-router        - Client-side routing ($router)
  [ ] fx-api           - API client ($api)
  [ ] fx-markdown      - Markdown rendering
  [ ] fx-flow          - Cross-realm workflows
  [ ] fx-serialize     - State serialization

  Selected: 2 plugins
  [↑↓ to move, Space to select, Enter to confirm]
```

### Generation Progress

```
🚀 Generating Project: my-awesome-app
─────────────────────────────────────────────────────────

[████████████████████████████████████] 100%

✓ Created project structure          (50ms)
✓ Extracted FX core files            (120ms)
✓ Installed plugins (2)              (80ms)
✓ Rendered template: Basic Counter   (150ms)
✓ Generated configuration files      (40ms)
✓ Built WASM VFS bundle              (340ms)
✓ Running test suite...

  Unit Tests:        10/10 passed ✓
  Integration Tests:  5/5 passed  ✓
  E2E Tests:          3/3 passed  ✓

✓ All tests passed (100%)            (890ms)
✓ Generated documentation            (60ms)

─────────────────────────────────────────────────────────
Total time: 1.73s
```

### Success Screen

```
╔════════════════════════════════════════════════════════╗
║                                                        ║
║              ✨ Project Created Successfully!          ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

📁 Location: ./my-awesome-app
📦 Template: Basic Counter
🔌 Plugins:  fx-dom-dollar, fx-cache
✅ Tests:    18/18 passed (100%)

Next steps:

  1. Navigate to project:
     $ cd my-awesome-app

  2. Install dependencies:
     $ npm install

  3. Start development server:
     $ npm run dev

  4. Build for production:
     $ npm run build

Documentation: ./my-awesome-app/README.md

Happy coding! 🚀
```

---

## 📁 Project Structure

### Generated Project Layout

```
my-awesome-app/
├── README.md                          # Project documentation
├── GETTING_STARTED.md                 # Quick start guide
├── package.json                       # Dependencies & scripts
├── tsconfig.json                      # TypeScript config
├── .gitignore                         # Git ignore rules
├── bundle.config.json                 # VFS bundle config
│
├── src/
│   ├── main.ts                        # Entry point
│   ├── app.ts                         # Main app file
│   ├── index.html                     # HTML template
│   │
│   ├── fx/                            # FX framework
│   │   └── FX TypeScript/
│   │       ├── fx.ts                  # FX core
│   │       ├── fx.v4.ts               # FX exports
│   │       ├── fx-disk/               # VFS system
│   │       └── plugins/               # Selected plugins
│   │
│   ├── components/                    # App components
│   │   └── [template-specific]       # Template components
│   │
│   ├── styles/                        # Stylesheets
│   │   ├── main.css
│   │   └── [template-specific]
│   │
│   └── lib/                           # Utilities
│       └── utils.ts
│
├── dist/                              # Build output
│   ├── fx-bundle.bin                  # VFS bundle
│   └── [built files]
│
├── tests/                             # Test suite
│   ├── unit/
│   │   └── [template].test.ts
│   ├── integration/
│   │   └── [template].test.ts
│   └── e2e/
│       └── [template].test.ts
│
└── docs/                              # Additional docs
    ├── API.md
    └── ARCHITECTURE.md
```

---

## 🎭 Templates Specification

### 1. Basic Counter Template

**Description:** Simple counter app for learning FX fundamentals

**Features:**
- Increment/decrement buttons
- Display counter value
- Reset functionality
- Keyboard shortcuts

**Code Structure:**
```typescript
// src/app.ts
import { FXCore } from './fx/FX TypeScript/fx.ts';
import { FXDiskSyncLoader, patchFXWithPluginLoader } from './fx/FX TypeScript/fx-disk/index.js';

const fx = new FXCore();
fx.moduleLoader = new FXDiskSyncLoader({ bundleUrl: '/dist/fx-bundle.bin' });
patchFXWithPluginLoader(fx);

const $$ = fx.proxy();

// Counter state
$$("app.counter").val(0);

// DOM plugin
$$("@./fx/FX TypeScript/plugins/fx-dom-dollar.ts").options({ global: "$dom" });

// Increment
function increment() {
    const current = $$("app.counter").val();
    $$("app.counter").val(current + 1);
}

// UI update
$$("app.counter").watch((newVal) => {
    $dom("#counter-value").text(String(newVal));
});
```

**Tests:** 10 unit tests, 3 integration tests, 2 E2E tests

**Complexity:** ⭐ (1/5)

---

### 2. Basic CRUD Template

**Description:** Todo/task manager with full CRUD operations

**Features:**
- Create tasks
- Read/list tasks
- Update task status
- Delete tasks
- Filter by status
- Persist to localStorage

**Code Structure:**
```typescript
// Task model
interface Task {
    id: string;
    title: string;
    completed: boolean;
    createdAt: number;
}

// CRUD operations
const TaskManager = {
    create(title: string) {
        const task: Task = {
            id: crypto.randomUUID(),
            title,
            completed: false,
            createdAt: Date.now()
        };
        const tasks = $$("app.tasks").val() || [];
        tasks.push(task);
        $$("app.tasks").val(tasks);
        this.save();
    },

    read() {
        return $$("app.tasks").val() || [];
    },

    update(id: string, updates: Partial<Task>) {
        const tasks = this.read();
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            $$("app.tasks").val(tasks);
            this.save();
        }
    },

    delete(id: string) {
        const tasks = this.read().filter(t => t.id !== id);
        $$("app.tasks").val(tasks);
        this.save();
    },

    save() {
        const tasks = this.read();
        localStorage.setItem('tasks', JSON.stringify(tasks));
    },

    load() {
        const saved = localStorage.getItem('tasks');
        if (saved) {
            $$("app.tasks").val(JSON.parse(saved));
        }
    }
};
```

**Tests:** 15 unit tests, 8 integration tests, 5 E2E tests

**Complexity:** ⭐⭐ (2/5)

---

### 3. Flow Cross Realm Template

**Description:** Multi-worker flow processing system

**Features:**
- Worker-based processing
- Message passing between realms
- Progress tracking
- Error handling
- Flow composition

**Code Structure:**
```typescript
// Main thread
import { FXCore } from './fx/FX TypeScript/fx.ts';

const fx = new FXCore();
const $$ = fx.proxy();

// Load flow plugin
$$("@./fx/FX TypeScript/plugins/fx-flow.ts").options({ global: "$flow" });

// Define flow
const processDataFlow = $flow
    .define("processData")
    .step("validate", (data) => {
        if (!data.id) throw new Error("Missing ID");
        return data;
    })
    .step("transform", (data) => {
        return { ...data, processed: true, timestamp: Date.now() };
    })
    .step("save", async (data) => {
        await saveToDatabase(data);
        return data;
    });

// Execute flow
const result = await processDataFlow.run({ id: 123, value: "test" });

// Worker-based parallel processing
const parallelFlow = $flow
    .define("parallel")
    .parallel([
        (data) => processChunk(data, 0),
        (data) => processChunk(data, 1),
        (data) => processChunk(data, 2)
    ])
    .combine((results) => results.flat());
```

**Tests:** 12 unit tests, 10 integration tests, 6 E2E tests

**Complexity:** ⭐⭐⭐⭐ (4/5)

---

### 4. Full FX Wiki Template

**Description:** Notion-style wiki with pages and components

**Features:**
- Page creation/editing
- Rich text editor
- Components (headings, paragraphs, lists, code blocks, images)
- Page hierarchy/navigation
- Search functionality
- Auto-save
- Export to Markdown
- Dark/light themes

**Code Structure:**
```typescript
// Page model
interface WikiPage {
    id: string;
    title: string;
    content: Block[];
    parent?: string;
    children: string[];
    createdAt: number;
    updatedAt: number;
}

interface Block {
    id: string;
    type: 'heading' | 'paragraph' | 'list' | 'code' | 'image';
    content: string;
    properties?: Record<string, any>;
}

// Wiki system
const Wiki = {
    // Page management
    createPage(title: string, parent?: string) {
        const page: WikiPage = {
            id: crypto.randomUUID(),
            title,
            content: [],
            parent,
            children: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const pages = $$("wiki.pages").val() || {};
        pages[page.id] = page;
        $$("wiki.pages").val(pages);

        if (parent) {
            const parentPage = pages[parent];
            parentPage.children.push(page.id);
        }

        this.save();
        return page;
    },

    // Block operations
    addBlock(pageId: string, block: Block) {
        const pages = $$("wiki.pages").val();
        const page = pages[pageId];
        page.content.push(block);
        page.updatedAt = Date.now();
        $$("wiki.pages").val(pages);
        this.save();
    },

    updateBlock(pageId: string, blockId: string, updates: Partial<Block>) {
        const pages = $$("wiki.pages").val();
        const page = pages[pageId];
        const blockIndex = page.content.findIndex(b => b.id === blockId);
        if (blockIndex !== -1) {
            page.content[blockIndex] = { ...page.content[blockIndex], ...updates };
            page.updatedAt = Date.now();
            $$("wiki.pages").val(pages);
            this.save();
        }
    },

    // Components
    components: {
        heading: (content: string, level: number = 1) => ({
            id: crypto.randomUUID(),
            type: 'heading',
            content,
            properties: { level }
        }),

        paragraph: (content: string) => ({
            id: crypto.randomUUID(),
            type: 'paragraph',
            content
        }),

        codeBlock: (content: string, language: string = 'javascript') => ({
            id: crypto.randomUUID(),
            type: 'code',
            content,
            properties: { language }
        })
    }
};

// Plugins used
$$("@./fx/FX TypeScript/plugins/fx-dom-dollar.ts").options({ global: "$dom" });
$$("@./fx/FX TypeScript/plugins/fx-cache.ts").options({ global: "$cache" });
$$("@./fx/FX TypeScript/plugins/fx-markdown.ts").options({ global: "$markdown" });
```

**Tests:** 25 unit tests, 15 integration tests, 10 E2E tests

**Complexity:** ⭐⭐⭐⭐⭐ (5/5)

---

## 🔌 Plugin System

### Available Plugins

| Plugin | Global | Description | Template Compatibility |
|--------|--------|-------------|----------------------|
| fx-dom-dollar | $dom | DOM manipulation | All |
| fx-cache | $cache | Caching system | All |
| fx-orm | $db | Database ORM | CRUD, Wiki |
| fx-router | $router | Client routing | CRUD, Wiki |
| fx-api | $api | API client | All |
| fx-markdown | $markdown | Markdown rendering | Wiki |
| fx-flow | $flow | Cross-realm workflows | Flow, Wiki |
| fx-serialize | $serialize | State serialization | CRUD, Wiki |

### Plugin Auto-Selection

The generator automatically suggests plugins based on template:

- **Basic Counter:** fx-dom-dollar (required)
- **Basic CRUD:** fx-dom-dollar, fx-cache (suggested), fx-orm (optional)
- **Flow Cross Realm:** fx-flow (required), fx-dom-dollar (optional)
- **Full FX Wiki:** fx-dom-dollar, fx-cache, fx-markdown, fx-router (all suggested)

---

## 🧪 Testing Strategy

### Test Categories

#### 1. Unit Tests
- Individual function testing
- Pure logic validation
- Mock dependencies
- Fast execution (<100ms per test)

#### 2. Integration Tests
- Component interaction
- Plugin integration
- State management
- API calls (mocked)

#### 3. End-to-End Tests
- Full user workflows
- Browser automation (Playwright)
- Real DOM interaction
- Performance validation

### Test Suite per Template

**Basic Counter:**
- 10 unit tests (state, increment/decrement, reset)
- 3 integration tests (UI updates, keyboard shortcuts)
- 2 E2E tests (full interaction flow)

**Basic CRUD:**
- 15 unit tests (CRUD operations, validation, filtering)
- 8 integration tests (UI updates, persistence, error handling)
- 5 E2E tests (create task, update, delete, filter, search)

**Flow Cross Realm:**
- 12 unit tests (flow definition, steps, error handling)
- 10 integration tests (worker communication, data passing)
- 6 E2E tests (parallel processing, error recovery, performance)

**Full FX Wiki:**
- 25 unit tests (page model, blocks, navigation, search)
- 15 integration tests (editor, auto-save, export, themes)
- 10 E2E tests (create page, edit content, hierarchy, search, export)

### Test Execution

```typescript
// Automated test runner
class TestRunner {
    async runAll(projectPath: string): Promise<TestResults> {
        const results = {
            unit: await this.runUnitTests(projectPath),
            integration: await this.runIntegrationTests(projectPath),
            e2e: await this.runE2ETests(projectPath)
        };

        return {
            total: results.unit.total + results.integration.total + results.e2e.total,
            passed: results.unit.passed + results.integration.passed + results.e2e.passed,
            failed: results.unit.failed + results.integration.failed + results.e2e.failed,
            passRate: this.calculatePassRate(results)
        };
    }

    private calculatePassRate(results: any): number {
        const total = results.unit.total + results.integration.total + results.e2e.total;
        const passed = results.unit.passed + results.integration.passed + results.e2e.passed;
        return (passed / total) * 100;
    }
}
```

---

## 📦 Build Configuration

### package.json Template

```json
{
  "name": "{{PROJECT_NAME}}",
  "version": "1.0.0",
  "description": "FX Application - {{TEMPLATE_NAME}}",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "npm run build:bundle && vite build",
    "build:bundle": "node src/fx/FX\\ TypeScript/fx-disk/cli/build-bundle.ts --config bundle.config.json",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\""
  },
  "dependencies": {},
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "@playwright/test": "^1.40.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  }
}
```

### tsconfig.json Template

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@fx/*": ["./src/fx/FX TypeScript/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### bundle.config.json Template

```json
{
  "name": "{{PROJECT_NAME}}",
  "version": "1.0.0",
  "plugins": [
    {{PLUGIN_PATHS}}
  ],
  "modules": [],
  "output": "./dist/fx-bundle.bin",
  "format": "binary",
  "compress": true
}
```

---

## 🛠️ Implementation Plan

### Phase 1: Core CLI (Week 1)

**Tasks:**
- [ ] Setup Deno project structure
- [ ] Implement CLI wizard with prompts
- [ ] Create project structure generator
- [ ] Implement file extraction system
- [ ] Add progress indicators

**Deliverables:**
- Working CLI that collects user input
- Basic project structure generation

---

### Phase 2: Template System (Week 2)

**Tasks:**
- [ ] Implement Basic Counter template
- [ ] Implement Basic CRUD template
- [ ] Create template rendering engine
- [ ] Add variable substitution
- [ ] Test all templates

**Deliverables:**
- 2 working templates with tests
- Template rendering system

---

### Phase 3: Advanced Templates (Week 3)

**Tasks:**
- [ ] Implement Flow Cross Realm template
- [ ] Implement Full FX Wiki template
- [ ] Add component library for Wiki
- [ ] Create test suites for all templates
- [ ] Performance optimization

**Deliverables:**
- 4 complete templates
- Comprehensive test suites

---

### Phase 4: Plugin Integration (Week 4)

**Tasks:**
- [ ] Embed all plugin sources
- [ ] Implement plugin selection UI
- [ ] Create plugin integration logic
- [ ] Test plugin combinations
- [ ] Optimize bundle size

**Deliverables:**
- Plugin system fully integrated
- All plugin combinations tested

---

### Phase 5: Testing & Validation (Week 5)

**Tasks:**
- [ ] Implement automated test runner
- [ ] Create test suites for each template
- [ ] Add E2E tests with Playwright
- [ ] Implement 100% pass validation
- [ ] Performance benchmarking

**Deliverables:**
- Complete test automation
- 100% test pass guarantee

---

### Phase 6: Build & Distribution (Week 6)

**Tasks:**
- [ ] Compile to single executable
- [ ] Cross-platform testing (Windows/Mac/Linux)
- [ ] Optimize executable size
- [ ] Create installation docs
- [ ] Final testing

**Deliverables:**
- `fx.exe` for all platforms
- Installation documentation
- User guide

---

## 📂 Source Code Structure

### fx.exe Source Layout

```
fx-generator/
├── deno.json                          # Deno config
├── compile.ts                         # Compilation script
├── README.md                          # Development docs
│
├── src/
│   ├── main.ts                        # Entry point
│   │
│   ├── cli/
│   │   ├── wizard.ts                  # Interactive prompts
│   │   ├── display.ts                 # UI rendering
│   │   ├── progress.ts                # Progress indicators
│   │   └── validator.ts               # Input validation
│   │
│   ├── generator/
│   │   ├── engine.ts                  # Main generator
│   │   ├── templates.ts               # Template rendering
│   │   ├── files.ts                   # File operations
│   │   └── config.ts                  # Config generation
│   │
│   ├── resources/
│   │   ├── manager.ts                 # Resource extraction
│   │   ├── embedder.ts                # Build-time embedding
│   │   └── bundle.ts                  # Resource bundling
│   │
│   ├── validator/
│   │   ├── tester.ts                  # Test execution
│   │   ├── runner.ts                  # Test runner
│   │   └── reporter.ts                # Test reporting
│   │
│   ├── templates/                     # Template definitions
│   │   ├── counter/
│   │   │   ├── template.ts
│   │   │   ├── app.ts.template
│   │   │   ├── tests.ts.template
│   │   │   └── index.html.template
│   │   ├── crud/
│   │   ├── flow/
│   │   └── wiki/
│   │
│   └── utils/
│       ├── logger.ts
│       ├── colors.ts
│       └── spinner.ts
│
├── resources/                         # Embedded resources
│   ├── fx-core/
│   │   ├── fx.ts
│   │   ├── fx.v4.ts
│   │   └── fx-disk/
│   ├── plugins/
│   │   ├── fx-dom-dollar.ts
│   │   ├── fx-cache.ts
│   │   └── ... (all plugins)
│   └── configs/
│       ├── package.json.template
│       ├── tsconfig.json.template
│       └── vite.config.ts.template
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 🔧 Technical Specifications

### Build System

**Tool:** Deno Compile

**Command:**
```bash
deno compile \
  --allow-read \
  --allow-write \
  --allow-net \
  --allow-run \
  --output fx.exe \
  src/main.ts
```

**Platforms:**
- Windows (x64): `fx-windows-x64.exe`
- macOS (x64): `fx-macos-x64`
- macOS (ARM): `fx-macos-arm64`
- Linux (x64): `fx-linux-x64`

### Resource Embedding

**Strategy:** Base64 encode all resources at compile time

```typescript
// embedder.ts
export async function embedResources() {
    const resources = new Map<string, string>();

    // Embed FX core
    const fxCore = await Deno.readTextFile('./resources/fx-core/fx.ts');
    resources.set('fx-core/fx.ts', btoa(fxCore));

    // Embed plugins
    for (const plugin of PLUGINS) {
        const content = await Deno.readTextFile(`./resources/plugins/${plugin}`);
        resources.set(`plugins/${plugin}`, btoa(content));
    }

    // Embed templates
    for (const template of TEMPLATES) {
        const files = await Deno.readDir(`./resources/templates/${template}`);
        for await (const file of files) {
            const content = await Deno.readTextFile(`./resources/templates/${template}/${file.name}`);
            resources.set(`templates/${template}/${file.name}`, btoa(content));
        }
    }

    return resources;
}
```

### CLI Framework

**Library:** Cliffy (Deno CLI framework)

```typescript
import { Select, Input, Checkbox } from "https://deno.land/x/cliffy/prompt/mod.ts";

// Project name prompt
const projectName = await Input.prompt({
    message: "Project name:",
    validate: (value) => {
        if (!/^[a-z0-9-]+$/.test(value)) {
            return "Use lowercase letters, numbers, and hyphens only";
        }
        return true;
    }
});

// Template selection
const template = await Select.prompt({
    message: "Select a template:",
    options: [
        { name: "Basic Counter", value: "counter" },
        { name: "Basic CRUD", value: "crud" },
        { name: "Flow Cross Realm", value: "flow" },
        { name: "Full FX Wiki", value: "wiki" }
    ]
});

// Plugin selection
const plugins = await Checkbox.prompt({
    message: "Select plugins:",
    options: [
        { name: "fx-dom-dollar - DOM manipulation", value: "fx-dom-dollar", checked: true },
        { name: "fx-cache - Caching system", value: "fx-cache" },
        { name: "fx-orm - Database ORM", value: "fx-orm" },
        // ... more plugins
    ]
});
```

---

## 🎨 Template Rendering Engine

### Variable Substitution

```typescript
interface TemplateContext {
    PROJECT_NAME: string;
    TEMPLATE_NAME: string;
    LOADER_TYPE: 'wasm' | 'suspend';
    PLUGINS: string[];
    YEAR: number;
}

class TemplateRenderer {
    render(template: string, context: TemplateContext): string {
        let result = template;

        // Simple variable replacement
        for (const [key, value] of Object.entries(context)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, String(value));
        }

        // Conditional blocks
        result = this.processConditionals(result, context);

        // Loops
        result = this.processLoops(result, context);

        return result;
    }

    private processConditionals(template: string, context: any): string {
        // {{#if CONDITION}}...{{/if}}
        const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
        return template.replace(ifRegex, (match, condition, content) => {
            return context[condition] ? content : '';
        });
    }

    private processLoops(template: string, context: any): string {
        // {{#each ARRAY}}...{{/each}}
        const eachRegex = /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g;
        return template.replace(eachRegex, (match, arrayName, content) => {
            const array = context[arrayName];
            if (!Array.isArray(array)) return '';
            return array.map(item => {
                return content.replace(/{{this}}/g, item);
            }).join('\n');
        });
    }
}
```

### Example Template

```typescript
// app.ts.template
import { FXCore } from './fx/FX TypeScript/fx.ts';
{{#if LOADER_TYPE === 'wasm'}}
import { FXDiskSyncLoader, patchFXWithPluginLoader } from './fx/FX TypeScript/fx-disk/index.js';
{{/if}}

const fx = new FXCore();

{{#if LOADER_TYPE === 'wasm'}}
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/dist/fx-bundle.bin'
});
patchFXWithPluginLoader(fx);
{{/if}}

const $$ = fx.proxy();

{{#each PLUGINS}}
$$("@./fx/FX TypeScript/plugins/{{this}}.ts").options({
    global: "${{this}}"
});
{{/each}}

// {{TEMPLATE_NAME}} implementation
{{TEMPLATE_CODE}}
```

---

## ✅ Validation & Testing

### Generated Project Validation

```typescript
class ProjectValidator {
    async validate(projectPath: string): Promise<ValidationResult> {
        const checks = [
            this.checkFileStructure(projectPath),
            this.checkConfiguration(projectPath),
            this.checkDependencies(projectPath),
            this.runTests(projectPath),
            this.checkBuild(projectPath)
        ];

        const results = await Promise.all(checks);

        return {
            valid: results.every(r => r.passed),
            checks: results,
            passRate: this.calculatePassRate(results)
        };
    }

    private async checkFileStructure(path: string): Promise<CheckResult> {
        const requiredFiles = [
            'package.json',
            'tsconfig.json',
            'src/main.ts',
            'src/app.ts',
            'src/index.html',
            'tests/'
        ];

        for (const file of requiredFiles) {
            const exists = await Deno.stat(`${path}/${file}`).then(() => true).catch(() => false);
            if (!exists) {
                return { passed: false, message: `Missing required file: ${file}` };
            }
        }

        return { passed: true, message: 'File structure valid' };
    }

    private async runTests(path: string): Promise<CheckResult> {
        const runner = new TestRunner();
        const results = await runner.runAll(path);

        if (results.passRate !== 100) {
            return {
                passed: false,
                message: `Tests failed: ${results.passed}/${results.total} passed (${results.passRate}%)`
            };
        }

        return {
            passed: true,
            message: `All tests passed: ${results.total}/${results.total} (100%)`
        };
    }
}
```

---

## 📈 Performance Requirements

### Generation Performance Targets

| Task | Target | Max |
|------|--------|-----|
| Project structure creation | <100ms | 200ms |
| FX core extraction | <200ms | 500ms |
| Plugin installation | <100ms per plugin | 300ms |
| Template rendering | <200ms | 500ms |
| Configuration generation | <50ms | 100ms |
| Bundle building (WASM) | <500ms | 1000ms |
| Test execution | <2s | 5s |
| Total generation time | <5s | 10s |

### Executable Size Targets

| Component | Size | Notes |
|-----------|------|-------|
| Deno runtime | ~40MB | Included in executable |
| Embedded resources | <5MB | Compressed |
| Code | <1MB | Generator code |
| **Total** | **<50MB** | All platforms |

---

## 🔒 Security Considerations

### Input Validation

```typescript
class InputValidator {
    validateProjectName(name: string): ValidationResult {
        // Only lowercase, numbers, hyphens
        if (!/^[a-z0-9-]+$/.test(name)) {
            return {
                valid: false,
                error: 'Project name must contain only lowercase letters, numbers, and hyphens'
            };
        }

        // No reserved names
        const reserved = ['node_modules', 'dist', 'build', 'test'];
        if (reserved.includes(name)) {
            return {
                valid: false,
                error: `"${name}" is a reserved name`
            };
        }

        // Length limits
        if (name.length < 3 || name.length > 50) {
            return {
                valid: false,
                error: 'Project name must be between 3 and 50 characters'
            };
        }

        return { valid: true };
    }

    validatePath(path: string): ValidationResult {
        // Prevent directory traversal
        if (path.includes('..')) {
            return {
                valid: false,
                error: 'Path cannot contain ".."'
            };
        }

        // Prevent absolute paths
        if (path.startsWith('/') || /^[A-Z]:/.test(path)) {
            return {
                valid: false,
                error: 'Use relative paths only'
            };
        }

        return { valid: true };
    }
}
```

### File System Safety

- Never overwrite existing directories without confirmation
- Validate all paths before file operations
- Use sandboxed directories for temporary files
- Clean up on errors

---

## 📚 Documentation

### Generated README.md

```markdown
# {{PROJECT_NAME}}

FX Application built with the **{{TEMPLATE_NAME}}** template.

## 🚀 Quick Start

### Install Dependencies

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Open http://localhost:5173

### Build for Production

\`\`\`bash
npm run build
\`\`\`

### Run Tests

\`\`\`bash
npm test
\`\`\`

## 📁 Project Structure

- `src/` - Application source code
- `src/fx/` - FX framework
- `src/components/` - UI components
- `tests/` - Test suites
- `dist/` - Build output

## 🔌 Installed Plugins

{{#each PLUGINS}}
- **{{this}}** - Description here
{{/each}}

## 📖 Documentation

- [Getting Started](./GETTING_STARTED.md)
- [API Documentation](./docs/API.md)
- [Architecture](./docs/ARCHITECTURE.md)

## 🧪 Testing

This project includes:
- Unit tests
- Integration tests
- E2E tests

All tests pass at 100%.

## 🛠️ Built With

- [FX Framework](https://github.com/your-org/fx)
- [FX-Disk VFS](https://github.com/your-org/fx-disk)
- TypeScript
- Vite

---

Generated with `fx.exe` v1.0.0
```

---

## 🔄 Maintenance & Updates

### Version Management

**Versioning Scheme:** Semantic Versioning (SemVer)

- **Major (1.0.0):** Breaking changes
- **Minor (1.1.0):** New templates/features
- **Patch (1.0.1):** Bug fixes

### Update Mechanism

```typescript
class UpdateChecker {
    async checkForUpdates(): Promise<UpdateInfo | null> {
        const currentVersion = '1.0.0';
        const response = await fetch('https://fx.example.com/version.json');
        const { latest } = await response.json();

        if (this.isNewer(latest, currentVersion)) {
            return {
                current: currentVersion,
                latest,
                downloadUrl: `https://fx.example.com/downloads/fx-${latest}.exe`
            };
        }

        return null;
    }
}
```

---

## 📊 Success Metrics

### Key Performance Indicators (KPIs)

1. **Generation Success Rate:** >99%
2. **Test Pass Rate:** 100% (required)
3. **User Satisfaction:** >90% (via survey)
4. **Time to First Project:** <2 minutes
5. **Generated Projects That Build:** 100%

### Monitoring

```typescript
class TelemetryCollector {
    async collect(event: GenerationEvent) {
        // Anonymous, privacy-respecting telemetry
        const data = {
            version: '1.0.0',
            template: event.template,
            loaderType: event.loaderType,
            pluginCount: event.plugins.length,
            generationTime: event.duration,
            testPassRate: event.testResults.passRate,
            platform: Deno.build.os,
            timestamp: Date.now()
        };

        // Send to analytics (opt-in only)
        if (await this.hasConsent()) {
            await this.send(data);
        }
    }
}
```

---

## 🎯 Future Enhancements

### Phase 2 Features (Post-Launch)

1. **Custom Templates**
   - User-defined templates
   - Template marketplace
   - Import/export templates

2. **Cloud Integration**
   - Deploy to Deno Deploy
   - Deploy to Netlify/Vercel
   - Cloud database setup

3. **Advanced Plugins**
   - Authentication (OAuth, JWT)
   - Real-time (WebSockets)
   - GraphQL support
   - Payment integration (Stripe)

4. **IDE Integration**
   - VS Code extension
   - JetBrains plugin
   - Syntax highlighting

5. **GUI Version**
   - Electron app
   - Web-based generator
   - Drag-and-drop interface

---

## 📋 Acceptance Criteria

### Definition of Done

A generated project is considered "done" when:

- [x] All required files exist
- [x] Configuration is valid
- [x] Dependencies are correct
- [x] All tests pass (100%)
- [x] Project builds successfully
- [x] Development server starts
- [x] Production build works
- [x] Documentation is complete
- [x] No errors in console
- [x] Performance meets targets

---

## 🚢 Deployment Plan

### Release Process

1. **Pre-Release Testing**
   - Test on all platforms
   - Verify all templates
   - Run full test suite
   - Performance benchmarking

2. **Build Artifacts**
   - Compile for Windows (x64)
   - Compile for macOS (x64, ARM)
   - Compile for Linux (x64)
   - Generate checksums

3. **Documentation**
   - Update README
   - Write release notes
   - Create video tutorial
   - Update website

4. **Distribution**
   - GitHub Releases
   - Package registries
   - Official website
   - Social media announcement

### Installation Methods

**Direct Download:**
```bash
# Windows
curl -L https://fx.example.com/fx-windows.exe -o fx.exe

# macOS
curl -L https://fx.example.com/fx-macos -o fx
chmod +x fx

# Linux
curl -L https://fx.example.com/fx-linux -o fx
chmod +x fx
```

**Package Managers:**
```bash
# Homebrew (macOS/Linux)
brew install fx-generator

# Chocolatey (Windows)
choco install fx-generator

# Scoop (Windows)
scoop install fx-generator
```

---

## 📞 Support & Community

### Support Channels

- **Documentation:** https://docs.fx.example.com
- **GitHub Issues:** https://github.com/fx/generator/issues
- **Discord:** https://discord.gg/fx-framework
- **Stack Overflow:** Tag: `fx-framework`

### Contributing

Community contributions welcome for:
- New templates
- Plugin development
- Bug fixes
- Documentation
- Translations

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🎉 Conclusion

The FX Project Generator (`fx.exe`) provides:

✅ **Zero-configuration** project creation
✅ **100% tested** generated code
✅ **Production-ready** applications
✅ **Single executable** distribution
✅ **Cross-platform** support
✅ **Multiple templates** for different use cases
✅ **Plugin ecosystem** integration
✅ **Automated testing** and validation

**Timeline:** 6 weeks to MVP
**Team Size:** 2-3 developers
**Effort:** ~240-360 hours

**Next Steps:**
1. Review and approve design
2. Setup development environment
3. Begin Phase 1 implementation
4. Weekly progress reviews
5. Beta testing program
6. Public release

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-26
**Author:** FX Team
**Status:** Ready for Implementation

---

**Appendix A: Technical Dependencies**

- Deno 1.40+
- Cliffy (CLI framework)
- TypeScript 5.3+
- Vite 5.0+
- Vitest 1.0+
- Playwright 1.40+

**Appendix B: Resource Requirements**

- Development: 16GB RAM, SSD recommended
- CI/CD: GitHub Actions (free tier sufficient)
- Storage: <100MB for source, <200MB for compiled artifacts

**Appendix C: Risk Assessment**

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Executable too large | Medium | Medium | Aggressive compression, lazy loading |
| Platform compatibility | Low | High | Extensive cross-platform testing |
| Template complexity | Medium | Medium | Start simple, iterate |
| Test reliability | Low | High | Hermetic tests, no external deps |

---

**End of Design Document**
