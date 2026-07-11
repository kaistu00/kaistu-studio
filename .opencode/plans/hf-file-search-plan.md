# Plan: Prioridad absoluta archivo exacto en HuggingFace

## Archivos a modificar

### 1. `apps/desktop/electron/main/index.ts` (handler search-hf-model)

Reemplazar el bloque de scoring (líneas 732-762) con:

```typescript
// Score each result by similarity to the query, with exact file priority
   for (const m of data) {
     try {
       const detail: any = await hfFetch(`/api/models/${m.id}`);
       const siblings = detail?.siblings ?? [];
       const hasExactFile = siblings.some((s: any) => s.rfilename === nameNoExt);
       if (hasExactFile) {
         m._score = 999999; // Absolute priority
       } else {
         m._score = similarity(nameNoExt, m.id) + similarity(nameNoExt, m.id.split("/").pop() ?? "");
       }
       m._files = siblings.filter((s: any) => /\.(safetensors|ckpt|gguf|pt|pth)$/i.test(s.rfilename));
     } catch {
       m._score = similarity(nameNoExt, m.id) + similarity(nameNoExt, m.id.split("/").pop() ?? "");
       m._files = [];
     }
   }
   const scored = data.sort((a: any, b: any) => b._score - a._score).slice(0, 5);

   const enriched: Array<{
     id: string; downloads: number; likes: number; pipeline_tag: string;
     description: string; tags: string[]; author: string; safetensors: number | null;
     license: string; cardData: any; files: string[];
   }> = [];
   for (const m of scored) {
     enriched.push({
       id: m.id,
       downloads: m.downloads ?? 0,
       likes: m.likes ?? 0,
       pipeline_tag: m.pipeline_tag ?? "",
       description: m._cardData?.description ?? m._cardData?.summary ?? "",
       tags: m.tags ?? [],
       author: m.id.split("/")[0] ?? "",
       safetensors: m?.safetensors?.total ?? null,
       license: m?._cardData?.license ?? "",
       cardData: m?._cardData ?? null,
       files: m._files ?? [],
     });
   }
```

### 2. `apps/desktop/electron/preload/index.ts`

Añadir `files` a la interface:

```typescript
export interface HFModelResult {
   primary: {
     id: string;
     downloads: number;
     likes: number;
     pipeline_tag: string;
     description: string;
     tags: string[];
     author: string;
     safetensors: number | null;
     license: string;
     cardData: any;
     files: string[];
   } | null;
   secondary: Array<{
     id: string; downloads: number; likes: number; pipeline_tag: string;
     description: string; tags: string[]; author: string; safetensors: number | null;
     license: string; cardData: any; files: string[];
   }>;
   variants: string[];
 }
```

### 3. `apps/desktop/src/components/LibraryView.tsx`

En ModelDetailPanel, después del título HF, reemplazar la sección de variantes con:

```tsx
{!hfLoading && !hfError && primary && (
  <div className="model-detail-hf-found model-detail-hf-from-hf">
    {/* ... existing header ... */}
    {primary.files.length > 0 ? (
      <>
        <a className="model-detail-hf-title" href={`https://huggingface.co/${primary.id}`} ...>
          {primary.id}
        </a>
        <div className="model-detail-hf-files">
          <span className="model-detail-hf-stat-label">{t("Archivos disponibles:")}</span>
          {primary.files.map((f) => (
            <a key={f} className="model-detail-hf-download-link" href={`https://huggingface.co/${primary.id}/resolve/main/${f}`} ...>
              <span className="material-symbols-outlined model-detail-hf-external">download</span>
              {f}
            </a>
          ))}
        </div>
      </>
    ) : (
      <div className="model-detail-hf-notfound">
        <span className="material-symbols-outlined model-detail-hf-sad">sentiment_dissatisfied</span>
        <span className="model-detail-hf-notfound-text">{t("No se ha encontrado el archivo exacto")}</span>
      </div>
    )}
    {/* ... existing stats ... */}
  </div>
)}
```

## Traducciones a añadir

ES: "Archivos disponibles:", "No se ha encontrado el archivo exacto"
EN: "Available files:", "Exact file not found"