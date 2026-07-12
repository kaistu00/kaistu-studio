import { useCallback, useEffect, useState } from "react";
import { useT } from "../i18n";
import type { Lang } from "../i18n";
import type { SystemCapabilities } from "../electron/preload";
import { IconButton, SettingsLayout } from "./";
import { withCivitaiRef } from "../utils/civitai";
import { useCivitaiMode } from "../context/CivitaiMode";

type Tab = "general" | "models" | "appearance" | "tools" | "about";

interface DiscoveredPath { label: string; path: string; }

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "settings" },
  { id: "models", label: "Modelos", icon: "folder" },
  { id: "appearance", label: "Apariencia", icon: "palette" },
  { id: "tools", label: "Tools", icon: "extension" },
  { id: "about", label: "Acerca de", icon: "info" },
];

const DEFAULT_ACCENT = "#00754a";

function GeneralTab() {
  const { t, lang, setLang } = useT();
  return (
    <div className="settings-content-inner">
      <h2>{t("General")}</h2>
      <p className="view-sub">{t("Configuración general de la aplicación.")}</p>
      <h3>{t("Idioma")}</h3>
      <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
    </div>
  );
}

function AppearanceTab() {
  const { t } = useT();
  const [color, setColor] = useState(DEFAULT_ACCENT);
  const [alpha, setAlpha] = useState(1);
  const [fontScale, setFontScale] = useState(() => {
    try { return parseFloat(localStorage.getItem("kaistu-font-scale") ?? "1"); } catch { return 1; }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kaistu-accent");
      if (saved) {
        setColor(saved);
        document.documentElement.style.setProperty("--accent", saved);
      }
    } catch { /* noop */ }
  }, []);

  const applyColor = useCallback((c: string, a: number) => {
    let finalColor = c;
    if (a < 1) {
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      finalColor = `rgba(${r},${g},${b},${a})`;
    }
    document.documentElement.style.setProperty("--accent", finalColor);
    try { localStorage.setItem("kaistu-accent", c); } catch { /* noop */ }
  }, []);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const c = e.target.value;
    setColor(c);
    applyColor(c, alpha);
  };

  const handleAlphaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = parseFloat(e.target.value);
    setAlpha(a);
    applyColor(color, a);
  };

  const handleFontScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = parseFloat(e.target.value);
    setFontScale(s);
    document.documentElement.style.setProperty("--font-scale", String(s));
    try { localStorage.setItem("kaistu-font-scale", String(s)); } catch { /* noop */ }
  };

  const reset = () => {
    setColor(DEFAULT_ACCENT);
    setAlpha(1);
    document.documentElement.style.setProperty("--accent", DEFAULT_ACCENT);
    try { localStorage.setItem("kaistu-accent", DEFAULT_ACCENT); } catch { /* noop */ }
  };

  const resetFont = () => {
    setFontScale(1);
    document.documentElement.style.setProperty("--font-scale", "1");
    try { localStorage.setItem("kaistu-font-scale", "1"); } catch { /* noop */ }
  };

  return (
    <div className="settings-content-inner">
      <h2>{t("Apariencia")}</h2>
      <p className="view-sub">{t("Temas y personalización visual.")}</p>
      <h3>{t("Color de acento")}</h3>
      <div className="accent-picker">
        <input type="color" value={color} onChange={handleColorChange} className="color-input" />
        <div className="alpha-row">
          <label>Alpha</label>
          <input type="range" min="0.2" max="1" step="0.05" value={alpha} onChange={handleAlphaChange} className="alpha-slider" />
          <code className="alpha-value">{Math.round(alpha * 100)}%</code>
        </div>
        <div className="accent-preview" style={{ background: `var(--accent)` }} />
        <IconButton icon="restart_alt" label={t("Restablecer")} className="settings-btn reset-btn" onClick={reset} />
      </div>

      <h3 style={{ marginTop: 24 }}>{t("Tamaño de fuente")}</h3>
      <div className="font-scale-row">
        <span className="font-scale-label">A</span>
        <input type="range" min="0.5" max="2" step="0.05" value={fontScale} onChange={handleFontScaleChange} className="font-scale-slider" />
        <span className="font-scale-label font-scale-large">A</span>
        <code className="font-scale-value">{Math.round(fontScale * 100)}%</code>
        <IconButton icon="restart_alt" iconOnly className="settings-btn-sm" onClick={resetFont} title={t("Restablecer")} />
      </div>
      <p className="view-sub" style={{ marginTop: 4 }}>{t("O usa Ctrl + rueda del ratón en cualquier parte.")}</p>
    </div>
  );
}

function AboutTab({ version }: { version: string }) {
  const { t } = useT();
  const [caps, setCaps] = useState<SystemCapabilities | null>(null);
  const [capsError, setCapsError] = useState(false);
  const [showPackages, setShowPackages] = useState(false);

  const loadCaps = useCallback(() => {
    setCaps(null);
    setCapsError(false);
    window.electronAPI?.getSystemCapabilities?.()
      .then(setCaps)
      .catch(() => setCapsError(true));
  }, []);

  useEffect(() => { loadCaps(); }, [loadCaps]);

  const gpuTypeLabel = (caps?.gpu_type ?? "none").toUpperCase();
  const pytorchRecommended = caps?.gpu_type === "nvidia" && caps?.pytorch_backend === "cpu" ? "cuda" : null;
  const pytorchRecommendedAmd = caps?.gpu_type === "amd" && caps?.pytorch_backend === "cpu" ? "rocm" : null;

  return (
    <div className="settings-content-inner">
      <h2>{t("Acerca de")}</h2>
      <p className="view-sub">KAISTU Studio v{version}</p>
      <p className="view-sub" style={{ marginTop: 8 }}>{t("Plataforma de generación y edición con IA.")}</p>

      {capsError && <p className="view-sub" style={{ color: "var(--error)" }}>{t("No se pudo detectar el hardware.")} <IconButton icon="refresh" label={t("Reintentar")} className="caps-refresh-btn" onClick={loadCaps} /></p>}

      <div className="caps-blocks">
        <div className="caps-block">
          <div className="caps-block-header">
            <span className="material-symbols-outlined">computer</span>
            <span>HARDWARE LOCAL</span>
            <button className="caps-refresh-icon" onClick={loadCaps} title={t("Refrescar")}>
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
          {caps ? (
            <>
              <div className="caps-block-body">
                <div className="caps-row">
                  <span className="caps-label">
                    <span className="caps-info-icon material-symbols-outlined" title={t("Unidad de procesamiento gráfico y VRAM disponible.")}>info</span>
                    GPU
                  </span>
                  <span className="caps-value"><span className={"caps-gpu-badge caps-gpu-" + caps.gpu_type}>{gpuTypeLabel}</span> {caps.gpus.map(g => g.name).join(", ")}</span>
                </div>
                <div className="caps-row">
                  <span className="caps-label">
                    <span className="caps-info-icon material-symbols-outlined" title={t("Memoria de video dedicada de la GPU.")}>info</span>
                    VRAM
                  </span>
                  <span className="caps-value">{caps.gpus.length > 0 ? `${(caps.gpus[0]!.vram_total_mb / 1024).toFixed(1)} GiB` : "-"}</span>
                </div>
                <div className="caps-row">
                  <span className="caps-label">
                    <span className="caps-info-icon material-symbols-outlined" title={t("Memoria de acceso aleatorio del sistema.")}>info</span>
                    {t("RAM")}
                  </span>
                  <span className="caps-value">{caps.ram_gb.toFixed(1)} GiB</span>
                </div>
                <div className="caps-row">
                  <span className="caps-label">
                    <span className="caps-info-icon material-symbols-outlined" title={t("Número de núcleos de CPU.")}>info</span>
                    CPU
                  </span>
                  <span className="caps-value">{caps.cpu_count} {t("núcleos")}</span>
                </div>
                <div className="caps-row">
                  <span className="caps-label">
                    <span className="caps-info-icon material-symbols-outlined" title={t("Nivel de capacidad del sistema. Determina qué funcionalidades están disponibles.")}>info</span>
                    {t("Nivel")}
                  </span>
                  <span className={"caps-level-indicator caps-level-" + caps.capability_level}>{caps.capability_name}</span>
                </div>
              </div>
              <div className="caps-features">
                <span className="caps-features-title">{t("Funcionalidades")}</span>
                <div className="caps-features-list">
                  {caps.all_features?.map(f => (
                    <span key={f.name} className={"caps-feature-tag " + (f.available ? "" : "caps-feature-unavailable")}
                      title={f.available ? "" : f.reason ?? ""}>
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : <div className="caps-loading">{t("Detectando...")}</div>}
        </div>

        <div className="caps-block">
          <div className="caps-block-header">
            <span className="material-symbols-outlined">science</span>
            <span>VENV INFO</span>
          </div>
          {caps ? (
            <div className="caps-block-body">
              <div className="caps-row">
                <span className="caps-label">
                  <span className="caps-info-icon material-symbols-outlined" title={t("Entorno virtual de Python. Aísla las dependencias del proyecto.")}>info</span>
                  {t("Entorno")}
                </span>
                <span className="caps-value">{caps.venv.is_venv ? "kaistu-studio" : t("Sistema")}</span>
              </div>
              <div className="caps-row" onClick={() => caps.venv.is_venv && window.electronAPI?.revealInFolder?.(caps.venv.prefix)} style={{ cursor: caps.venv.is_venv ? "pointer" : "default" }}>
                <span className="caps-label">
                  <span className="caps-info-icon material-symbols-outlined" title={t("Ruta absoluta del entorno virtual.")}>info</span>
                  {t("Ruta")}
                </span>
                <span className="caps-value caps-path">{caps.venv.prefix} {caps.venv.is_venv && <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>open_in_new</span>}</span>
              </div>
              <div className="caps-row">
                <span className="caps-label">
                  <span className="caps-info-icon material-symbols-outlined" title={t("Versión del intérprete de Python.")}>info</span>
                  Python
                </span>
                <span className="caps-value">{caps.venv.python}</span>
              </div>
              <div className="caps-row">
                <span className="caps-label">
                  <span className="caps-info-icon material-symbols-outlined" title={t("Backend de PyTorch. 'cuda' si hay GPU NVIDIA, 'mps' si Apple Silicon, 'cpu' si no hay GPU acelerada.")}>info</span>
                  PyTorch
                </span>
                <span className="caps-value">
                  {caps.pytorch_backend ?? t("No instalado")}
                  {pytorchRecommended && <span className="caps-warning"> ({t("Recomendado: cuda")})</span>}
                  {pytorchRecommendedAmd && <span className="caps-warning"> ({t("Recomendado: rocm")})</span>}
                </span>
              </div>
              <div className="caps-row caps-row-clickable" onClick={() => setShowPackages(!showPackages)}>
                <span className="caps-label">
                  <span className="caps-info-icon material-symbols-outlined" title={t("Paquetes de Python instalados en el entorno virtual.")}>info</span>
                  {t("Paquetes")}
                </span>
                <span className="caps-value">{caps.venv.package_count} <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>{showPackages ? "expand_less" : "expand_more"}</span></span>
              </div>
              {showPackages && (
                <div className="caps-pkg-list">
                  {caps.venv.packages.map(p => (
                    <div key={p.name} className="caps-pkg-item">
                      <span className="caps-pkg-name">{p.name}</span>
                      <span className="caps-pkg-ver">{p.version}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : <div className="caps-loading">{t("Detectando...")}</div>}
        </div>
      </div>
    </div>
  );
}

function ToolsTab() {
  const { t } = useT();

  return (
    <div className="settings-content-inner">
      <h2>{t("Tools")}</h2>
      <p className="view-sub">{t("Conexiones con herramientas externas.")}</p>

      <h3 className="tool-group-title">{t("KAISTU Studio")}</h3>

      <ToolBlock
        icon="extension"
        name="Civitai Site API"
        service="civitai"
        benefits={t("Búsqueda y descarga de modelos desde Civitai.com.")}
        features={[
          t("Modelos: Checkpoints, LoRA, VAE, ControlNet, Upscalers"),
          t("Endpoints públicos sin auth + datos extra con API key"),
          t("Descarga directa mediante downloadUrl"),
        ]}
      />

      <ToolBlock
        icon="robot"
        name="HuggingFace API Key"
        service="huggingface"
        benefits={t("Acceso a Inference Providers y Spaces privados.")}
        features={[
          t("Inference Providers: Claude, Llama, FLUX, SDXL, etc."),
          t("Acceso a Spaces privados y sin límites"),
          t("Modelos de texto, imagen y audio"),
        ]}
      />
    </div>
  );
}

function ToolBlock({ icon, name, service, benefits, features }: { icon: string; name: string; service: string; benefits: string; features?: string[] }) {
  const { t } = useT();
  const { mode, setMode } = useCivitaiMode();
  const isCivitai = service === "civitai";
  const [hasKey, setHasKey] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    window.electronAPI?.getAPIKeys?.().then((keys) => {
      const found = keys.some((k) => k.service === service);
      setHasKey(found);
    }).catch(() => {});
  }, [service]);

  const saveKey = async () => {
    await window.electronAPI?.saveAPIKey({ service, api_key: apiKey });
    setHasKey(true);
    setShowForm(false);
    setApiKey("");
  };

  const deleteKey = async () => {
    await window.electronAPI?.deleteAPIKey(service);
    setHasKey(false);
  };

  return (
<div className={"tool-card" + (!hasKey ? " no-key" : " configured")}>
        <div className="tool-card-header">
          <span className={"material-symbols-outlined tool-card-icon" + (isCivitai && mode === "nsfw" ? " civitai-nsfw-icon" : "")}>{icon}</span>
          <div>
            <div className="tool-card-title-row">
              <h4 className="tool-card-name">{name}</h4>
              {isCivitai && (
                <label className="civitai-mode-switch" title={t("Mostrar contenido NSFW")}>
                  <span className="civitai-mode-label">{mode === "nsfw" ? t("NSFW") : t("SFW")}</span>
                  <input type="checkbox" checked={mode === "nsfw"} onChange={() => setMode(mode === "nsfw" ? "sfw" : "nsfw")} />
                  <span className="civitai-mode-track"><span className="civitai-mode-thumb" /></span>
                </label>
              )}
            </div>
            <p className="tool-card-benefits">{benefits}</p>
{features && features.length > 0 && (
               <ul className="tool-card-features">
                 {features.map((f, i) => <li key={i}>{f}</li>)}
               </ul>
             )}
             {service === "huggingface" && (
               <div className="tool-card-instructions">
                 <p>{t("Para obtener tu API Key de HuggingFace:")}</p>
                 <ol>
                   <li>{t("Inicia sesión en")} <a href="https://huggingface.co" target="_blank" rel="noopener noreferrer">huggingface.co</a></li>
                   <li>{t("Ve a tu perfil → Settings → Access Tokens")}</li>
                   <li>{t("Crea un nuevo token con rol 'read' o 'write'")}</li>
                   <li>{t("Pégalo en el campo de abajo")}</li>
                 </ol>
                 <p style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>{t("Si no configurarás el token, los Spaces públicos siguen funcionando con límites.")}</p>
               </div>
             )}
             {isCivitai && (
              <div className="tool-card-instructions">
                <p>{t("Para obtener tu API Key de Civitai:")}</p>
                <ol>
                  <li>{t("Inicia sesión en")} <a href="https://civitai.com" target="_blank" rel="noopener noreferrer">civitai.com</a></li>
                  <li>{t("Ve a tu perfil → Account → API Keys (o haz clic")} <a href={withCivitaiRef("/user/account")} target="_blank" rel="noopener noreferrer">{t("aquí")}</a>)</li>
                  <li>{t("Crea un nuevo API Key y cópiala")}</li>
                  <li>{t("Pégala en el campo de abajo")}</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="tool-card-actions">
          {hasKey ? (
            <>
              <IconButton icon="edit" label={t("Cambiar key")} className="tool-card-btn" onClick={() => setShowForm(true)} />
              <IconButton icon="delete" label={t("Eliminar")} className="tool-card-btn danger" onClick={deleteKey} />
            </>
          ) : (
            <IconButton icon="add" label={t("Conectar")} className="tool-card-btn primary" onClick={() => setShowForm(true)} />
          )}
        </div>

{showForm && (
           <div className="tool-card-form-overlay">
             <div className="tool-card-form">
               <h5>{t("Configurar API Key")}</h5>
                <p className="tool-card-instructions">
                  {t("Consigue tu API Key en:")} <a href={service === "huggingface" ? "https://huggingface.co/settings/tokens" : withCivitaiRef()} target="_blank" rel="noopener noreferrer">{service === "huggingface" ? "huggingface.co" : "civitai.com"}</a>
                </p>
               <input
                 type="password"
                 placeholder={t("API Key")}
                 value={apiKey}
                 onChange={(e) => setApiKey(e.target.value)}
                 className="path-input"
               />
              <div className="tool-card-form-actions">
                <IconButton icon="save" label={t("Guardar")} className="tool-card-btn primary" onClick={saveKey} />
                <IconButton icon="close" label={t("Cancelar")} className="tool-card-btn" onClick={() => setShowForm(false)} />
              </div>
            </div>
          </div>
         )}
    </div>
  );
}

function ModelsTab() {
  const { t } = useT();
  const [discoveredPaths, setDiscoveredPaths] = useState<DiscoveredPath[]>([]);
  const [customPaths, setCustomPaths] = useState<string[]>([]);
  const [newPath, setNewPath] = useState("");

  useEffect(() => {
    window.electronAPI?.getModelPaths().then(setCustomPaths).catch(() => {});
    window.electronAPI?.discoverModelPaths().then(setDiscoveredPaths).catch(() => {});
  }, []);

  const addPath = async () => {
    const p = newPath.trim();
    if (!p || customPaths.includes(p)) return;
    const next = [...customPaths, p];
    setCustomPaths(next);
    setNewPath("");
    await window.electronAPI?.setModelPaths(next);
  };

  const removePath = (p: string) => {
    const next = customPaths.filter((x) => x !== p);
    setCustomPaths(next);
    window.electronAPI?.setModelPaths(next);
  };

  return (
    <div className="settings-content-inner">
      <p className="view-sub">{t("Rutas de modelos instalados y detección automática.")}</p>
      <div className="model-paths-section">
        {discoveredPaths.length > 0 && (
          <>
            <h3>{t("Rutas detectadas")}</h3>
            <div className="known-paths">
              {discoveredPaths.map((d) => (
                <label key={d.path} className="known-path">
                  <span className="known-path-dot" />
                  <span>{d.label}</span>
                  <code>{d.path}</code>
                </label>
              ))}
            </div>
          </>
        )}
        <h3>{t("Rutas personalizadas")}</h3>
        <div className="custom-path-input">
          <input type="text" value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="C:\\Ruta\\a\\modelos" className="path-input" />
          <IconButton icon="add" label={t("Añadir ruta")} className="settings-btn" onClick={addPath} />
        </div>
        {customPaths.map((p) => (
          <div key={p} className="custom-path-row">
            <code>{p}</code>
            <IconButton icon="close" iconOnly className="settings-btn-sm" onClick={() => removePath(p)} />
          </div>
        ))}
      </div>
    </div>
  );
}


export function SettingsView({ version, sidebarCollapsed }: { version: string; sidebarCollapsed: boolean }) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("models");

  return (
    <SettingsLayout
      tabs={TABS}
      activeTab={tab}
      onTabChange={(id) => setTab(id as Tab)}
      collapsed={sidebarCollapsed}
      breadcrumbCrumbs={[
        { label: t("Configuración"), tab: "general" },
        { label: t(TABS.find((tt) => tt.id === tab)?.label ?? "") },
      ]}
      onBreadcrumbNavigate={(t) => setTab(t as Tab)}
    >
      {tab === "general" && <GeneralTab />}
      {tab === "models" && <ModelsTab />}
      {tab === "appearance" && <AppearanceTab />}
      {tab === "tools" && <ToolsTab />}
      {tab === "about" && <AboutTab version={version} />}
    </SettingsLayout>
  );
}
