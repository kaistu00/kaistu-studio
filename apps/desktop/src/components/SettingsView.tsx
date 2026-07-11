import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import type { Lang } from "../i18n";
import { Breadcrumb } from "./Breadcrumb";

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
  const initialLoad = useRef(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kaistu-accent");
      if (saved) {
        setColor(saved);
        document.documentElement.style.setProperty("--accent", saved);
      }
    } catch { /* noop */ }
    initialLoad.current = false;
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
        <button className="settings-btn reset-btn" onClick={reset}>{t("Restablecer")}</button>
      </div>

      <h3 style={{ marginTop: 24 }}>{t("Tamaño de fuente")}</h3>
      <div className="font-scale-row">
        <span className="font-scale-label">A</span>
        <input type="range" min="0.5" max="2" step="0.05" value={fontScale} onChange={handleFontScaleChange} className="font-scale-slider" />
        <span className="font-scale-label font-scale-large">A</span>
        <code className="font-scale-value">{Math.round(fontScale * 100)}%</code>
        <button className="settings-btn-sm" onClick={resetFont} title={t("Restablecer")}>↺</button>
      </div>
      <p className="view-sub" style={{ marginTop: 4 }}>{t("O usa Ctrl + rueda del ratón en cualquier parte.")}</p>
    </div>
  );
}

function AboutTab({ version }: { version: string }) {
  const { t } = useT();
  return (
    <div className="settings-content-inner">
      <h2>{t("Acerca de")}</h2>
      <p className="view-sub">KAISTU Studio v{version}</p>
      <p className="view-sub" style={{ marginTop: 8 }}>{t("Plataforma de generación y edición con IA.")}</p>
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
    </div>
  );
}

function ToolBlock({ icon, name, service, benefits, features }: { icon: string; name: string; service: string; benefits: string; features?: string[] }) {
  const { t } = useT();
  const [hasKey, setHasKey] = useState(false);
  const [connected, setConnected] = useState(false);
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
    setConnected(false);
  };

  const testConnection = async () => {
    setConnected(true);
  };

  return (
<div className={"tool-card" + (!hasKey ? " no-key" : " configured")}>
       <div className="tool-card-header">
         <span className="material-symbols-outlined tool-card-icon">{icon}</span>
         <div>
           <h4 className="tool-card-name">{name}</h4>
           <p className="tool-card-benefits">{benefits}</p>
           {features && features.length > 0 && (
             <ul className="tool-card-features">
               {features.map((f, i) => <li key={i}>{f}</li>)}
             </ul>
           )}
         </div>
       </div>

       <div className="tool-card-status">
         <span className={"tool-card-indicator " + (connected ? "connected" : hasKey ? "configured" : "no-key")}>
           {connected ? t("Conectado") : hasKey ? t("Key guardada") : t("Sin configurar")}
         </span>
         <span className={"tool-card-plug" + (connected ? " connected" : "")} onClick={testConnection} title={t("Probar conexión")}>
           <span className="material-symbols-outlined">sync</span>
         </span>
       </div>

       <div className="tool-card-actions">
         {hasKey ? (
           <>
             <button className="tool-card-btn" onClick={() => setShowForm(true)}>
               <span className="material-symbols-outlined">edit</span>
               {t("Cambiar key")}
             </button>
             <button className="tool-card-btn danger" onClick={deleteKey}>
               <span className="material-symbols-outlined">delete</span>
               {t("Eliminar")}
             </button>
           </>
         ) : (
           <button className="tool-card-btn primary" onClick={() => setShowForm(true)}>
             <span className="material-symbols-outlined">add</span>
             {t("Conectar")}
           </button>
         )}
       </div>

       {showForm && (
         <div className="tool-card-form-overlay">
           <div className="tool-card-form">
             <h5>{t("Configurar API Key")}</h5>
             <p className="tool-card-instructions">
               {t("Consigue tu API Key en:")} <code>Settings → API Keys → API Key (en civitai.com)</code>
             </p>
             <input
               type="password"
               placeholder={t("API Key")}
               value={apiKey}
               onChange={(e) => setApiKey(e.target.value)}
               className="path-input tool-card-input"
             />
            <div className="tool-card-form-actions">
              <button className="tool-card-btn primary" onClick={saveKey}>
                <span className="material-symbols-outlined">save</span>
                {t("Guardar")}
              </button>
              <button className="tool-card-btn" onClick={() => setShowForm(false)}>
                <span className="material-symbols-outlined">close</span>
                {t("Cancelar")}
              </button>
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
          <button className="settings-btn" onClick={addPath}>{t("Añadir ruta")}</button>
        </div>
        {customPaths.map((p) => (
          <div key={p} className="custom-path-row">
            <code>{p}</code>
            <button className="settings-btn-sm" onClick={() => removePath(p)}>✕</button>
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
    <div className="settings-view">
      <nav className={"settings-sidebar" + (sidebarCollapsed ? " collapsed" : "")}>
        {TABS.map((tt) => (
          <button key={tt.id} className={"settings-tab" + (tab === tt.id ? " active" : "")} onClick={() => setTab(tt.id)} title={t(tt.label)}>
            <span className="material-symbols-outlined settings-tab-icon">{tt.icon}</span>
            {!sidebarCollapsed && <span className="settings-tab-label">{t(tt.label)}</span>}
          </button>
        ))}
      </nav>
      <div className="settings-content">
<Breadcrumb
            crumbs={[
              { label: t("Configuración"), tab: "general" },
              { label: t(TABS.find((tt) => tt.id === tab)?.label ?? "") },
            ]}
            onNavigate={(t) => setTab(t as Tab)}
          />
{tab === "general" && <GeneralTab />}
         {tab === "models" && <ModelsTab />}
         {tab === "appearance" && <AppearanceTab />}
         {tab === "tools" && <ToolsTab />}
         {tab === "about" && <AboutTab version={version} />}
      </div>
    </div>
  );
}
