import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { IconButton, SettingsLayout } from "./";
import { formatFileSize, formatCount, formatParams as fmtParams } from "../utils/format";
import { copyToClipboard } from "../utils/clipboard";
import { withCivitaiRef } from "../utils/civitai";
import { useCivitaiMode } from "../context/CivitaiMode";

type LibTab = "models" | "agentes" | "skills" | "workflows";

interface DiscoveredPath { label: string; path: string; }
interface ModelFile { name: string; path: string; type: string; sizeMB: number; software: string; }
interface HFModelResult {
  primary: {
    id: string; downloads: number; likes: number; pipeline_tag: string;
    description: string; tags: string[]; author: string; safetensors: number | null;
    license: string; cardData: any;
  } | null;
  secondary: Array<{
    id: string; downloads: number; likes: number; pipeline_tag: string;
    description: string; tags: string[]; author: string; safetensors: number | null;
    license: string; cardData: any;
  }>;
  variants: string[];
}

interface CivitaiModelResult {
  primary: {
    id: number;
    name: string;
    type: string;
    nsfw: boolean;
    description: string;
    tags: string[];
    downloadCount: number;
    thumbsUpCount: number;
    creator: { username: string };
    modelVersions: Array<{
      id: number;
      name: string;
      baseModel?: string;
      downloadUrl: string;
      trainedWords?: string[];
      files: Array<{ name: string; primary: boolean }>;
      images: Array<{ url: string; meta?: { width?: number; height?: number } }>;
    }>;
  } | null;
  secondary: Array<{
    id: number;
    name: string;
  }>;
}

const LIB_TABS: Array<{ id: LibTab; label: string; icon: string }> = [
  { id: "models", label: "Modelos", icon: "model_training" },
  { id: "agentes", label: "Agentes", icon: "smart_toy" },
  { id: "skills", label: "Skills", icon: "psychology" },
  { id: "workflows", label: "Workflows", icon: "account_tree" },
];

const TYPE_TABS: Array<{ id: string; labelKey: string; icon: string; descKey: string; tipKey: string }> = [
  { id: "all", labelKey: "Todas", icon: "select_all", descKey: "", tipKey: "" },
  { id: "checkpoint", labelKey: "Checkpoints", icon: "model_training", descKey: "checkpoint-desc", tipKey: "checkpoint-tip" },
  { id: "diffusion_models", labelKey: "Diffusion Models", icon: "model_training", descKey: "diffusion_models-desc", tipKey: "diffusion_models-tip" },
  { id: "unet", labelKey: "UNet", icon: "grid_view", descKey: "unet-desc", tipKey: "unet-tip" },
  { id: "vae", labelKey: "VAE", icon: "auto_fix", descKey: "vae-desc", tipKey: "vae-tip" },
  { id: "lora", labelKey: "LoRA", icon: "tune", descKey: "lora-desc", tipKey: "lora-tip" },
  { id: "clip", labelKey: "CLIP", icon: "text_fields", descKey: "clip-desc", tipKey: "clip-tip" },
  { id: "text_encoder", labelKey: "Text Encoders", icon: "text_fields", descKey: "text_encoder-desc", tipKey: "text_encoder-tip" },
  { id: "clip_vision", labelKey: "CLIP Vision", icon: "image", descKey: "clip_vision-desc", tipKey: "clip_vision-tip" },
  { id: "controlnet", labelKey: "ControlNet", icon: "control_point", descKey: "controlnet-desc", tipKey: "controlnet-tip" },
  { id: "upscaler", labelKey: "Upscale Models", icon: "scale", descKey: "upscaler-desc", tipKey: "upscaler-tip" },
  { id: "embedding", labelKey: "Embeddings", icon: "texture", descKey: "embedding-desc", tipKey: "embedding-tip" },
  { id: "style_model", labelKey: "Style Models", icon: "palette", descKey: "style_model-desc", tipKey: "style_model-tip" },
  { id: "gligen", labelKey: "GLIGEN", icon: "view_comfy", descKey: "gligen-desc", tipKey: "gligen-tip" },
  { id: "hypernetwork", labelKey: "Hypernetworks", icon: "flash_on", descKey: "hypernetwork-desc", tipKey: "hypernetwork-tip" },
  { id: "inpaint", labelKey: "Inpaint", icon: "brush", descKey: "inpaint-desc", tipKey: "inpaint-tip" },
  { id: "other", labelKey: "Other", icon: "description", descKey: "other-desc", tipKey: "other-tip" },
];

function ModelDetailPanel({ model, onClose }: { model: ModelFile; onClose: () => void }) {
  const { t } = useT();
  const { mode } = useCivitaiMode();
  const [hfData, setHfData] = useState<HFModelResult | null>(null);
  const [hfLoading, setHfLoading] = useState(true);
  const [hfError, setHfError] = useState(false);
  const primary = hfData?.primary;
  const [civitaiData, setCivitaiData] = useState<CivitaiModelResult | null>(null);
  const [civitaiLoading, setCivitaiLoading] = useState(true);
  const [civitaiError, setCivitaiError] = useState(false);
  const [civitaiKey, setCivitaiKey] = useState(true);
  const [civitaiSelVersion, setCivitaiSelVersion] = useState<string>("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showTip = useCallback((text: string, e: React.MouseEvent) => {
    clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTip({ text, x: e.clientX, y: e.clientY }), 400);
  }, []);
  const hideTip = useCallback(() => {
    clearTimeout(tipTimer.current);
    setTip(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHfLoading(true);
    setHfError(false);
    setHfData(null);
    const nameNoExt = model.name.replace(/\.[^.]+$/, "");
    window.electronAPI?.searchHFModel(nameNoExt).then((result) => {
      if (cancelled) return;
      setHfData(result);
      setHfLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setHfError(true);
      setHfLoading(false);
    });
    return () => { cancelled = true; };
  }, [model.name]);

  useEffect(() => {
    let cancelled = false;
    setCivitaiLoading(true);
    setCivitaiError(false);
    setCivitaiData(null);
    const nameNoExt = model.name.replace(/\.[^.]+$/, "");
    window.electronAPI?.searchCivitaiModel(nameNoExt, mode === "nsfw").then((result) => {
      if (cancelled) return;
      setCivitaiData(result);
      setCivitaiLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setCivitaiError(true);
      setCivitaiLoading(false);
    });
    return () => { cancelled = true; };
  }, [model.name]);

  useEffect(() => {
    window.electronAPI?.getAPIKeys?.().then((keys) => {
      setCivitaiKey(keys.some((k) => k.service === "civitai"));
    }).catch(() => {});
  }, []);

  const formatDownloads = formatCount;

  return (
    <div className="model-detail-sidebar">
      <div className="model-detail-header">
        <span className="material-symbols-outlined model-detail-icon">{TYPE_TABS.find((tt) => tt.id === model.type)?.icon ?? "description"}</span>
        <div className="model-detail-header-info">
          <div className="model-detail-name-row">
            <h3 className="model-detail-name">{model.name}</h3>
            <IconButton icon="content_copy" iconOnly className="model-detail-copy-btn model-detail-copy-name" onClick={() => copyToClipboard(model.name)} />
          </div>
          <div className="model-detail-type-row">
            <span className="model-detail-type-label">{(TYPE_TABS.find((tt) => tt.id === model.type)?.labelKey ?? model.type)}</span>
            <span className="model-detail-size-inline">
              <span className="material-symbols-outlined model-detail-size-icon">storage</span>
              {formatFileSize(model.sizeMB)}
            </span>
          </div>
        </div>
        <IconButton icon="close" iconOnly className="settings-btn-sm model-detail-close" onClick={onClose} />
      </div>
      <div className="model-detail-body">
        <div className="model-detail-local-section">
          <div className="model-detail-path-box">
            <span className="material-symbols-outlined model-detail-path-icon">folder_open</span>
            <code className="model-detail-path">{model.path}</code>
            <IconButton icon="content_copy" iconOnly className="model-detail-copy-btn" onClick={() => copyToClipboard(model.path)} title={t("Copiar ruta")} />
          </div>
        </div>
        <div className="model-detail-divider" />
        <div className="model-detail-civitai-section">
           {civitaiLoading && (
             <div className="model-detail-civitai-loading">
               <span className="material-symbols-outlined model-detail-civitai-spin">sync</span>
               <span>{t("Buscando en Civitai...")}</span>
             </div>
           )}
           {civitaiError && (
             <div className="model-detail-civitai-error">
               <span className="material-symbols-outlined">cloud_off</span>
               <span>{t("Error al conectar con Civitai")}</span>
             </div>
           )}
             {!civitaiLoading && !civitaiError && !civitaiData && (
              civitaiKey ? (
                <div className="model-detail-civitai-notfound">
                  <span className="material-symbols-outlined model-detail-civitai-sad">sentiment_dissatisfied</span>
                  <span className="model-detail-civitai-notfound-text">NO SE HA ENCONTRADO EN CIVITAI</span>
                  <span className="model-detail-civitai-notfound-sub">{t("Prueba a buscar por otro nombre o el ID completo.")}</span>
                </div>
              ) : (
                <div className="model-detail-civitai-notfound">
                  <span className="material-symbols-outlined model-detail-civitai-sad">link_off</span>
                  <span className="model-detail-civitai-notfound-text">{t("Conecta tu API de Civitai")}</span>
                  <span className="model-detail-civitai-notfound-sub">{t("Sin API key de Civitai no podemos buscar ni descargar modelos.")}</span>
                  <a className="model-detail-civitai-link" href={withCivitaiRef("", mode)} target="_blank" rel="noopener noreferrer">
                    <span className="material-symbols-outlined model-detail-hf-external">open_in_new</span>
                    {t("Consigue tu API Key en Civitai")}
                  </a>
                  <span className="model-detail-civitai-notfound-sub">{t("Ve a Ajustes → Herramientas → Civitai Site API para conectarla.")}</span>
                </div>
              )
            )}
{!civitaiLoading && !civitaiError && civitaiData?.primary && (() => {
               const p = civitaiData.primary!;
               const versions = p.modelVersions ?? [];
               const selectedVersion = versions.find(v => v.id.toString() === civitaiSelVersion) ?? versions[0];
               const galleryImages = (selectedVersion?.images ?? []).map(img => img.url);
               return (
               <div className="model-detail-hf-found model-detail-hf-from-civitai">
                 <div className="model-detail-hf-header">
                    <span className={"material-symbols-outlined model-detail-civitai-logo" + (mode === "nsfw" ? " civitai-nsfw-icon" : "")} style={{ color: "#3b82f6" }}>extension</span>
                   <span className="model-detail-hf-header-text">{t("Civitai Site API")}</span>
                 </div>
                 <a className="model-detail-hf-title" href={withCivitaiRef(`/models/${p.id}`, mode)} target="_blank" rel="noopener noreferrer">
                   <span className="material-symbols-outlined model-detail-hf-external">open_in_new</span>
                   {p.name}
                 </a>
                 <div className="model-detail-civitai-meta">
                   {p.type && (
                     <span className="model-detail-civitai-meta-item">
                       <span className="material-symbols-outlined">category</span>{p.type}
                     </span>
                   )}
                   {p.creator?.username && (
                     <span className="model-detail-civitai-meta-item">
                       <span className="material-symbols-outlined">person</span>{p.creator.username}
                     </span>
                   )}
                   {galleryImages.length > 0 && (
                     <IconButton icon="visibility" iconOnly className="model-detail-civitai-gallery-btn" onClick={() => setGalleryOpen(true)} title={t("Ver galería")} />
                   )}
                 </div>
                 {p.tags && p.tags.length > 0 && (
                   <div className="model-detail-hf-tags">
                     {p.tags.map((tag: string) => (
                       <span key={tag} className="model-detail-hf-tag">{tag}</span>
                     ))}
                   </div>
                 )}
                 {(() => {
                   const triggers = Array.from(new Set(versions.flatMap((v) => v.trainedWords ?? [])));
                   if (triggers.length === 0) return null;
                   return (
                     <div className="model-detail-civitai-triggers">
                       <span className="model-detail-civitai-triggers-label">{t("Trigger words:")}</span>
                       <div className="model-detail-hf-tags">
                         {triggers.map((tw: string) => (
                           <button key={tw} type="button" className="model-detail-hf-tag model-detail-civitai-trigger-chip model-detail-civitai-trigger-purple" title={t("Copiar trigger")} onClick={() => copyToClipboard(tw)}>
                             {tw}
                           </button>
                         ))}
                        </div>
                  </div>
               );
             })()}
                <div className="model-detail-civitai-versions">
                    <span className="model-detail-civitai-versions-label">{t("Versiones:")} <strong>{versions.length}</strong></span>
                    <div className="model-detail-civitai-version-row">
                      <select className="model-detail-civitai-version-select" value={civitaiSelVersion || (versions[0]?.id?.toString() ?? "")} onChange={(e) => setCivitaiSelVersion(e.target.value)}>
                        {versions.map((v) => (
                          <option key={v.id} value={v.id.toString()}>{v.name || `v${v.id}`}{v.baseModel ? ` • ${v.baseModel}` : ""}</option>
                        ))}
                      </select>
                      <a className="model-detail-civitai-download-btn" href={withCivitaiRef(selectedVersion?.downloadUrl || "", mode)} target="_blank" rel="noopener noreferrer">
                        <span className="material-symbols-outlined">download</span>
                        {t("Descargar")}
                      </a>
                    </div>
                  </div>
               </div>
               );
             })()}
              {galleryOpen && civitaiData?.primary && (() => {
                const p = civitaiData.primary!;
                const versions = p.modelVersions ?? [];
                const creator = p.creator?.username;
                const allImages = versions.flatMap(v =>
                  (v.images ?? []).map(img => ({
                    url: img.url,
                    versionName: v.name,
                    baseModel: v.baseModel,
                    versionId: v.id,
                    trainedWords: v.trainedWords ?? [],
                  }))
                );
                const current = allImages[currentGalleryIndex];
                return (
                  <div className="model-detail-civitai-gallery-overlay" onClick={() => setGalleryOpen(false)}>
                    <div className="model-detail-civitai-gallery-content" onClick={(e) => e.stopPropagation()}>
                      <div className="model-detail-civitai-gallery-header">
                        <span className="model-detail-civitai-gallery-title">{t("Galería de imágenes")}</span>
                        {currentGalleryIndex >= 0 && (
                          <IconButton icon="grid_view" iconOnly className="model-detail-civitai-gallery-grid-btn" onClick={() => { setCurrentGalleryIndex(-1); setIsFullscreen(false); }} title={t("Ver cuadrícula")} />
                        )}
                        <IconButton icon="close" iconOnly className="model-detail-civitai-gallery-close" onClick={() => setGalleryOpen(false)} />
                      </div>
                      {currentGalleryIndex < 0 ? (
                        <div className="model-detail-civitai-gallery-grid">
                          {allImages.map((img, i) => (
                            <div key={i} className="model-detail-civitai-gallery-grid-item" onClick={(e) => { e.stopPropagation(); setCurrentGalleryIndex(i); }}>
                              <img src={img.url} alt={`thumb-${i}`} className="model-detail-civitai-gallery-grid-thumb" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="model-detail-civitai-gallery-viewer">
                            <div className="model-detail-civitai-gallery-nav model-detail-civitai-gallery-nav-prev" onClick={(e) => {
                              e.stopPropagation();
                              setCurrentGalleryIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
                            }}>
                              <span className="material-symbols-outlined model-detail-civitai-gallery-nav-icon">chevron_left</span>
                            </div>
                            <div className={"model-detail-civitai-gallery-image-wrap" + (isFullscreen ? " fullscreen" : "")}>
                              {(() => {
                                const cur = allImages[currentGalleryIndex];
                                return cur ? (
                                  <img
                                    src={cur.url}
                                    alt={`gallery-${currentGalleryIndex}`}
                                    className={"model-detail-civitai-gallery-image" + (isFullscreen ? " fullscreen" : "")}
                                    onClick={() => setIsFullscreen(v => !v)}
                                  />
                                ) : (
                                  <span className="model-detail-civitai-gallery-empty">{t("Sin imágenes")}</span>
                                );
                              })()}
                            </div>
                            <div className="model-detail-civitai-gallery-nav model-detail-civitai-gallery-nav-next" onClick={(e) => {
                              e.stopPropagation();
                              setCurrentGalleryIndex((prev) => (prev + 1) % allImages.length);
                            }}>
                              <span className="material-symbols-outlined model-detail-civitai-gallery-nav-icon">chevron_right</span>
                            </div>
                          </div>
                          {(() => {
                            const cur = allImages[currentGalleryIndex];
                            if (!cur) return null;
                            return (
                              <div className="model-detail-civitai-gallery-meta">
                                <div className="model-detail-civitai-gallery-meta-row">
                                  <span className="material-symbols-outlined model-detail-civitai-gallery-meta-icon">photo</span>
                                  <span>{currentGalleryIndex + 1} / {allImages.length}</span>
                                </div>
                                {cur.baseModel && (
                                  <div className="model-detail-civitai-gallery-meta-row">
                                    <span className="material-symbols-outlined model-detail-civitai-gallery-meta-icon">layers</span>
                                    <span>{cur.baseModel}</span>
                                  </div>
                                )}
                                {cur.trainedWords.length > 0 && (
                                  <div className="model-detail-civitai-gallery-meta-row">
                                    <span className="material-symbols-outlined model-detail-civitai-gallery-meta-icon">tag</span>
                                    <span>{cur.trainedWords.join(", ")}</span>
                                  </div>
                                )}
                                {creator && (
                                  <div className="model-detail-civitai-gallery-meta-row">
                                    <span className="material-symbols-outlined model-detail-civitai-gallery-meta-icon">person</span>
                                    <span>{creator}</span>
                                  </div>
                                )}
                                <a className="model-detail-civitai-gallery-meta-row model-detail-civitai-gallery-meta-link" href={withCivitaiRef(`/models/${p.id}?modelVersionId=${cur.versionId}`, mode)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                  <span className="material-symbols-outlined model-detail-civitai-gallery-meta-icon">open_in_new</span>
                                  <span>{t("Ver en Civitai")}</span>
                                </a>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
          </div>
          <div className="model-detail-hf-section">
          {hfLoading && (
            <div className="model-detail-hf-loading">
              <span className="material-symbols-outlined model-detail-hf-spin">sync</span>
              <span>{t("Buscando en Hugging Face...")}</span>
            </div>
          )}
          {hfError && (
            <div className="model-detail-hf-error">
              <span className="material-symbols-outlined">cloud_off</span>
              <span>{t("Error al conectar con Hugging Face")}</span>
            </div>
          )}
          {!hfLoading && !hfError && !hfData && (
            <div className="model-detail-hf-notfound">
              <span className="material-symbols-outlined model-detail-hf-sad">sentiment_dissatisfied</span>
              <span className="model-detail-hf-notfound-text">{t("NO SE HA ENCONTRADO EN HUGGING FACE")}</span>
              <span className="model-detail-hf-notfound-sub">{t("Prueba a buscar por otro nombre o el ID completo.")}</span>
            </div>
          )}
          {!hfLoading && !hfError && primary && (
            <div className="model-detail-hf-found model-detail-hf-from-hf">
              <div className="model-detail-hf-header">
                <span className="model-detail-hf-emoji">🤗</span>
                <span className="model-detail-hf-header-text">Hugging Face</span>
              </div>
              <a className="model-detail-hf-title" href={`https://huggingface.co/${primary.id}`} target="_blank" rel="noopener noreferrer">
                <span className="material-symbols-outlined model-detail-hf-external">open_in_new</span>
                {primary.id}
              </a>
              {primary.description && <p className="model-detail-hf-desc">{primary.description}</p>}
              <div className="model-detail-hf-stats">
                <div className="model-detail-hf-stat">
                  <span className="material-symbols-outlined model-detail-hf-stat-icon">download</span>
                  <span className="model-detail-hf-stat-value">{formatDownloads(primary.downloads)}</span>
                  <span className="model-detail-hf-stat-label">{t("descargas")}</span>
                </div>
                <div className="model-detail-hf-stat">
                  <span className="material-symbols-outlined model-detail-hf-stat-icon">favorite</span>
                  <span className="model-detail-hf-stat-value">{primary.likes}</span>
                  <span className="model-detail-hf-stat-label">{t("me gusta")}</span>
                </div>
                {primary.safetensors && (
                  <div className="model-detail-hf-stat">
                    <span className="material-symbols-outlined model-detail-hf-stat-icon">memory</span>
                    <span className="model-detail-hf-stat-value">{fmtParams(primary.safetensors)}</span>
                    <span className="model-detail-hf-stat-label">{t("parámetros")}</span>
                  </div>
                )}
                {primary.license && (
                  <div className="model-detail-hf-stat">
                    <span className="material-symbols-outlined model-detail-hf-stat-icon">description</span>
                    <span className="model-detail-hf-stat-value model-detail-hf-license">{primary.license}</span>
                    <span className="model-detail-hf-stat-label">{t("licencia")}</span>
                  </div>
                )}
              </div>
              {primary.pipeline_tag && (
                <div className="model-detail-hf-tag-row">
                  <span className="model-detail-hf-pill">{primary.pipeline_tag}</span>
                </div>
              )}
              {primary.tags.length > 0 && (
                <div className="model-detail-hf-tags">
                  {primary.tags.filter((tag: string) => !tag.startsWith("license:") && tag !== primary.pipeline_tag).slice(0, 8).map((tag: string) => (
                    <span key={tag} className="model-detail-hf-tag">{tag}</span>
                  ))}
                </div>
              )}
              {hfData.variants.length > 0 && (
                <>
                  <div className="model-detail-divider" />
                  <div className="model-detail-section-title">
                    <span className="material-symbols-outlined" style={{ fontSize: "calc(16px * var(--font-scale))", marginRight: 6 }}>layers</span>
                    {t("Otras variantes")}
                  </div>
                  <div className="model-detail-hf-variants">
                    {hfData.variants.map((vid) => (
                      <a key={vid} className="model-detail-hf-variant" href={`https://huggingface.co/${vid}`} target="_blank" rel="noopener noreferrer">
                        <span className="material-symbols-outlined model-detail-hf-external">open_in_new</span>
                        {vid}
                      </a>
                    ))}
                  </div>
                </>
              )}
              {hfData.secondary.length > 0 && (
                <>
                  <div className="model-detail-divider" />
                  <div className="model-detail-section-title">
                    <span className="material-symbols-outlined" style={{ fontSize: "calc(16px * var(--font-scale))", marginRight: 6 }}>more_horiz</span>
                    {t("También encontrado")}
                  </div>
                  <div className="model-detail-hf-variants">
                    {hfData.secondary.map((s) => (
                      <a key={s.id} className="model-detail-hf-variant" href={`https://huggingface.co/${s.id}`} target="_blank" rel="noopener noreferrer">
                        <span className="material-symbols-outlined model-detail-hf-external">open_in_new</span>
                        {s.id}
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {!hfLoading && !hfError && hfData && !hfData.primary && hfData.secondary.length === 0 && hfData.variants.length === 0 && (
            <div className="model-detail-hf-notfound">
              <span className="material-symbols-outlined model-detail-hf-sad">sentiment_dissatisfied</span>
              <span className="model-detail-hf-notfound-text">NO SE HA ENCONTRADO EN HUGGING FACE</span>
              <span className="model-detail-hf-notfound-sub">{t("Prueba a buscar por otro nombre o el ID completo.")}</span>
            </div>
          )}
          {!hfLoading && !hfError && hfData && !hfData.primary && hfData.secondary.length > 0 && (
            <div className="model-detail-hf-found model-detail-hf-from-hf">
              <div className="model-detail-hf-header">
                <span className="model-detail-hf-emoji">🤗</span>
                <span className="model-detail-hf-header-text">Hugging Face</span>
              </div>
              <p className="model-detail-hf-desc" style={{ opacity: 0.7 }}>{t("No se encontró una coincidencia exacta, pero hay posibles resultados:")}</p>
              {hfData.secondary.map((s) => (
                <a key={s.id} className="model-detail-hf-variant" href={`https://huggingface.co/${s.id}`} target="_blank" rel="noopener noreferrer">
                  <span className="material-symbols-outlined model-detail-hf-external">open_in_new</span>
                  {s.id}
                </a>
              ))}
            </div>
          )}
          </div>
          {tip && <Tooltip tip={tip} hideTip={hideTip} />}
        </div>
      </div>
  );
}

function ModelsTab({ onSelectModel }: { onSelectModel: (m: ModelFile | null) => void }) {
  const { t } = useT();
  const [models, setModels] = useState<ModelFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "size" | "software">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedModel, setSelectedModel] = useState<ModelFile | null>(null);
  const [softwareFilter, setSoftwareFilter] = useState<Set<string>>(new Set());
  const [softwareFilterOpen, setSoftwareFilterOpen] = useState(false);
  const [searchOnlineOpen, setSearchOnlineOpen] = useState(false);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showTip = useCallback((text: string, e: React.MouseEvent) => {
    clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTip({ text, x: e.clientX, y: e.clientY }), 400);
  }, []);
  const hideTip = useCallback(() => {
    clearTimeout(tipTimer.current);
    setTip(null);
  }, []);

  // Sync selectedModel up to parent
  useEffect(() => { onSelectModel(selectedModel); }, [selectedModel, onSelectModel]);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.electronAPI?.discoverModelPaths().then((discovered) => {
        window.electronAPI?.getModelPaths().then((saved) => {
          const sources = [
            ...discovered.map((d) => ({ path: d.path, label: d.label })),
            ...saved.map((p) => ({ path: p, label: "" })),
          ];
          scan(sources);
        }).catch(() => {});
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const scan = useCallback(async (sources: Array<{ path: string; label: string }>) => {
    setScanning(true);
    try {
      const existing = sources.filter((s) => s.path);
      if (existing.length === 0) return;
      const found = await window.electronAPI?.scanModels(existing);
      setModels(found ?? []);
    } finally { setScanning(false); }
  }, []);

  const toggleSort = (field: "name" | "size" | "software") => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("asc"); }
  };

  const filtered = models.filter((m) => {
    const term = filter.toLowerCase();
    if (term && !m.name.toLowerCase().includes(term) &&
      !m.software.toLowerCase().includes(term) &&
      !m.path.toLowerCase().includes(term)) return false;
    if (softwareFilter.size > 0 && !softwareFilter.has(m.software)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") cmp = a.name.localeCompare(b.name);
    else if (sortBy === "software") cmp = a.software.localeCompare(b.software);
    else cmp = a.sizeMB - b.sizeMB;
    return sortDir === "asc" ? cmp : -cmp;
  });
  const totalSize = sorted.reduce((sum, m) => sum + m.sizeMB, 0);
  const grouped: Record<string, ModelFile[]> = {};
  for (const m of sorted) {
    let list = grouped[m.type];
    if (!list) {
      list = [];
      grouped[m.type] = list;
    }
    list.push(m);
  }
  const activeTab = TYPE_TABS.find((tt) => tt.id === activeType) ?? TYPE_TABS[0]!;
  const visibleTypes = activeType === "all" ? TYPE_TABS.slice(1) : TYPE_TABS.filter((tt) => tt.id === activeType);
  const hasItems = visibleTypes.some((tt) => {
    const list = grouped[tt.id];
    return list ? list.length > 0 : false;
  });
  const allSoftware = [...new Set(models.map(m => m.software).filter(Boolean))].sort();
  const toggleSoftware = (sw: string) => {
    setSoftwareFilter(prev => {
      const next = new Set(prev);
      if (next.has(sw)) next.delete(sw); else next.add(sw);
      return next;
    });
  };

  return (
    <div className="models-tab-layout">
      <div className="models-tab-main">
        <div className="search-online-bar">
          <IconButton icon="travel_explore" iconOnly={false} label={t("Buscar modelos online")} className="search-online-btn" onClick={() => setSearchOnlineOpen(true)} />
        </div>
        <div className="model-scan-bar">
          <span className="model-count">{sorted.length} {t("modelos")}</span>
          <span className="model-total-size">{formatFileSize(totalSize)}</span>
          <div className="model-sort-group">
            <IconButton icon="sort_by_alpha" iconOnly className={"model-sort-btn" + (sortBy === "name" ? " active" : "")} onClick={() => toggleSort("name")} title={t("Ordenar por nombre")}>
              {sortBy === "name" && <span className="model-sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </IconButton>
            <IconButton icon="straighten" iconOnly className={"model-sort-btn" + (sortBy === "size" ? " active" : "")} onClick={() => toggleSort("size")} title={t("Ordenar por tamaño")}>
              {sortBy === "size" && <span className="model-sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </IconButton>
            <IconButton icon="dns" iconOnly className={"model-sort-btn" + (sortBy === "software" ? " active" : "")} onClick={() => toggleSort("software")} title={t("Ordenar por software")}>
              {sortBy === "software" && <span className="model-sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </IconButton>
          </div>
          <div className="software-filter-wrap">
            <IconButton icon="apps" label={softwareFilter.size > 0 ? `${softwareFilter.size}` : t("Software")} iconOnly={false} className={"software-filter-btn" + (softwareFilterOpen ? " active" : "")} onClick={() => setSoftwareFilterOpen(v => !v)} />
            {softwareFilterOpen && (
              <div className="software-filter-dropdown" onMouseLeave={() => setSoftwareFilterOpen(false)}>
                {allSoftware.map(sw => (
                  <label key={sw} className="software-filter-option">
                    <input type="checkbox" checked={softwareFilter.has(sw)} onChange={() => toggleSoftware(sw)} />
                    <span>{sw}</span>
                  </label>
                ))}
                {allSoftware.length === 0 && <span className="software-filter-empty">{t("Sin software")}</span>}
              </div>
            )}
          </div>
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("Filtrar...")} className="path-input filter-input" />
        </div>
        <div className="model-type-tabs">
          {TYPE_TABS.map((tt) => {
            const count = tt.id === "all" ? filtered.length : (grouped[tt.id]?.length ?? 0);
            return (
              <IconButton key={tt.id} icon={tt.icon} label={t(tt.labelKey)} className={"model-type-tab" + (activeType === tt.id ? " active" : "")} onClick={() => setActiveType(tt.id)}>
                <span className="model-type-tab-count">{count}</span>
              </IconButton>
            );
          })}
        </div>
        {activeTab.descKey && (
          <div className="model-type-desc">
            <span>{t(activeTab.descKey)}</span>
            {activeTab.tipKey && (
              <span className="model-type-tip" onMouseEnter={(e) => showTip(t(activeTab.tipKey), e)} onMouseMove={(e) => { if (tip) setTip({ text: tip.text, x: e.clientX, y: e.clientY }); }} onMouseLeave={hideTip}>
                <span className="material-symbols-outlined model-type-tip-icon">help</span>
              </span>
            )}
          </div>
        )}
        {scanning && <p className="scanning-msg">Buscando modelos...</p>}
        <div className="model-grid">
          {visibleTypes.map((tt) => {
            const items = grouped[tt.id];
            if (!items || items.length === 0) return null;
            return (
              <div key={tt.id} className="model-group">
                <h4 className="model-group-title">
                  <span className="material-symbols-outlined model-type-tab-icon">{tt.icon}</span>
                  {t(tt.labelKey)}
                  <span className="model-group-count">{items.length} · {formatFileSize(items.reduce((sum, m) => sum + m.sizeMB, 0))}</span>
                </h4>
                <div className="model-items">
                  {items.map((m) => (
                    <div key={m.path} className={"model-item" + (selectedModel?.path === m.path ? " selected" : "")} data-tooltip={m.path} onClick={() => setSelectedModel(selectedModel?.path === m.path && selectedModel?.name === m.name ? null : m)}>
                      <span className="model-item-software model-item-software-inline">{m.software}</span>
                      <span className="model-item-name">{m.path.replace(/^.*?[/\\]models[/\\]/i, "models/").replace(/\\/g, "/")}</span>
                      <span className="model-item-size">{formatFileSize(m.sizeMB)}</span>
                      <span className="model-item-actions">
                        <IconButton icon="folder_open" iconOnly className="model-item-action model-item-reveal" onClick={(e) => { e.stopPropagation(); window.electronAPI?.revealInFolder(m.path); }} title={t("Abrir en carpeta")} />
                        <IconButton icon="delete" iconOnly className="model-item-action model-item-delete" onClick={(e) => { e.stopPropagation(); if (confirm(t("¿Eliminar este modelo?"))) { window.electronAPI?.deleteModel(m.path); setModels(models.filter(x => x.path !== m.path)); } }} title={t("Eliminar")} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {!scanning && !hasItems && (
          <p className="no-models">{t("Ningún modelo encontrado. Añade rutas y escanea.")}</p>
        )}
        {tip && <Tooltip tip={tip} hideTip={hideTip} />}
      </div>
      {searchOnlineOpen && <SearchOnlinePanel models={models} onClose={() => setSearchOnlineOpen(false)} />}
    </div>
  );
}

function SearchOnlinePanel({ models, onClose }: { models: ModelFile[]; onClose: () => void }) {
  const { t } = useT();
  const { mode } = useCivitaiMode();
  const [query, setQuery] = useState("");
  const [resultTab, setResultTab] = useState<"civitai" | "huggingface" | "local">("civitai");
  const [hfResults, setHfResults] = useState<any[] | null>(null);
  const [civitaiResults, setCivitaiResults] = useState<any[] | null>(null);
  const [hfLoading, setHfLoading] = useState(false);
  const [civitaiLoading, setCivitaiLoading] = useState(false);
  const [modelType, setModelType] = useState("checkpoint");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) { setHfResults(null); setCivitaiResults(null); return; }
    const q = query.trim();
    const hfTimer = setTimeout(() => {
      setHfLoading(true);
      window.electronAPI?.searchHFModel(q).then(data => {
        setHfResults(data?.secondary ?? (data?.primary ? [data.primary] : []));
      }).catch(() => setHfResults([])).finally(() => setHfLoading(false));
    }, 400);
    const civTimer = setTimeout(() => {
      setCivitaiLoading(true);
      window.electronAPI?.searchCivitaiModel(q, mode === "nsfw").then(data => {
        setCivitaiResults(data?.secondary ?? (data?.primary ? [data.primary] : []));
      }).catch(() => setCivitaiResults([])).finally(() => setCivitaiLoading(false));
    }, 400);
    return () => { clearTimeout(hfTimer); clearTimeout(civTimer); };
  }, [query]);

  const localResults = query.trim()
    ? models.filter(m => {
        const term = query.toLowerCase();
        return m.name.toLowerCase().includes(term) ||
          m.software.toLowerCase().includes(term) ||
          m.path.toLowerCase().includes(term);
      })
    : null;

  const handleDownload = async (url: string, filename: string) => {
    setDownloading(filename);
    try {
      const result = await window.electronAPI?.downloadModel(url, filename, modelType);
      if (result?.path) {
        setToast(t("Descargado en: {path}", { path: result.path }));
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      setToast(t("Error al descargar: {err}", { err: typeof err === "object" && err?.message ? err.message : String(err) }));
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDownloading(null);
    }
  };

  const getDownloadUrl = (item: any, source: "huggingface" | "civitai"): { url: string; filename: string } | null => {
    if (source === "huggingface") {
      const id = item.id;
      if (!id) return null;
      const files = item.files ?? [];
      const safetensorsFile = files.find((f: string) => f.endsWith(".safetensors"));
      const target = safetensorsFile ?? files[0];
      if (!target) return null;
      return {
        url: `https://huggingface.co/${id}/resolve/main/${target}`,
        filename: target.split("/").pop() ?? target,
      };
    }
    const versions = item.modelVersions ?? [];
    const version = versions[0];
    if (!version) return null;
    const primaryFile = version.files?.find((f: any) => f.primary);
    const target = primaryFile ?? version.files?.[0];
    if (!target) return null;
    return { url: version.downloadUrl || target.downloadUrl, filename: target.name };
  };

  const renderResults = (items: any[] | null, loading: boolean, source: "huggingface" | "civitai") => {
    if (loading) {
      return (
        <div className="search-online-loading">
          <span className="material-symbols-outlined search-online-spin">sync</span>
          <span>{t("Buscando...")}</span>
        </div>
      );
    }
    if (!items) return null;
    if (items.length === 0) {
      return <div className="search-online-empty">{t("Sin resultados")}</div>;
    }
    return items.map((item, i) => {
      const dl = getDownloadUrl(item, source);
      const name = item.name ?? item.id ?? `result-${i}`;
      const desc = item.description ?? "";
      return (
        <div key={item.id ?? i} className="search-online-result">
          {source === "civitai" ? (
            <span className="material-symbols-outlined search-online-source-badge" style={{ color: mode === "nsfw" ? "#ef4444" : "#3b82f6" }}>extension</span>
          ) : (
            <span className="search-online-source-badge">🤗</span>
          )}
          <div className="search-online-result-info">
            <span className="search-online-result-name">{name}</span>
            {desc && <span className="search-online-result-desc">{desc.slice(0, 120)}{desc.length > 120 ? "..." : ""}</span>}
          </div>
          <div className="search-online-result-actions">
            <a href={source === "huggingface" ? `https://huggingface.co/${item.id}` : withCivitaiRef(`/models/${item.id}`, mode)} target="_blank" rel="noopener noreferrer" className="search-online-result-link" title={t("Abrir en web")}>
              <span className="material-symbols-outlined">open_in_new</span>
            </a>
            {dl && (
              <button className="icon-btn icon-btn--icon-only search-online-dl-btn" title={t("Descargar")} onClick={() => handleDownload(dl.url, dl.filename)}>
                <span className={`material-symbols-outlined icon-btn-icon${downloading === dl.filename ? " search-online-spin" : ""}`}>
                  {downloading === dl.filename ? "sync" : "download"}
                </span>
              </button>
            )}
          </div>
        </div>
      );
    });
  };

  const renderLocalResults = () => {
    if (!query.trim()) return <div className="search-online-empty">{t("Escribe para buscar en modelos locales")}</div>;
    if (localResults === null) return null;
    if (localResults.length === 0) return <div className="search-online-empty">{t("Sin resultados locales")}</div>;
    return localResults.map(m => (
      <div key={m.path} className="search-online-result">
        <span className="material-symbols-outlined search-online-source-badge">folder</span>
        <div className="search-online-result-info">
          <span className="search-online-result-name">{m.name}</span>
          <span className="search-online-result-desc">{m.software} · {m.path.replace(/^.*?[/\\]models[/\\]/i, "models/").replace(/\\/g, "/")} · {formatFileSize(m.sizeMB)}</span>
        </div>
        <div className="search-online-result-actions">
          <button className="icon-btn icon-btn--icon-only search-online-dl-btn" title={t("Abrir en carpeta")} onClick={() => window.electronAPI?.revealInFolder(m.path)}>
            <span className="material-symbols-outlined icon-btn-icon">folder_open</span>
          </button>
        </div>
      </div>
    ));
  };

  const civCount = civitaiResults?.length ?? 0;
  const hfCount = hfResults?.length ?? 0;
  const localCount = localResults?.length ?? 0;

  return (
    <div className="search-online-overlay">
      <div className="search-online-panel" onClick={(e) => e.stopPropagation()}>
        <div className="search-online-header">
          <span className="material-symbols-outlined">travel_explore</span>
          <span>{t("Buscar modelos online")}</span>
          <IconButton icon="close" iconOnly className="search-online-close" onClick={onClose} />
        </div>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Buscar en HuggingFace, Civitai y modelos locales...")} className="search-online-input path-input" autoFocus />
        <div className="search-online-source-tabs">
          <button className={"search-online-source-tab" + (resultTab === "civitai" ? " active" : "")} onClick={() => setResultTab("civitai")}>
            <span className="material-symbols-outlined search-online-tab-icon">extension</span>
            Civitai{civitaiLoading ? <span className="material-symbols-outlined search-online-spin search-online-tab-spinner">sync</span> : civCount > 0 && <span className="search-online-tab-count">{civCount}</span>}
          </button>
          <button className={"search-online-source-tab" + (resultTab === "huggingface" ? " active" : "")} onClick={() => setResultTab("huggingface")}>
            <span className="search-online-tab-icon">🤗</span>
            HuggingFace{hfLoading ? <span className="material-symbols-outlined search-online-spin search-online-tab-spinner">sync</span> : hfCount > 0 && <span className="search-online-tab-count">{hfCount}</span>}
          </button>
          <button className={"search-online-source-tab" + (resultTab === "local" ? " active" : "")} onClick={() => setResultTab("local")}>
            <span className="material-symbols-outlined search-online-tab-icon">folder</span>
            Local{localCount > 0 && <span className="search-online-tab-count">{localCount}</span>}
          </button>
        </div>
        <div className="search-online-results">
          {resultTab === "civitai" && renderResults(civitaiResults, civitaiLoading, "civitai")}
          {resultTab === "huggingface" && renderResults(hfResults, hfLoading, "huggingface")}
          {resultTab === "local" && renderLocalResults()}
        </div>
        {toast && <div className="search-online-toast">{toast}</div>}
      </div>
    </div>
  );
}

const Tooltip = ({ tip, hideTip }: { tip: { text: string; x: number; y: number } | null; hideTip: () => void }) => {
  if (!tip) return null;
  return (
    <div
      className="tooltip-floating"
      style={{ left: tip.x, top: tip.y }}
      onMouseEnter={() => {}}
      onMouseLeave={hideTip}
    >
      {tip.text}
    </div>
  );
};

export function LibraryView() {
  const { t } = useT();
  const [tab, setTab] = useState<LibTab>("models");
  const [selectedModel, setSelectedModel] = useState<ModelFile | null>(null);

  return (
    <SettingsLayout
      tabs={LIB_TABS}
      activeTab={tab}
      onTabChange={(id) => { setTab(id as LibTab); setSelectedModel(null); }}
      breadcrumbCrumbs={[
        { label: t("Biblioteca"), tab: "models" },
        { label: t(LIB_TABS.find((tt) => tt.id === tab)?.label ?? "") },
      ]}
      onBreadcrumbNavigate={(t) => setTab(t as LibTab)}
      rightPanel={selectedModel ? <ModelDetailPanel key={selectedModel.path} model={selectedModel} onClose={() => setSelectedModel(null)} /> : undefined}
    >
      {tab === "models" && <ModelsTab onSelectModel={setSelectedModel} />}
      {tab === "agentes" && <div className="settings-content-inner"><h2>{t("Agentes")}</h2><p className="view-sub">{t("Gestiona tus agentes de IA.")}</p></div>}
      {tab === "skills" && <div className="settings-content-inner"><h2>{t("Skills")}</h2><p className="view-sub">{t("Gestiona tus skills de OpenCode.")}</p></div>}
      {tab === "workflows" && <div className="settings-content-inner"><h2>{t("Workflows")}</h2><p className="view-sub">{t("Gestiona tus flujos de trabajo.")}</p></div>}
    </SettingsLayout>
  );
}
