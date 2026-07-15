# `@kaistu/desktop` — KAISTU Studio Desktop

> Electron 43 + Vite 6.4 + React 19 + TypeScript 5.7 — AI image/video processing client

![App screenshot](../../docs/imgs/pr2-screenshot.png)

## Stack

| Tool | Versión |
|------|---------|
| Electron | 43 |
| Vite (electron-vite) | 6.4 / 5 |
| React | 19 |
| TypeScript | 5.7 |
| Vitest | 4.1+ |
| React Testing Library | 16.3 |
| jsdom | 29 |
| Material Symbols | self-hosted |

## Estructura

```
apps/desktop/
├── electron/
│   ├── main/
│   │   └── index.ts              # Main process: 48 IPC handlers, native menus, system stats, model scanning, upscaler execution, venv/PyTorch management
│   └── preload/
│       └── index.ts              # contextBridge: 40+ métodos electronAPI
├── src/
│   ├── components/
│   │   ├── index.ts              # Re-exports (30+ components)
│   │   ├── TitleBar.tsx          # Frameless title bar + stats + window controls
│   │   ├── Sidebar.tsx           # Collapsible sidebar (52/220px)
│   │   ├── IconButton.tsx        # Unified icon+label button
│   │   ├── SettingsLayout.tsx    # Layout sidebar + breadcrumb + content + rightPanel
│   │   ├── Breadcrumb.tsx        # Hierarchical navigation
│   │   ├── SettingsView.tsx      # Settings: General, Models, Appearance, Tools, About
│   │   ├── LibraryView.tsx       # Model library with HF/Civitai detail panel
│   │   ├── HomeView.tsx          # Landing page with quick action cards
│   │   ├── ScaleSelectionView.tsx # Mode picker: upscale / downscale / rescale / clean
│   │   ├── UpscaleImageView.tsx  # Image upscaling view
│   │   ├── UpscaleVideoView.tsx  # Video upscaling view
│   │   ├── DownscaleImageView.tsx # Image downscaling view
│   │   ├── DownscaleVideoView.tsx # Video downscaling view
│   │   ├── RescaleImageView.tsx  # Image rescaling view
│   │   ├── RescaleVideoView.tsx  # Video rescaling view
│   │   ├── CleanImageView.tsx    # Image clean/denoise view
│   │   ├── CleanVideoView.tsx    # Video clean/denoise view
│   │   ├── UpscaleSidebar.tsx    # Sidebar with upscaler model selector + mode controls
│   │   ├── ExecutionsView.tsx    # Execution history list
│   │   ├── ExecutionDetailView.tsx # Single execution detail with progress
│   │   ├── TextView.tsx          # Text generation view (HF recommended models)
│   │   ├── ContentView.tsx       # Generic content placeholder view
│   │   ├── ProjectsView.tsx      # Projects view
│   │   ├── CompareSlider.tsx     # Before/after image comparison
│   │   ├── ImageDropzone.tsx     # Image file dropzone
│   │   ├── VideoDropzone.tsx     # Video file dropzone
│   │   ├── BottomPanel.tsx       # Resizable bottom panel (Terminal/Logs)
│   │   ├── TerminalView.tsx      # Shell terminal
│   │   ├── LogsView.tsx          # Application log viewer
│   │   ├── WebRootMenu.tsx       # Menu overlay
│   │   └── useUpscaleForm.ts     # Hook: upscale form state + auto-download logic
│   ├── utils/
│   │   ├── format.ts             # formatFileSize, formatCount, formatParams, cpuStatLevel, formatGB
│   │   └── clipboard.ts          # copyToClipboard
│   ├── __tests__/
│   │   ├── TitleBar.test.tsx     # 5 tests
│   │   ├── Sidebar.test.tsx      # 5 tests
│   │   └── SettingsView.test.tsx # 6 tests
│   ├── App.tsx                   # Root: view routing, status bar, bottom panel, font scale, accent color
│   ├── App.css                   # Global dark theme (CSS custom properties)
│   ├── ErrorBoundary.tsx         # Error boundary + retry button
│   └── test-setup.ts             # electronAPI mocks for tests
├── assets/
│   └── icon.png                  # Application icon
├── index.html                    # Entry (with CSP)
├── electron.vite.config.ts       # electron-vite config
├── tsconfig.json / .node.json / .web.json
├── vitest.config.ts
└── package.json
```

## Views / Routing

| ViewPath | Component | Description |
|----------|-----------|-------------|
| `home` | `HomeView` | Landing page with quick action cards |
| `upscale` | `ScaleSelectionView` | Choose mode: upscale / downscale / rescale / clean |
| `upscale-image` | `UpscaleImageView` | Upload image, select model, upscale |
| `upscale-video` | `UpscaleVideoView` | Upload video, select model, upscale |
| `downscale-image` | `DownscaleImageView` | Downscale image |
| `downscale-video` | `DownscaleVideoView` | Downscale video |
| `rescale-image` | `RescaleImageView` | Rescale image to exact dimensions |
| `rescale-video` | `RescaleVideoView` | Rescale video to exact dimensions |
| `clean-image` | `CleanImageView` | AI clean/denoise image (4x upscale + 0.25x downscale) |
| `clean-video` | `CleanVideoView` | AI clean/denoise video |
| `executions` | `ExecutionsView` | Execution history list |
| `execution.{id}` | `ExecutionDetailView` | Execution detail + progress |
| `library` | `LibraryView` | Model library browser |
| `settings` | `SettingsView` | General / Models / Appearance / Tools / About |
| `settings.tools` | `SettingsView (tools tab)` | API keys, terminal, logs |
| `text` | `TextView` | HF text model recommendations |
| `image` / `audio` / `video` | `ContentView` | Generic content placeholder |

## IPC API — `window.electronAPI`

### App & Window

| Method | Returns | Description |
|--------|---------|-------------|
| `getAppVersion()` | `string` | `app.getVersion()` |
| `minimizeWindow()` | `void` | Minimize |
| `maximizeWindow()` | `void` | Toggle maximize/restore |
| `closeWindow()` | `void` | Close |
| `isMaximized()` | `boolean` | Maximized state |
| `onWindowState(cb)` | cleanup fn | Subscribe to maximize/restore changes |
| `getAppDataPath()` | `string` | `%APPDATA%/kaistu-studio` |

### Backend

| Method | Returns | Description |
|--------|---------|-------------|
| `backendHealth()` | `{status, service}` | GET `/api/v1/health` |
| `logMessage(source, level, message)` | `void` | POST `/api/v1/log` |
| `getSystemCapabilities()` | `SystemCapabilities` | GET `/api/v1/system/capabilities` |

### Menu

| Method | Returns | Description |
|--------|---------|-------------|
| `showRootMenu()` | `void` | Pop up native menu (Archivo/Editar/Ver/Herramientas/Ayuda) |
| `onMenuAction(cb)` | cleanup fn | Subscribe to native menu actions |

### System Stats

| Method | Returns | Description |
|--------|---------|-------------|
| `getSystemStats()` | `SystemStats` | CPU %, RAM (used/total/percent), GPUs (name, utilization, memory) |

```typescript
interface SystemStats {
  cpu: number;
  memory: { usedGB: number; totalGB: number; percent: number };
  gpus: Array<{ name: string; utilization: number; memoryUsedMB: number; memoryTotalMB: number }>;
}
```

GPU detection: nvidia-smi (NVIDIA) + Windows Performance Counters + WMI.

### Config

| Method | Returns | Description |
|--------|---------|-------------|
| `getConfig()` | `object` | GET `/api/v1/config` |
| `setConfig(payload)` | `void` | POST `/api/v1/config` |

### Model Manager

| Method | Returns | Description |
|--------|---------|-------------|
| `getModelPaths()` | `string[]` | Saved scan paths |
| `setModelPaths(paths)` | `void` | Save custom paths |
| `discoverModelPaths()` | `DiscoveredPath[]` | Auto-discover (ComfyUI, A1111, etc.) |
| `scanModels(sources)` | `ModelInfo[]` | Scan directories (depth 4) |
| `revealInFolder(path)` | `void` | Open in Explorer |
| `deleteModel(path)` | `void` | Move to trash |
| `downloadModel(url, filename, type)` | `{success, path}` | Download model (Civitai auth supported) |
| `selectFolder()` | `string \| null` | Native folder picker dialog |

Extensions: `.ckpt`, `.safetensors`, `.pt`, `.pth`, `.bin`, `.vae.pt`, `.vae.safetensors`, `.patch`.

### HuggingFace

| Method | Returns | Description |
|--------|---------|-------------|
| `searchHFModel(query)` | `HFModelResult \| null` | Search HF Hub (multi-step matching) |
| `hfTextLeaderboard()` | `TextModel[]` | GET `/api/v1/models/hf-text-leaderboard` |
| `getSpaceInfo(spaceId)` | `SpaceInfo` | GET `/api/v1/spaces/info/{id}` |

### Civitai

| Method | Returns | Description |
|--------|---------|-------------|
| `searchCivitaiModel(query, nsfw?)` | `CivitaiModelResult \| null` | Search Civitai API v1 |
| `getAPIKeys()` | `{service}[]` | GET `/api/v1/api-keys` |
| `saveAPIKey(payload)` | `{service}` | POST `/api/v1/api-keys` |
| `deleteAPIKey(service)` | `void` | DELETE `/api/v1/api-keys/{service}` |

### Upscalers (Real-ESRGAN)

| Method | Returns | Description |
|--------|---------|-------------|
| `getUpscalers()` | `Upscaler[]` | List with installation status |
| `installUpscaler(modelId)` | `Upscaler` | Download & install model |
| `runUpscaler(modelId, payload)` | `Execution` | Run upscale/clean/downscale/rescale |

```typescript
interface Upscaler {
  model_id: string; name: string; short_desc: string; usage: string;
  size: string; scales: number[]; default_scale: number;
  author: string; author_url: string; installed: boolean;
}
```

Payload fields for `runUpscaler`: `mode`, `input_path`, `output_path`, `scale`, `face_enhance`, `target_width/height`, `params` (tile_size, gpu_id, threads, tta).

### Executions

| Method | Returns | Description |
|--------|---------|-------------|
| `listExecutions()` | `Execution[]` | Last 50, desc by started_at |
| `getExecution(execId)` | `Execution` | Single execution detail |
| `getExecutionStats()` | `ExecStats` | total, completed, running, failed |
| `startExecution(payload)` | `Execution` | Create new pending execution |
| `updateExecution(execId, payload)` | `Execution` | Update progress/status |
| `cancelExecution(execId)` | `void` | Cancel pending/running |

```typescript
interface Execution {
  id: string; model_id: string; model_name: string;
  input_file: string; output_path: string; scale: number;
  mode: string; status: string; progress: number;
  started_at: string; completed_at?: string;
  input_width: number; input_height: number; file_size: string;
  target_width?: number; target_height?: number;
}
```

### File I/O

| Method | Returns | Description |
|--------|---------|-------------|
| `getFilePath(file)` | `string` | `webUtils.getPathForFile(file)` |
| `getFileSize(path)` | `string` | Formatted file size |
| `saveFileAs(sourcePath)` | `string \| null` | Save dialog + copy |
| `openFile(path)` | `void` | `shell.openPath()` |

### Terminal & Logs

| Method | Returns | Description |
|--------|---------|-------------|
| `runInTerminal(cmd)` | `{stdout, stderr}` | Execute shell command |
| `getLogs()` | `string` | Internal log buffer |
| `getTerminalInfo()` | `{user, host, cwd, venv}` | Shell environment info |
| `onLogEntry(cb)` | cleanup fn | Real-time log streaming |

## Components

### TitleBar

Frameless title bar with:
- Hamburger menu (☰) → native menu or `WebRootMenu` overlay
- App title + version
- Live system stats: CPU ⬆ RAM ⬆ GPU (green/yellow/red by load)
- Window controls: minimize, maximize/restore, close

Props: `version?: string`, `sysStats?: SystemStats | null`

### Sidebar

Collapsible sidebar (52px icon-only / 220px full):
- Navigation: Home, Executions, Upscale, Text, Image, Audio, Video, Library
- Settings at bottom (separated section)
- Collapse/expand toggle button

Props: `active: ViewPath`, `collapsed: boolean`, `onToggle: () => void`, `onNavigate: (v: ViewPath) => void`

### IconButton

Unified button replacing all raw `<button>` usage.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `string` | — | Material Symbols icon name |
| `label?` | `string` | — | Button text |
| `iconOnly?` | `boolean` | `false` | Icon only (tooltip via `title`) |
| `iconClass?` | `string` | — | Extra class for `<span>` icon |
| `className?` | `string` | — | Class for `<button>` (zone-specific styling) |

Each zone applies its own `className` (e.g., `nav-btn`, `tb-btn`, `action-btn`). No internal CSS variants.

### SettingsLayout

Reusable layout for views with sidebar tabs.

| Prop | Type | Description |
|------|------|-------------|
| `tabs` | `{key, label, icon}[]` | Sidebar tabs |
| `activeTab` | `string` | Active tab key |
| `onTabChange` | `(key) => void` | Tab change handler |
| `breadcrumbCrumbs` | `Crumb[]` | Breadcrumb trail |
| `onBreadcrumbNavigate` | `(tab) => void` | Breadcrumb click |
| `rightPanel?` | `ReactNode` | Optional right panel |

Used by: `SettingsView`, `LibraryView`.

### Breadcrumb

Hierarchical navigation.

```typescript
interface Crumb { label: string; tab?: string; }
```

### CompareSlider

Before/after image comparison with draggable split handle.

### ImageDropzone / VideoDropzone

File upload dropzones with drag-and-drop and click-to-browse.

### BottomPanel

Resizable bottom panel with two tabs:
- **Terminal**: `TerminalView` — shell terminal
- **Logs**: `LogsView` — application log viewer

### WebRootMenu

Menu overlay triggered by hamburger button or `"kaistu-show-root-menu"` custom event.

### HomeView

Landing page with quick action cards: Upscale, Downscale, Rescale, Clean, Models.

### ScaleSelectionView

Mode selection: Upscale (increase), Downscale (decrease), Rescale (exact size), Clean (AI denoising).

### UpscaleImageView / UpscaleVideoView

Full image/video upscaling pipeline:
1. Upload file via dropzone or browse
2. Auto-detect file dimensions
3. Select upscaler model (auto-downloads if not installed)
4. Configure scale factor (2x or 4x)
5. Optional face enhancement
6. Advanced params: tile size, GPU device, TTA
7. Run → creates execution → real-time progress tracking
8. Preview result with `CompareSlider`

### DownscaleImageView / DownscaleVideoView

Downscale to target resolution with the same model-based pipeline. Shows output resolution preview.

### RescaleImageView / RescaleVideoView

Set exact target width/height. Auto-calculates aspect ratio lock option.

### CleanImageView / CleanVideoView

AI denoising: 4x upscale via Real-ESRGAN followed by 0.25x downscale. Auto-installs `realesrgan-x4plus`. Optional face enhancement.

### UpscaleSidebar

Sidebar panel for upscale mode controls:
- Mode selection (upscale/downscale/rescale/clean)
- Model selector with auto-install
- Scale factor, face enhancement toggle
- Advanced params (tile size, GPU ID, threads, TTA)
- Output resolution preview

### ExecutionsView

Execution history: table with status badges, progress bars, timestamps. Click to expand detail. Cancel button for running tasks.

### ExecutionDetailView

Full detail of a single execution: input/output paths, model info, params, real-time progress status, output preview.

### SettingsView

Settings with sub-sidebar:

| Tab | Features |
|-----|----------|
| **General** | Language selector (ES/EN), persists in `localStorage` |
| **Models** | Path manager (known + custom), scan, filter, classify |
| **Appearance** | RGBA accent color picker (color + alpha + preview + reset) |
| **Tools** | Civitai API key config, terminal, logs |
| **About** | App version |

### LibraryView

Model library:
- Sidebar tabs by model type (checkpoint, LoRA, VAE, embedding, ControlNet, upscaler)
- Breadcrumb: "Library › {Type}"
- Model list: name, type, size, path
- Sort by software, type counters with total size
- Reveal in Explorer, delete to trash
- Right panel: HF + Civitai search

### useUpscaleForm (Hook)

Manages upscale form state:
- Model selection with auto-download (`autoInstallAttempted` ref prevents loops)
- File info (path, width, height, size)
- Mode switching, scale factor, face enhancement
- Advanced params (tile, GPU, threads, TTA)
- Output resolution calculation

## Startup Sequence

On app launch (`electron/main/index.ts`):

1. Ensure `%APPDATA%/kaistu-studio/` directory exists
2. Check Python venv exists; create if missing
3. `ensureVenv`: verify pip packages, check PyTorch GPU availability
4. `ensureOptimalPytorch`: if GPU detected with CPU PyTorch, auto-upgrade to CUDA/ROCm (queries PyTorch repo for latest version suffix). Installs `torch` + `torchvision` + `torchaudio` + `xformers` together.
5. Start backend if needed
6. Create window with CSP, contextIsolation

## i18n

React context (`LangProvider` + `useT()`):

```typescript
const { t, lang, setLang } = useT();
t("Proyectos") // → "Proyectos" (es) / "Projects" (en)
```

Language persisted in `localStorage` under `kaistu-lang`.

## Utils (`src/utils/`)

| Export | Description |
|--------|-------------|
| `formatFileSize(bytes)` | `"1.5 GB"`, `"340 MB"`, `"128 KB"` |
| `formatCount(n)` | `"1.2k"`, `"340"` |
| `formatParams(n)` | `"1.2B"`, `"340M"` |
| `formatGB(bytes)` | `"1.50"` (number only) |
| `cpuStatLevel(val)` | `"success"` / `"warning"` / `"error"` by threshold |
| `copyToClipboard(text)` | Copy to clipboard |

## Testing

16 tests total (Vitest + React Testing Library + jsdom):

| File | Tests | Coverage |
|------|-------|----------|
| `TitleBar.test.tsx` | 5 | Render, controls, stats, hamburger menu |
| `Sidebar.test.tsx` | 5 | Items, collapse, navigation click, settings button |
| `SettingsView.test.tsx` | 6 | General render, sidebar, each tab (General, Models, Appearance, About) |

```bash
npm run test                    # Once
npm run test -w apps/desktop -- --watch  # Watch mode
```

## Styles

- Dark theme via CSS custom properties in `:root`
- `-webkit-app-region: drag` on title bar (buttons are `no-drag`)
- Background `#0f0f11`, text `#e8e8ed`
- Semantic colors: `--success: #00e676`, `--warning: #ffd60a`, `--error: #ff453a`
- Dynamic `--accent`: user-configurable via Appearance settings
- Dynamic `--font-scale`: Ctrl+MouseWheel zoom, persisted in localStorage
- Material Symbols self-hosted in `assets/`

## Development

```bash
# Start with hot reload (backend required on port 8000)
npm run dev -w apps/desktop

# TypeScript check
npm run typecheck -w apps/desktop

# Tests
npm run test -w apps/desktop

# Build
npm run build -w apps/desktop
```

Main process does NOT hot-reload — changes to `electron/main/` or `electron/preload/` require restart.

## MCP Server Integration

All desktop features are mirrored as MCP tools — see `mcp-server/README.md` for the full list of 28 tools. Tools like `list_upscalers`, `run_upscaler`, `list_executions`, `get_system_capabilities`, `hf_text_leaderboard`, `get_space_info`, and `run_space` are available to any MCP-compatible AI assistant.

## Security

- `contextIsolation: true`, `nodeIntegration: false`
- CSP: `default-src 'self'; connect-src 'self' http://localhost:8000 ws://localhost:*; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'`
- API keys encrypted with Fernet on backend
- CORS without `file://`
- npm audit: 0 vulnerabilities in workspace desktop
