# `@kaistu/trpc` — tRPC Router

> Definiciones de router tRPC compartidas entre desktop y web.
> Los handlers son inyectados por el runtime (Electron main process o Next.js API route).

## Dependencias

- `@kaistu/shared` — tipos compartidos
- `@trpc/server` ^11.0.0
- `zod` ^3.24.0

## Router

```typescript
export const appRouter = t.router({
  generate: t.procedure
    .input(GenerationInput)
    .mutation(({ input }) => { /* inyectado por el runtime */ }),

  health: t.procedure
    .query(() => ({ status: "unknown" })),
});
```

### Input: `generate`

```typescript
const GenerationInput = z.object({
  prompt: z.string().min(1).max(10000),
  mediaType: z.enum(["text", "image", "audio", "video"]),
  options: z.record(z.unknown()).optional(),
});
```

## Type export

```typescript
export type AppRouter = typeof appRouter;
```

Usado por el cliente tRPC (`@trpc/client` + `@trpc/react-query`) para type safety end-to-end.

## Próximos pasos

- [ ] Implementar handlers reales en el main process de Electron
- [ ] Implementar handlers en Next.js API routes
- [ ] Conectar con TanStack React Query en el renderer
