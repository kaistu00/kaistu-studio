import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";

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

function formatSize(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1000)} KB`;
  if (mb < 1000) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function ModelDetailPanel({ model, onClose }: { model: ModelFile; onClose: () => void }) {
  const { t } = useT();
  const [hfData, setHfData] = useState<HFModelResult | null>(null);
  const [hfLoading, setHfLoading] = useState(true);
  const [hfError, setHfError] = useState(false);
  const primary = hfData?.primary;

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

  const copyText = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
  }, []);

  const formatDownloads = (n: number): string => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
  };

  const formatParams = (n: number | null): string => {
    if (!n) return "";
    const b = n / 1_000_000_000;
    if (b >= 1) return b.toFixed(1) + "B";
    const m = n / 1_000_000;
    if (m >= 1) return m.toFixed(0) + "M";
    return String(n);
  };

  return (
    <div className="model-detail-sidebar">
      <div className="model-detail-header">
        <span className="material-symbols-outlined model-detail-icon">{TYPE_TABS.find((tt) => tt.id === model.type)?.icon ?? "description"}</span>
        <div className="model-detail-header-info">
          <div className="model-detail-name-row">
            <h3 className="model-detail-name">{model.name}</h3>
            <button className="model-detail-copy-btn model-detail-copy-name" onClick={() => copyText(model.name)}>
              <span className="material-symbols-outlined">content_copy</span>
            </button>
          </div>
          <span className="model-detail-type-label">{(TYPE_TABS.find((tt) => tt.id === model.type)?.labelKey ?? model.type)}</span>
        </div>
        <button className="settings-btn-sm model-detail-close" onClick={onClose}>✕</button>
      </div>
      <div className="model-detail-body">
        <div className="model-detail-local-section">
          <div className="model-detail-info-row">
            <span className="material-symbols-outlined model-detail-info-icon">storage</span>
            <span className="model-detail-info-label">{t("Tamaño")}</span>
            <span className="model-detail-info-value">{formatSize(model.sizeMB)}</span>
          </div>
          <div className="model-detail-info-row">
            <span className="material-symbols-outlined model-detail-info-icon">folder_open</span>
            <span className="model-detail-info-label">{t("Ruta")}</span>
          </div>
          <div className="model-detail-path-row">
            <code className="model-detail-path">{model.path}</code>
            <button className="model-detail-copy-btn" onClick={() => copyText(model.path)} data-tooltip={t("Copiar ruta")}>
              <span className="material-symbols-outlined">content_copy</span>
            </button>
          </div>
        </div>
        <div className="model-detail-divider" />
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
                    <span className="model-detail-hf-stat-value">{formatParams(primary.safetensors)}</span>
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
        </div>
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
  const [sortBy, setSortBy] = useState<"name" | "size">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedModel, setSelectedModel] = useState<ModelFile | null>(null);
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

  const toggleSort = (field: "name" | "size") => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("asc"); }
  };

  const filtered = models.filter((m) => !filter || m.name.toLowerCase().includes(filter.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    const cmp = sortBy === "name" ? a.name.localeCompare(b.name) : a.sizeMB - b.sizeMB;
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
  const visibleTabs = TYPE_TABS;

  return (
    <div className="models-tab-layout">
      <div className="models-tab-main">
        <div className="model-scan-bar">
          <span className="model-count">{sorted.length} {t("modelos")}</span>
          <span className="model-total-size">{formatSize(totalSize)}</span>
          <div className="model-sort-group">
            <button className={"model-sort-btn" + (sortBy === "name" ? " active" : "")} onClick={() => toggleSort("name")} data-tooltip={t("Ordenar por nombre")}>
              <span className="material-symbols-outlined">sort_by_alpha</span>
              {sortBy === "name" && <span className="model-sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </button>
            <button className={"model-sort-btn" + (sortBy === "size" ? " active" : "")} onClick={() => toggleSort("size")} data-tooltip={t("Ordenar por tamaño")}>
              <span className="material-symbols-outlined">straighten</span>
              {sortBy === "size" && <span className="model-sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </button>
          </div>
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("Filtrar...")} className="path-input filter-input" />
        </div>
        <div className="model-type-tabs">
          {visibleTabs.map((tt) => {
            const count = tt.id === "all" ? filtered.length : (grouped[tt.id]?.length ?? 0);
            return (
              <button key={tt.id} className={"model-type-tab" + (activeType === tt.id ? " active" : "")} onClick={() => setActiveType(tt.id)}>
                <span className="material-symbols-outlined model-type-tab-icon">{tt.icon}</span>
                <span className="model-type-tab-label">{t(tt.labelKey)}</span>
                <span className="model-type-tab-count">{count}</span>
              </button>
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
                  <span className="model-group-count">{items.length}</span>
                </h4>
                <div className="model-items">
                  {items.map((m) => (
                    <div key={m.path} className={"model-item" + (selectedModel?.path === m.path ? " selected" : "")} data-tooltip={m.path} onClick={() => setSelectedModel(selectedModel?.path === m.path && selectedModel?.name === m.name ? null : m)}>
                      <span className="model-item-name">{m.name}</span>
                      <span className="model-item-meta">
                        <span className="model-item-software">{m.software}</span>
                        <span className="model-item-size">{formatSize(m.sizeMB)}</span>
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
    <div className="settings-view">
      <nav className="settings-sidebar">
        {LIB_TABS.map((tt) => (
          <button key={tt.id} className={"settings-tab" + (tab === tt.id ? " active" : "")} onClick={() => { setTab(tt.id); setSelectedModel(null); }} title={t(tt.label)}>
            <span className="material-symbols-outlined settings-tab-icon">{tt.icon}</span>
            <span className="settings-tab-label">{t(tt.label)}</span>
          </button>
        ))}
      </nav>
      <div className="settings-content">
        {tab === "models" && <ModelsTab onSelectModel={setSelectedModel} />}
        {tab === "agentes" && <div className="settings-content-inner"><h2>{t("Agentes")}</h2><p className="view-sub">{t("Gestiona tus agentes de IA.")}</p></div>}
        {tab === "skills" && <div className="settings-content-inner"><h2>{t("Skills")}</h2><p className="view-sub">{t("Gestiona tus skills de OpenCode.")}</p></div>}
        {tab === "workflows" && <div className="settings-content-inner"><h2>{t("Workflows")}</h2><p className="view-sub">{t("Gestiona tus flujos de trabajo.")}</p></div>}
      </div>
      {selectedModel && <ModelDetailPanel model={selectedModel} onClose={() => setSelectedModel(null)} />}
    </div>
  );
}
