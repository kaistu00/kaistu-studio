# `@kaistu/shared` — Tipos Compartidos

> TypeScript types compartidos entre desktop, web y backend.

## Uso

```typescript
import type { MediaType, GenerationRequest, MenuAction } from "@kaistu/shared";
```

## Tipos

### `MediaType`

```typescript
type MediaType = "text" | "image" | "audio" | "video";
```

### `GenerationStatus`

```typescript
type GenerationStatus = "idle" | "generating" | "done" | "error";
```

### `GenerationRequest`

```typescript
interface GenerationRequest {
  prompt: string;
  mediaType: MediaType;
  options?: Record<string, unknown>;
}
```

### `GenerationResult`

```typescript
interface GenerationResult {
  id: string;
  prompt: string;
  mediaType: MediaType;
  outputUrl?: string;
  status: GenerationStatus;
  error?: string;
  createdAt: string;
}
```

### `Project`

```typescript
interface Project {
  id: string;
  name: string;
  mediaType: MediaType;
  content: GenerationResult[];
  createdAt: string;
  updatedAt: string;
}
```

### `UserSettings`

```typescript
interface UserSettings {
  theme: "light" | "dark" | "system";
  language: string;
  projectsDir: string;
  backendUrl: string;
}
```

### `MenuAction`

```typescript
type MenuAction =
  | "new-project" | "open-project" | "save" | "save-as" | "export"
  | "undo" | "redo" | "cut" | "copy" | "paste" | "select-all"
  | "preferences" | "toggle-dev-tools" | "reload" | "about";
```

## Scripts

```bash
npm run typecheck -w packages/shared
```
