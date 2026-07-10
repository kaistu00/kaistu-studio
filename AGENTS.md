# AGENTS.md

## ¿Qué es?

**KAISTU Studio** — plataforma de generación y edición con IA (texto, imagen, audio, video).

## Stack

| Capa | Tecnología |
|------|-----------|
| Desktop | Electron + Vite + React 19 + TypeScript 5.7 |
| Web | Next.js 15 (placeholder) |
| Backend | Python 3.14+ FastAPI + SQLAlchemy + SQLite |
| Type safety | tRPC 11, Zod, `@kaistu/shared` (tipos compartidos) |
| Security | contextIsolation, preload bridge, CSP |

## Estructura

```
kaistu-studio/
├── apps/
│   ├── desktop/          # electron-vite: main + preload + renderer (React)
│   └── web/              # Next.js (pendiente de implementar)
├── packages/
│   ├── shared/           # Tipos TS compartidos (MenuAction, MediaType, etc.)
│   └── trpc/             # Definiciones de router tRPC (handlers inyectados por el runtime)
├── backend/
│   └── app/              # FastAPI + routers (health, generation)
└── skills/               # Skills de OpenCode (no tocar)
```

## Comandos esenciales

```bash
# Backend (puerto 8000)
cd backend && py -m uvicorn app.main:app --reload --port 8000

# Desktop (puerto 5173, abre Electron)
npm run dev:desktop              # desde la raíz
npm run dev -w apps/desktop      # desde cualquier lado

# Typecheck completo
npm run typecheck

# Web (cuando esté implementado)
npm run dev -w apps/web
```

Flujo de desarrollo recomendado: iniciar backend primero, luego desktop.

## Arquitectura de comunicación

```
Renderer (React) ──IPC (contextBridge)──> Main Process ──HTTP──> Python FastAPI
                                                                    │
                                                              SQLite (DB)
```

- `electronAPI` expuesto via `contextBridge` en `electron/preload/index.ts`
- IPC handlers en `electron/main/index.ts` hacen fetch al backend
- Nunca habilitar `nodeIntegration: true` en el renderer

## Convenciones

- TypeScript strict mode con `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- Menú nativo del SO (Archivo/Editar/Ver/Herramientas/Ayuda) — no menu bar en React
- UI en tema oscuro (CSS custom properties en `App.css`)
- Backend Python con type hints (PEP 484)
- Las skills están en `skills/` — cargar con `skill` tool cuando aplique

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

## Próximos pasos (cuando se retome)

1. Implementar `apps/web/` con Next.js App Router
2. Conectar tRPC real (server en main process o Next.js API route)
3. Agregar modelos SQLAlchemy + Alembic migrations
4. Integrar APIs de IA (texto, imagen, audio, video)
5. Configurar `electron-builder` para distribuir
