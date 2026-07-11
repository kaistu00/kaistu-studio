# KAISTU Studio

> AI-powered content creation platform for text, image, audio, and video.

**Status:** Early development · **Version:** 0.1.0

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| `apps/desktop` | Electron v43 + React 19 desktop client | [📖 README](./apps/desktop/README.md) |
| `apps/web` | Next.js 15 web client (placeholder) | — |
| `backend/` | Python 3.14+ FastAPI + SQLAlchemy + SQLite | [📖 README](./backend/README.md) |
| `mcp-server/` | MCP server for AI control (opencode, Claude, Cursor) | [📖 README](./mcp-server/README.md) |
| `packages/shared` | Shared TypeScript types (`MenuAction`) | [📖 README](./packages/shared/README.md) |

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

- **Renderer:** React 19 SPA with Vite HMR, dark theme, i18n (ES/EN)
- **Main process:** Electron node process, IPC handlers, native menus, system stats, model scanning
- **Preload:** `contextBridge` exposing `window.electronAPI` (no `nodeIntegration`)
- **Backend:** FastAPI with SQLAlchemy + SQLite, CORS for dev origins, Fernet-encrypted API keys

## Components (Desktop)

| Component | Description |
|-----------|-------------|
| `TitleBar` | Frameless title bar: hamburger menu, system stats (CPU/RAM/GPU), window controls |
| `Sidebar` | Collapsible navigation (52/220px) across views |
| `IconButton` | Unified icon+label button, replaces all raw `<button>` usage |
| `SettingsLayout` | Reusable layout: sidebar tabs + breadcrumb + content + optional right panel |
| `Breadcrumb` | Hierarchical navigation with clickable crumbs |
| `SettingsView` | App settings: General (lang), Models (paths/scan), Appearance (accent color), About |
| `LibraryView` | Model library: browse by type, HF/Civitai detail panel, delete/reveal |
| `ErrorBoundary` | Error boundary with retry button |

## MCP Server

KAISTU Studio ships with a Python [MCP](https://modelcontextprotocol.io) server that lets any MCP-compatible AI assistant control the application:

```
opencode / Claude Desktop / Cursor ── MCP (stdio) ──> mcp-server/
                                                       ├── models (scan, discover, reveal, delete)
                                                       ├── system (stats, terminal)
                                                       ├── backend (health, api keys)
                                                       ├── huggingface (HF Hub search)
                                                       └── civitai (model search)
```

**`opencode.jsonc`** already registers the MCP server — it starts automatically when opencode launches.

## Conventions

- TypeScript strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Native OS menus — no React menu bar
- Dark theme via CSS custom properties
- i18n via React context (`LangProvider` + `useT()` hook)
- User preferences in `localStorage`
- Material Symbols self-hosted (no CDN)
- All buttons use `IconButton` component
