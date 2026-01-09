# FX Dreamweaver 3D IDE

A spatial visual IDE built with Electron, Three.js, and the FX Framework. Experience code editing in a 3D environment with draggable panels, AI assistance, and reactive state management.

## Features

- **3D Spatial Interface**: WebGL-powered scene with 2D/3D/Hybrid view modes
- **Draggable Panels**: Move, resize, and arrange panels in 3D space
- **Code Editor**: Syntax-aware editor with tabs, line numbers, and file management
- **File Explorer**: Navigate your project files and folders
- **Integrated Terminal**: Full PTY terminal with command history
- **AI Chat**: Built-in AI assistant (simulated for now, ready for MCP integration)
- **Theme System**: 5 built-in themes (Dark, Light, High Contrast, Midnight, Cyberpunk)
- **Command Palette**: Quick access to all commands with Ctrl+Shift+P
- **FX Integration**: Reactive state management via FX Bridge

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the IDE
npm start
```

### Building for Distribution

```bash
# Build executable
npm run package
```

## Keyboard Shortcuts

### General
- `Ctrl+Shift+P` - Command Palette
- `Ctrl+O` - Open Project
- `Ctrl+S` - Save File
- `Ctrl+Shift+S` - Save All
- `Escape` - Cancel/Deselect

### View Modes
- `Ctrl+1` - 2D View
- `Ctrl+2` - 3D View
- `Ctrl+3` - Hybrid View

### Zoom
- `Ctrl++` - Zoom In
- `Ctrl+-` - Zoom Out
- `Ctrl+0` - Reset Zoom

### Panels
- `Ctrl+Shift+E` - Toggle Explorer
- `Ctrl+Shift+C` - Toggle Editor
- `Ctrl+`` - Toggle Terminal
- `Ctrl+Shift+A` - Toggle AI Chat
- `Alt+Arrow Keys` - Navigate between panels
- `Tab` - Focus next panel
- `Shift+Tab` - Focus previous panel

### Terminal
- `Ctrl+L` - Clear terminal
- `Ctrl+C` - Send SIGINT
- `Arrow Up/Down` - Navigate command history

## Architecture

### Main Process (`src/main/`)
- **index.ts**: Application entry point
- **window-manager.ts**: Electron window lifecycle
- **menu-builder.ts**: Application menu
- **ipc-handlers.ts**: IPC communication (file system, PTY, dialogs)
- **preload.ts**: Secure bridge to renderer

### Renderer Process (`src/renderer/`)
- **app.ts**: Main application logic
- **fx-bridge.ts**: FX Framework integration
- **input-manager.ts**: Keyboard, mouse, touch handling
- **command-palette.ts**: Quick command interface

### Scene (`src/scene/`)
- **scene-manager.ts**: WebGL scene, camera, rendering

### Panels (`src/panels/`)
- **panel-manager.ts**: Panel lifecycle and layout
- **panel.ts**: Base panel class
- **editor-panel.ts**: Code editor with tabs
- **explorer-panel.ts**: File tree navigator
- **terminal-panel.ts**: PTY terminal emulator
- **ai-panel.ts**: AI chat interface

### Themes (`src/themes/`)
- **theme-manager.ts**: Theme system with 5 built-in themes

## Project Structure

```
fx-dreamweaver/
├── src/
│   ├── main/          # Electron main process
│   ├── renderer/      # Renderer entry & core
│   ├── scene/         # WebGL scene management
│   ├── panels/        # Panel implementations
│   ├── themes/        # Theme system
│   └── shared/        # Shared types
├── dist/              # Compiled output
└── package.json       # Project config
```

## Configuration

The IDE stores settings via FX nodes:
- `settings.viewMode` - Current view mode (2d/3d/hybrid)
- `settings.theme` - Active theme ID
- `workspace.projectPath` - Open project directory
- `ui.panels` - Panel states and positions

## Extending the IDE

### Adding a New Panel

1. Create a new panel class extending `Panel`:

```typescript
import { Panel, PanelConfig } from './panel';

export class MyPanel extends Panel {
    async init(): Promise<void> {
        await super.init();
        // Custom initialization
    }
}
```

2. Register in `panel-manager.ts`:

```typescript
case 'my-panel':
    panel = new MyPanel(config, this.sceneManager, this.fxBridge);
    break;
```

3. Add menu item in `menu-builder.ts`

### Creating a Custom Theme

```typescript
const myTheme: Theme = {
    id: 'my-theme',
    name: 'My Theme',
    colors: {
        background: '#000000',
        surface: '#111111',
        // ... more colors
    },
    fonts: {
        ui: 'system-ui',
        code: 'JetBrains Mono'
    }
};

themeManager.registerTheme(myTheme);
```

## MCP Integration (Future)

The AI panel is ready for Model Context Protocol integration via the `fx-mcp-bridge` plugin. Connect to Claude, GPT-4, or other AI providers for:
- Code generation and editing
- File operations
- Command execution
- Database queries
- Git operations

## Troubleshooting

### Build Errors
- Make sure TypeScript is installed: `npm install -g typescript`
- Clear dist folder: `rm -rf dist` then rebuild

### Electron Won't Start
- Check that `dist/renderer/index.html` exists
- Verify all dependencies are installed: `npm install`

### Performance Issues
- Try switching to 2D view mode (Ctrl+1)
- Close unused panels
- Reduce window size

## Contributing

This IDE is part of the FX Framework ecosystem. Contributions welcome!

## License

MIT

---

Built with FX Framework, Electron, Three.js, and TypeScript.
