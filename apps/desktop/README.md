# `@kaistu/desktop` — KAISTU Studio Desktop

> Electron 33 + Vite 6 + React 19 + TypeScript 5.7

## Stack

| Tool | Versión |
|------|---------|
| Electron | 33.2 |
| Vite (electron-vite) | 6 / 2.3 |
| React | 19 |
| TypeScript | 5.7 |
| Vitest | 4.1 |
| React Testing Library | 16.3 |
| jsdom | 29 |
| Material Symbols | 0.45 (self-hosted) |
| tRPC | 11 |
| TanStack React Query | 5 |

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
│   │   ├── TitleBar.tsx          # Barra de título frameless + stats system + botones de control
│   │   ├── Sidebar.tsx           # Sidebar colapsable con navegación
│   │   └── SettingsView.tsx      # Vista de ajustes (General / Modelos / Apariencia / Acerca de)
│   ├── __tests__/
│   │   ├── TitleBar.test.tsx     # 5 tests
│   │   ├── Sidebar.test.tsx      # 5 tests
│   │   └── SettingsView.test.tsx # 6 tests
│   ├── App.tsx                   # Componente raíz + enrutamiento interno
│   ├── App.css                   # Tema oscuro global (CSS custom properties)
│   ├── i18n.tsx                  # Internacionalización ES/EN con LangProvider + useT()
│   ├── ErrorBoundary.tsx         # Error boundary para evitar crashes completos
│   └── test-setup.ts             # Mocks de electronAPI para tests
├── assets/
│   └── icon.png                  # Icono de la aplicación
├── index.html                    # Entry point HTML
├── electron.vite.config.ts       # Configuración de electron-vite (main/preload/renderer)
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
| `onWindowState(cb)` | `() => void` | Suscribirse a cambios de estado (maximized/normal). Retorna cleanup |

### Backend

| Método | Returns | Descripción |
|--------|---------|-------------|
| `backendHealth()` | `{ status, service }` | GET `/api/v1/health` |
| `generate(input)` | `unknown` | POST `/api/v1/generate` |
| `listProjects()` | `unknown` | GET `/api/v1/projects` |

### Menu

| Método | Returns | Descripción |
|--------|---------|-------------|
| `showMenu(menuKey)` | `void` | Menú emergente por sección (archivo, editar, ver, herramientas, ayuda) |
| `showRootMenu()` | `void` | Menú combinado con todas las secciones |
| `onMenuAction(cb)` | `() => void` | Suscribirse a acciones del menú nativo. Retorna cleanup |

### System Stats

| Método | Returns | Descripción |
|--------|---------|-------------|
| `getSystemStats()` | `SystemStats` | CPU %, RAM (used/total/percent), GPUs (name, utilization, memory) |

#### SystemStats

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

GPU detection: nvidia-smi (NVIDIA) + Windows Performance Counters + WMI `Win32_VideoController` (AMD/Intel). Merge por nombre.

### Model Manager

| Método | Returns | Descripción |
|--------|---------|-------------|
| `getModelPaths()` | `string[]` | Rutas guardadas desde `model-paths.json` |
| `setModelPaths(paths)` | `void` | Guardar rutas personalizadas |
| `scanModels(paths)` | `ModelInfo[]` | Escanear directorios hasta profundidad 4 |

Extensiones reconocidas: `.ckpt`, `.safetensors`, `.pt`, `.pth`, `.bin`, `.vae.pt`, `.vae.safetensors`, `.patch`.

Clasificación automática: checkpoint, LoRA, VAE, embedding, ControlNet, upscaler, other.

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
- Todo con textos traducidos via `t()`

Props: `active: ViewPath`, `collapsed: boolean`, `onToggle: () => void`, `onNavigate: (v: ViewPath) => void`

### SettingsView

Vista de ajustes con sub-sidebar y contenido:

| Tab | Funcionalidad |
|-----|---------------|
| **General** | Selector de idioma (Español / English). Persiste en `localStorage` |
| **Modelos** | Gestor de modelos: rutas conocidas (ComfyUI, A1111, InvokeAI, DiffusionBee, LTX Studio, Fooocus), rutas personalizadas con escaneo inmediato, filtro por nombre, clasificación automática |
| **Apariencia** | Color picker RGBA para `--accent` (color + alpha + preview + reset). Persiste en `localStorage` |
| **Acerca de** | Versión de la aplicación |

## i18n (`src/i18n.tsx`)

Sistema de internacionalización mediante React context:

```typescript
// Provider — envuelve la app
<LangProvider initialLang="es">
  <App />
</LangProvider>

// Hook — en cualquier componente
const { t, lang, setLang } = useT();
t("Proyectos") // → "Proyectos" (es) / "Projects" (en)
```

El idioma se persiste automáticamente en `localStorage` bajo la clave `kaistu-lang`.

## Testing

16 tests con Vitest + React Testing Library + jsdom:

| Archivo | Tests | Lo que cubre |
|---------|-------|-------------|
| `TitleBar.test.tsx` | 5 | Render, botones de control, stats, menú hamburguesa |
| `Sidebar.test.tsx` | 5 | Items, colapso, click en navegación, botón settings |
| `SettingsView.test.tsx` | 6 | Render general, sidebar, cada tab (General, Modelos, Apariencia, Acerca de) |

```bash
npm run test                    # Una vez
npm run test -w apps/desktop test:watch  # Watch mode
```

## Estilos

- Dark theme vía CSS custom properties en `:root`
- `-webkit-app-region: drag` en la barra de título (no cascada — cada botón lleva `no-drag`)
- Tema oscuro con fondo `#0f0f11` y texto `#e8e8ed`
- Colores semánticos: `--success: #00e676`, `--warning: #ffd60a`, `--error: #ff453a`

## Desarrollo

```bash
# Iniciar con hot reload (requiere backend en puerto 8000)
npm run dev -w apps/desktop

# TypeScript check
npm run typecheck -w apps/desktop

# Tests
npm run test -w apps/desktop
```

El proceso main de Electron NO tiene hot reload — los cambios en `electron/main/` o `electron/preload/` requieren reiniciar el dev server.
