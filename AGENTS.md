# AGENTS.md

## ¿Qué es?

**KAISTU Studio** — plataforma de generación y edición con IA (texto, imagen, audio, video).

## Stack

| Capa | Tecnología |
|------|-----------|
| Desktop | Electron v43 + Vite v6.4 + React 19 + TypeScript 5.7 |
| Web | Next.js 15 (placeholder) |
| Backend | Python 3.14+ FastAPI + SQLAlchemy + SQLite |
| Type safety | `@kaistu/shared` (tipos compartidos) |
| Security | contextIsolation, preload bridge, CSP, Fernet encrypt |

## Estructura

```
kaistu-studio/
├── apps/
│   ├── desktop/          # electron-vite: main + preload + renderer (React)
│   └── web/              # Next.js (placeholder, sin implementar)
├── packages/
│   └── shared/           # Solo MenuAction (demo types eliminados)
├── backend/
│   └── app/              # FastAPI + routers (health, generation, api_keys)
├── mcp-server/           # MCP server — AI control via MCP protocol
│   ├── main.py           # Entry point stdio
│   ├── server.py         # FastMCP: tools + resources registration
│   ├── tools/            # models, system, backend, huggingface, civitai
│   └── resources/        # model list resource
├── opencode.jsonc        # MCP server registration (auto-start)
└── skills/               # Skills de OpenCode (no tocar)
```

## Comandos esenciales

```powershell
# Backend (puerto 8000)
cd backend && py -m uvicorn app.main:app --reload --port 8000

# Desktop (puerto 5173, abre Electron)
npm run dev:desktop

# Typecheck + build
npm run typecheck
npm run build -w apps/desktop

# Tests
npm run test -w apps/desktop

# MCP server (standalone)
cd mcp-server && pip install -r requirements.txt && py main.py
```

## Arquitectura de comunicación

```
Renderer (React) ──IPC (contextBridge)──> Main Process ──HTTP──> Python FastAPI
                                                                     │
                                                          ┌──────────┼──────────┐
                                                     SQLite (DB)  config.json  model-paths.json
                                                                     ▲            ▲
                                                                     │  HTTP      │  HTTP
                                                               MCP Server ────────┘
```

- `electronAPI` expuesto via `contextBridge` en `electron/preload/index.ts`
- IPC handlers en `electron/main/index.ts` hacen fetch al backend
- MCP server también delega al backend (modelos, config, api keys)
- Backend es la única fuente de verdad para datos persistentes
- Nunca habilitar `nodeIntegration: true` en el renderer

## Componentes reutilizables (`src/components/`)

| Componente | Props clave | Uso |
|------------|-------------|-----|
| `IconButton` | `icon`, `label?`, `iconOnly?`, `iconClass?`, `className?` | Remplaza todos los `<button><span.icon/>{label}</button>` del proyecto. Acepta `className` para styling específico de cada zona. |
| `SettingsLayout` | `tabs[]`, `activeTab`, `onTabChange`, `breadcrumbCrumbs`, `rightPanel?` | Layout sidebar + content + breadcrumb + rightPanel opcional. Usado por `SettingsView` y `LibraryView`. |
| `Breadcrumb` | `crumbs: Crumb[]`, `onNavigate` | Navegación jerárquica, cada crumb con `label` y `tab` opcional. |
| `TitleBar` | `version?`, `sysStats?` | Barra frameless: menú, stats CPU/GPU/RAM, botones ventana. |
| `Sidebar` | `active`, `collapsed`, `onToggle`, `onNavigate` | Nav colapsable (52/220px). |
| `ErrorBoundary` | `children` | Captura errores, muestra botón reintentar. |

## Convenciones

- TypeScript strict mode con `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- Menú nativo del SO — no menu bar en React
- UI en tema oscuro (CSS custom properties en `App.css`)
- Botones: usar `IconButton` con `className` propio de la zona (ej: `className="nav-btn"`)
- Iconos: `material-symbols-outlined` self-hosted
- i18n: `useT()` hook, ES/EN maps
- Backend Python con type hints (PEP 484)
- Las skills están en `skills/` — cargar con `skill` tool cuando aplique
- **Antes de crear un componente nuevo, revisar `src/components/` primero**

## Utilitarios (`src/utils/`)

| Archivo | Exportaciones |
|---------|--------------|
| `format.ts` | `formatFileSize`, `formatCount`, `formatParams`, `formatGB`, `cpuStatLevel` |
| `clipboard.ts` | `copyToClipboard` |

## MCP Server Tools (disponibles para IA vía MCP)

| Tool | Qué hace |
|------|----------|
| `scan_models(paths)` | Escanea directorios en busca de modelos |
| `discover_model_paths()` | Auto-descubre carpetas de modelos (ComfyUI, A1111, etc.) |
| `get_model_paths()` / `set_model_paths(paths)` | Gestiona rutas guardadas |
| `reveal_model(path)` / `delete_model(path)` | Abre en Explorer / mueve a papelera |
| `get_system_stats()` | CPU, RAM, GPU stats |
| `run_terminal(command)` | Ejecuta comando shell |
| `backend_health()` | Estado del backend FastAPI |
| `list_api_keys()` / `save_api_key()` / `delete_api_key()` | CRUD de API keys |
| `search_huggingface(query)` | Busca en HF Hub |
| `search_civitai(query)` | Busca en Civitai |
| `kaistu://models/list` (resource) | Lista todos los modelos escaneados |

Registrado en `opencode.jsonc` — arranca automáticamente con opencode.

## Skills instaladas (referencia rápida)

| Skill | Para qué |
|-------|----------|
| `typescript-pro` | Tipos avanzados, branded types, tsconfig |
| `react-expert` | Componentes, hooks, Server Components |
| `python-pro` | Backend tipado, async, pytest |
| `api-designer` | OpenAPI 3.1, REST, versionado |
| `sql-pro` | Optimización SQL, índices, CTEs |
| `secure-code-guardian` | Auth, validación, OWASP |
| `security-reviewer` | Auditorías, SAST, reportes |
| `terminalskills-electron` | Electron IPC, contextBridge, packaging |
| `huggingface-best` | Búsqueda del mejor modelo para una tarea (benchmarks, rank, filtro por dispositivo) |
| `huggingface-hub` | HF Hub API, Python/JS SDKs, Spaces, Inference Providers, datasets, webhooks |

## Work Log

- Sidebar: ByTheFace con emoji 🤗, eliminado menú Generación
- ByTheFaceView: Breadcrumb + select de Spaces HF + banner de advertencia
- IconButton: soporta emojis (detector de unicode)
- TextView: integrado como Huggingface Recommendations en panel amarillo
- Backend: `/models/hf-text-leaderboard` - top text-generation models
- Typos i18n limpiados
- Todos los botones: migrados a `IconButton`
- Componentes reutilizables: IconButton, SettingsLayout, Breadcrumb
- Unificación: `model-paths.json` y `config.json` en `%APPDATA%/kaistu-studio/`
- Code muerto eliminado (MODEL_EXTENSIONS, FOLDER_TYPE_MAP, etc.)

## Próximos pasos

- ByTheFace: formulario real para Qwen Image Edit 2511 y más Spaces
- BBDD de Spaces con configuración (inputs, ejemplos)
- Generación real en backend
