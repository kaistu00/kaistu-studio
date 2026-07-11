import { useEffect, useState, useRef } from "react";
import type { MenuAction } from "@kaistu/shared";
import { TitleBar, Sidebar, SettingsView, LibraryView, IconButton } from "./components";
import type { ViewPath } from "./components";
import type { SystemStats } from "../electron/preload/index";
import { LangProvider, useT } from "./i18n";
import { ErrorBoundary } from "./ErrorBoundary";
import { copyToClipboard } from "./utils/clipboard";
import "./App.css";

function ProjectsView() {
  const { t } = useT();
  const [civitaiConfigured, setCivitaiConfigured] = useState(false);

  useEffect(() => {
    window.electronAPI?.getAPIKeys?.().then((keys) => {
      setCivitaiConfigured(keys.some((k) => k.service === "civitai"));
    }).catch(() => {});
  }, []);

  return (
    <div className="view">
      <h1>Proyectos</h1>
      <p className="view-sub">Tus proyectos guardados aparecerán aquí.</p>
      {!civitaiConfigured && (
        <div className="civitai-setup-banner">
          <span className="material-symbols-outlined">info</span>
          <span><strong>{t("Configura tu token de Civitai")}:</strong> {t("Permite búsqueda y descarga de modelos.")}</span>
        </div>
      )}
    </div>
  );
}

function TerminalView() {
  const { t } = useT();
  const [output, setOutput] = useState("");
  const [cmd, setCmd] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [termInfo, setTermInfo] = useState<{ user: string; host: string; cwd: string; venv: string } | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    window.electronAPI?.getTerminalInfo().then(setTermInfo);
  }, []);

  const promptParts = termInfo ? {
    venv: termInfo.venv ? `(${termInfo.venv.split("\\").pop()}) ` : null,
    userHost: `${termInfo.user}@${termInfo.host}`,
    cwd: `:${termInfo.cwd}`,
  } : null;

  const promptStr = promptParts
    ? (promptParts.venv || "") + promptParts.userHost + promptParts.cwd + "$"
    : "$";

  const runCommand = async () => {
    if (!cmd.trim()) return;
    setIsRunning(true);
    setOutput((prev) => prev + promptStr + " " + cmd + "\n");
    try {
      const result = await window.electronAPI?.runInTerminal(cmd);
      setOutput((prev) => {
        let newOutput = prev;
        if (result?.stdout) newOutput += result.stdout;
        if (result?.stderr) newOutput += "\n" + t("Error") + ": " + result.stderr;
        newOutput += "\n";
        return newOutput;
      });
    } catch (e) {
      setOutput((prev) => prev + t("Error") + ": " + String(e) + "\n");
    } finally {
      setIsRunning(false);
      setCmd("");
    }
  };

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isRunning) runCommand();
  };

  return (
    <div className="terminal-view">
      <div className="terminal-output">
        <pre ref={outputRef}>{output || t("(vacío)")}</pre>
      </div>
      <div className="terminal-input-row">
        <span className="terminal-prompt">
          {promptParts?.venv && <span className="venv-tag">{promptParts.venv}</span>}
          <span className="user-host">{promptParts?.userHost || ""}</span>
          <span className="path-part">{promptParts?.cwd || ""}</span>
          <span>$</span>
        </span>
        <input
          className="terminal-input"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t("Escribe un comando...")}
          disabled={isRunning}
          autoFocus={!isRunning}
        />
      </div>
    </div>
  );
}

function LogsView() {
  const { t } = useT();
  const [logLines, setLogLines] = useState<string[]>([]);
  const logsRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    window.electronAPI?.getLogs().then((content) => {
      if (content) setLogLines(content.split("\n").filter(Boolean));
    });
    const unsub = window.electronAPI?.onLogEntry((entry) => {
      setLogLines((prev) => [...prev, entry].slice(-1000));
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logLines]);

  const copyLogs = () => copyToClipboard(logLines.join("\n"));

  return (
    <div className="logs-view">
      <div className="logs-actions">
        <IconButton icon="content_copy" iconOnly className="icon-btn" onClick={copyLogs} title={t("Copiar logs")} />
      </div>
      <div className="logs-output" ref={logsRef}>
        {logLines.length === 0 ? (
          <span className="logs-empty">{t("(esperando logs...)")}</span>
        ) : (
          logLines.map((line, i) => {
            const spaceIdx = line.indexOf(" ");
            const ts = spaceIdx > 0 ? line.slice(0, spaceIdx) : "";
            const msg = spaceIdx > 0 ? line.slice(spaceIdx + 1) : line;
            return (
              <div key={i} className="log-line">
                {ts && <span className="log-ts">{ts}</span>}
                <span className="log-msg">{msg}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ContentView({ kind }: { kind: string }) {
  const icon = { text: "text_fields", image: "image", audio: "music_note", video: "movie" }[kind] ?? "auto_awesome";
  return (
    <div className="view">
      <h1>{kind.charAt(0).toUpperCase() + kind.slice(1)}</h1>
      <p className="view-sub">Generación y edición de {kind} con IA.</p>
      <div className="media-cards">
        <div className="media-card">
          <span className="media-icon material-symbols-outlined">{icon}</span>
          <span className="media-label">Generar</span>
        </div>
        <div className="media-card">
          <span className="media-icon material-symbols-outlined">{icon}</span>
          <span className="media-label">Editar</span>
        </div>
      </div>
    </div>
  );
}




const FONT_SCALE_KEY = "kaistu-font-scale";

function getInitialLang(): "es" | "en" {
  try {
    const saved = localStorage.getItem("kaistu-lang");
    if (saved === "en") return "en";
  } catch { /* noop */ }
  return "es";
}

export default function App() {
  const [view, setView] = useState<ViewPath>("projects");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appVersion, setAppVersion] = useState("?");
  const [backendStatus, setBackendStatus] = useState<"unknown" | "healthy" | "unreachable">("unknown");
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [panelTab, setPanelTab] = useState<"terminal" | "logs" | null>(null);
  const [panelHeight, setPanelHeight] = useState(200);
  const { t } = useT();

  useEffect(() => { window.electronAPI?.getAppVersion().then((v) => setAppVersion(v ?? "?")).catch(() => {}); }, []);
  useEffect(() => {
    const cleanup = window.electronAPI?.onMenuAction((action: MenuAction) => {
      if (action === "about") window.electronAPI?.getAppVersion().then((v) => alert("KAISTU Studio v" + v + "\nAI-powered content creation studio"));
    });
    return () => cleanup?.();
  }, []);
  useEffect(() => {
    const poll = () => window.electronAPI?.backendHealth().then((res) => setBackendStatus(res.status === "healthy" ? "healthy" : "unreachable")).catch(() => {});
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const poll = () => window.electronAPI?.getSystemStats().then(setSysStats).catch(() => {});
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  // Load font scale
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FONT_SCALE_KEY);
      if (saved) {
        const scale = parseFloat(saved);
        if (scale >= 0.5 && scale <= 2) {
          document.documentElement.style.setProperty("--font-scale", String(scale));
        }
      }
    } catch { /* noop */ }
  }, []);

  // Ctrl+MouseWheel font scale
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim()) || 1;
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const next = Math.max(0.5, Math.min(2, Math.round((current + delta) * 100) / 100));
      document.documentElement.style.setProperty("--font-scale", String(next));
      try { localStorage.setItem(FONT_SCALE_KEY, String(next)); } catch { /* noop */ }
    };
    window.addEventListener("wheel", handler, { passive: false });
    return () => window.removeEventListener("wheel", handler);
  }, []);

  const renderView = () => {
    switch (view) {
      case "projects": return <ProjectsView />;
      case "text": case "image": case "audio": case "video": return <ContentView kind={view} />;
      case "library": return <LibraryView />;
      case "settings": return <SettingsView version={appVersion} sidebarCollapsed={sidebarCollapsed} />;
    }
  };

  return (
    <LangProvider initialLang={getInitialLang()}>
      <div className="app">
        <TitleBar version={appVersion} sysStats={sysStats} />
        <div className="app-body">
          <Sidebar active={view} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} onNavigate={setView} />
          <main className="content">
            <section className="workspace"><ErrorBoundary>{renderView()}</ErrorBoundary></section>
            {panelTab && (
              <div className="bottom-panel" style={{ height: panelHeight }}>
                <div className="bottom-panel-drag" onMouseDown={(e) => {
                  e.preventDefault();
                  const startH = panelHeight;
                  const startY = e.clientY;
                  const onMove = (ev: MouseEvent) => setPanelHeight(Math.max(120, Math.min(600, startH + startY - ev.clientY)));
                  const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }} />
                <div className="bottom-panel-header">
                  <div className="bottom-panel-tabs">
                    <IconButton icon="terminal" label={t("Terminal")} className={"bottom-panel-tab" + (panelTab === "terminal" ? " active" : "")} onClick={() => setPanelTab("terminal")} />
                    <IconButton icon="description" label={t("Logs")} className={"bottom-panel-tab" + (panelTab === "logs" ? " active" : "")} onClick={() => setPanelTab("logs")} />
                  </div>
                  <IconButton icon="close" iconOnly className="bottom-panel-close" onClick={() => setPanelTab(null)} />
                </div>
                <div className="bottom-panel-body">
                  {panelTab === "terminal" ? <TerminalView /> : <LogsView />}
                </div>
              </div>
            )}
            <footer className="status-bar">
              <span className="status-bar-left">
                <span className="status-bar-actions">
                  <IconButton icon="terminal" iconOnly className={"status-bar-btn" + (panelTab === "terminal" ? " active" : "")} onClick={() => setPanelTab(panelTab === "terminal" ? null : "terminal")} title={t("Abrir terminal")} />
                  <IconButton icon="description" iconOnly className={"status-bar-btn" + (panelTab === "logs" ? " active" : "")} onClick={() => setPanelTab(panelTab === "logs" ? null : "logs")} title={t("Abrir logs")} />
                </span>
                <span>{t("Backend")}: <span className={"status-dot " + (backendStatus === "healthy" ? "online" : "offline")} /></span>
              </span>
            </footer>
          </main>
        </div>
      </div>
    </LangProvider>
  );
}

// Load saved accent color
try {
  const saved = localStorage.getItem("kaistu-accent");
  if (saved) document.documentElement.style.setProperty("--accent", saved);
} catch { /* noop */ }
