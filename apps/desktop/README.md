# `@kaistu/desktop` — KAISTU Studio Desktop

> Electron 43 + Vite 6.4 + React 19 + TypeScript 5.7

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
│   │   └── index.ts              # Main process: IPC handlers, native menus, system stats, model scanning
│   └── preload/
│       └── index.ts              # contextBridge: expone electronAPI al renderer
├── src/
│   ├── components/
│   │   ├── index.ts              # Re-exports
│   │   ├── TitleBar.tsx          # Barra frameless + stats + controles ventana
│   │   ├── Sidebar.tsx           # Sidebar colapsable (52/220px)
│   │   ├── IconButton.tsx        # Componente botón icon+label unificado
│   │   ├── SettingsLayout.tsx    # Layout sidebar + breadcrumb + content + rightPanel
│   │   ├── Breadcrumb.tsx        # Navegación jerárquica
│   │   ├── SettingsView.tsx      # Ajustes: General, Modelos, Apariencia, Herramientas, Acerca de
│   │   ├── LibraryView.tsx       # Biblioteca de modelos con panel de detalle
│   │   └── ModelDetailPanel.tsx  # Panel lateral: HF + Civitai search
│   ├── utils/
│   │   ├── format.ts             # formatFileSize, formatCount, formatParams, cpuStatLevel, formatGB
│   │   └── clipboard.ts          # copyToClipboard
│   ├── __tests__/
│   │   ├── TitleBar.test.tsx     # 5 tests
│   │   ├── Sidebar.test.tsx      # 5 tests
│   │   └── SettingsView.test.tsx # 6 tests
│   ├── App.tsx                   # Raíz: enrutamiento, status bar, bottom panel (Terminal/Logs)
│   ├── App.css                   # Tema oscuro global (CSS custom properties)
│   ├── i18n.tsx                  # Internacionalización ES/EN con LangProvider + useT()
│   ├── ErrorBoundary.tsx         # Error boundary + botón reintentar
│   └── test-setup.ts             # Mocks de electronAPI para tests
├── assets/
│   └── icon.png                  # Icono de la aplicación
├── index.html                    # Entry point HTML (con CSP)
├── electron.vite.config.ts       # Config electron-vite (main/preload/renderer)
├── tsconfig.json                 # Project references
├── tsconfig.node.json            # TS config para main + preload
├── tsconfig.web.json             # TS config para renderer
├── vitest.config.ts              # Vitest configuration
└── package.json
```

## IPC API — `window.electronAPI`

Todas las llamadas IPC expuestas por el preload via `contextBridge`:

### App & Window

| Método | Returns | Descripción |
|--------|---------|-------------|
| `getAppVersion()` | `string` | Versión desde `app.getVersion()` |
| `minimizeWindow()` | `void` | Minimizar ventana |
| `maximizeWindow()` | `void` | Alternar maximizar/restaurar |
| `closeWindow()` | `void` | Cerrar ventana |
| `isMaximized()` | `boolean` | Estado de maximizado |
| `onWindowState(cb)` | `() => void` | Suscribirse a cambios de estado. Retorna cleanup |

### Backend

| Método | Returns | Descripción |
|--------|---------|-------------|
| `backendHealth()` | `{ status, service }` | GET `/api/v1/health` |

### Menu

| Método | Returns | Descripción |
|--------|---------|-------------|
| `showRootMenu()` | `void` | Menú combinado con todas las secciones |
| `onMenuAction(cb)` | `() => void` | Suscribirse a acciones del menú nativo. Retorna cleanup |

### System Stats

| Método | Returns | Descripción |
|--------|---------|-------------|
| `getSystemStats()` | `SystemStats` | CPU %, RAM (used/total/percent), GPUs (name, utilization, memory) |

```typescript
interface SystemStats {
  cpu: number;                    // 0-100
  memory: { usedGB: number; totalGB: number; percent: number };
  gpus: Array<{
    name: string;
    utilization: number;          // 0-100, -1 si no disponible
    memoryUsedMB: number;
    memoryTotalMB: number;
  }>;
}
```

GPU detection: nvidia-smi (NVIDIA) + Windows Performance Counters + WMI.

### Model Manager

| Método | Returns | Descripción |
|--------|---------|-------------|
| `getModelPaths()` | `string[]` | Rutas guardadas desde `model-paths.json` |
| `setModelPaths(paths)` | `void` | Guardar rutas personalizadas |
| `scanModels(paths)` | `ModelInfo[]` | Escanear directorios hasta profundidad 4 |
| `scanSinglePath(path)` | `ModelInfo[]` | Escanear ruta individual |
| `revealModel(path)` | `void` | Abrir en Explorer |
| `deleteModel(path)` | `void` | Mover a papelera |
| `openPathDialog()` | `string \| null` | Diálogo nativo para seleccionar carpeta |

Extensiones reconocidas: `.ckpt`, `.safetensors`, `.pt`, `.pth`, `.bin`, `.vae.pt`, `.vae.safetensors`, `.patch`.

Clasificación automática: checkpoint, LoRA, VAE, embedding, ControlNet, upscaler, other.

### Terminal & Logs

| Método | Returns | Descripción |
|--------|---------|-------------|
| `execShellCommand(cmd)` | `string` | Ejecuta comando shell, devuelve stdout |
| `onConsoleLog(cb)` | `() => void` | Recibe logs en tiempo real. Retorna cleanup |

## Componentes

### TitleBar

Barra de título frameless con:
- Menú hamburguesa (☰) → menú nativo emergente
- Título + versión de la app
- Stats del sistema en línea: CPU ⬆ RAM ⬆ GPU (verde/amarillo/rojo según carga)
- Botones de ventana: minimizar, maximizar/restaurar, cerrar

Props: `version?: string`, `sysStats?: SystemStats | null`

### Sidebar

Sidebar colapsable (52px icon-only / 220px full):
- Navegación: Proyectos, Texto, Imagen, Audio, Vídeo, Biblioteca
- Configuración al fondo (sección separada)
- Botón de colapsar/expandir al final

Props: `active: ViewPath`, `collapsed: boolean`, `onToggle: () => void`, `onNavigate: (v: ViewPath) => void`

### IconButton

Componente unificado que reemplaza todos los `<button>` del proyecto.

Props:
| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `icon` | `string` | — | Nombre del icono Material Symbols |
| `label?` | `string` | — | Texto del botón |
| `iconOnly?` | `boolean` | `false` | Solo icono (tooltip via `title`) |
| `iconClass?` | `string` | — | Clase adicional para el `<span>` icono |
| `className?` | `string` | — | Clase para el `<button>` (styling específico de zona) |

Uso: cada zona aplica su propio `className` (ej: `nav-btn`, `tb-btn`, `action-btn`). No hay variantes CSS internas.

### SettingsLayout

Layout reutilizable para vistas con sidebar de pestañas.

Props:
| Prop | Tipo | Descripción |
|------|------|-------------|
| `tabs` | `{ key: string; label: string; icon: string }[]` | Pestañas del sidebar |
| `activeTab` | `string` | Pestaña activa |
| `onTabChange` | `(key: string) => void` | Cambio de pestaña |
| `breadcrumbCrumbs` | `Crumb[]` | Migas de pan |
| `onBreadcrumbNavigate` | `(tab: string) => void` | Navegación breadcrumb |
| `rightPanel?` | `ReactNode` | Panel lateral derecho opcional |

Usado por: `SettingsView`, `LibraryView`.

### Breadcrumb

Navegación jerárquica.

```typescript
interface Crumb {
  label: string;
  tab?: string;  // opcional: si tiene tab, es clickeable
}
```

Props: `crumbs: Crumb[]`, `onNavigate?: (tab: string) => void`

### SettingsView

Vista de ajustes con sub-sidebar y contenido:

| Tab | Funcionalidad |
|-----|---------------|
| **General** | Selector de idioma (Español / English). Persiste en `localStorage` |
| **Modelos** | Gestor de rutas (conocidas + personalizadas), escaneo, filtro, clasificación |
| **Apariencia** | Color picker RGBA para `--accent` (color + alpha + preview + reset) |
| **Herramientas** | Civitai API key config, terminal integrado, logs |
| **Acerca de** | Versión de la aplicación |

### LibraryView

Biblioteca de modelos:
- Sidebar con tabs por tipo de modelo (checkpoint, LoRA, VAE, embedding, ControlNet, upscaler)
- Breadcrumb: "Biblioteca › {Tipo}"
- Lista de modelos con nombre, tipo, tamaño, ruta
- Sort por software, contadores de tipo con tamaño total
- Reveal en Explorer, delete a papelera
- Right panel: `ModelDetailPanel` con búsqueda HF + Civitai

### ModelDetailPanel

Panel lateral derecho con información detallada del modelo:
- Nombre, tipo (con icono), tamaño, ruta
- Búsqueda en Hugging Face Hub (por nombre+ext, filtro exacto, fallbacks)
- Búsqueda en Civitai (match por nombre, versiones, trigger words)
- Estados: Loading, Error, NotFound
- `key={selectedModel.path}` forza remount en cada click

## i18n (`src/i18n.tsx`)

Sistema de internacionalización mediante React context:

```typescript
const { t, lang, setLang } = useT();
t("Proyectos") // → "Proyectos" (es) / "Projects" (en)
```

El idioma se persiste automáticamente en `localStorage` bajo la clave `kaistu-lang`.

## Utils (`src/utils/`)

| Exportación | Descripción |
|-------------|-------------|
| `formatFileSize(bytes)` | `"1.5 GB"`, `"340 MB"`, `"128 KB"` |
| `formatCount(n)` | `"1.2k"`, `"340"` |
| `formatParams(n)` | `"1.2B"`, `"340M"` |
| `formatGB(bytes)` | `"1.50"` (solo número) |
| `cpuStatLevel(val)` | `"success"` / `"warning"` / `"error"` según umbral |
| `copyToClipboard(text)` | Copia al portapapeles |

## Testing

16 tests con Vitest + React Testing Library + jsdom:

| Archivo | Tests | Lo que cubre |
|---------|-------|-------------|
| `TitleBar.test.tsx` | 5 | Render, botones de control, stats, menú hamburguesa |
| `Sidebar.test.tsx` | 5 | Items, colapso, click en navegación, botón settings |
| `SettingsView.test.tsx` | 6 | Render general, sidebar, cada tab (General, Modelos, Apariencia, Acerca de) |

```bash
npm run test                    # Una vez
npm run test -w apps/desktop -- --watch  # Watch mode
```

## Estilos

- Dark theme vía CSS custom properties en `:root`
- `-webkit-app-region: drag` en la barra de título (cada botón lleva `no-drag`)
- Tema oscuro con fondo `#0f0f11` y texto `#e8e8ed`
- Colores semánticos: `--success: #00e676`, `--warning: #ffd60a`, `--error: #ff453a`
- Iconos `material-symbols-outlined` self-hosted en `assets/`

## Desarrollo

```bash
# Iniciar con hot reload (requiere backend en puerto 8000)
npm run dev -w apps/desktop

# TypeScript check
npm run typecheck -w apps/desktop

# Tests
npm run test -w apps/desktop

# Build
npm run build -w apps/desktop
```

El proceso main de Electron NO tiene hot reload — los cambios en `electron/main/` o `electron/preload/` requieren reiniciar el dev server.

## MCP Server Integration

KAISTU Studio ships with a Python MCP server (`mcp-server/`) that mirrors the same functionality for AI assistants. Tools like `scan_models`, `search_huggingface`, `search_civitai`, `get_system_stats`, `run_terminal`, and backend API key management are exposed via the MCP protocol — see `mcp-server/README.md` for details.

## Seguridad

- `contextIsolation: true`, `nodeIntegration: false`
- CSP en `index.html`: `default-src 'self'; connect-src 'self' http://localhost:8000 ws://localhost:*; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'`
- API keys cifradas con Fernet en backend
- CORS sin `file://`
- npm audit: 0 vulnerabilidades en workspace desktop
