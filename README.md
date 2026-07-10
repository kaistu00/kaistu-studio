# KAISTU Studio

> AI-powered content creation platform for text, image, audio, and video.

**Status:** Early development · **Version:** 0.1.0

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| `apps/desktop` | Electron + React 19 desktop client | [📖 README](./apps/desktop/README.md) |
| `apps/web` | Next.js web client (placeholder) | — |
| `backend/` | Python FastAPI + SQLite server | [📖 README](./backend/README.md) |
| `packages/shared` | Shared TypeScript types (`MediaType`, `Project`, `MenuAction`, etc.) | [📖 README](./packages/shared/README.md) |
| `packages/trpc` | tRPC router definitions (Zod schemas + procedures) | [📖 README](./packages/trpc/README.md) |

## Quick start

```bash
# Backend (terminal 1)
cd backend
py -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000

# Desktop (terminal 2)
npm install
npm run dev:desktop
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:desktop` | Start desktop app (Vite + Electron HMR) |
| `npm run dev:backend` | Start Python backend |
| `npm run dev` | Start both |
| `npm run build` | Build desktop for distribution |
| `npm run typecheck` | TypeScript check (desktop + shared) |
| `npm run test` | Run all tests (Vitest) |

## Architecture

```
Renderer (React) ─── IPC (contextBridge) ───> Main Process ─── HTTP ───> Python FastAPI
                                                                               │
                                                                          SQLite (DB)
```

- **Renderer:** React 19 SPA with Vite HMR, dark theme, i18n
- **Main process:** Electron node process, IPC handlers, native menus, system stats, model scanning
- **Preload:** `contextBridge` exposing `window.electronAPI` (no `nodeIntegration`)
- **Backend:** FastAPI with SQLAlchemy + SQLite, CORS for dev origins

## Testing

16 tests across 3 test files — Vitest + React Testing Library + jsdom:

```bash
npm run test
```

## Conventions

- TypeScript strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Menú nativo del SO (no menu bar en React)
- Dark theme via CSS custom properties
- i18n via React context (`LangProvider` + `useT()` hook)
- User preferences in `localStorage`
- Material Symbols self-hosted (no CDN)
