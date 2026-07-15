import { useEffect, useState, useRef, useCallback } from "react";
import type { MenuAction } from "@kaistu/shared";
import { TitleBar, Sidebar, SettingsView, LibraryView, IconButton, BottomPanel, ProjectsView, ContentView, TextView, ScaleSelectionView, UpscaleImageView, UpscaleVideoView, DownscaleImageView, DownscaleVideoView, RescaleImageView, RescaleVideoView, CleanImageView, CleanVideoView, WebRootMenu, HomeView, ExecutionsView, ExecutionDetailView } from "./components";
import type { ViewPath } from "./components";
import type { ScaleMode } from "./components/UpscaleSidebar";
import type { SystemStats } from "../electron/preload/index";
import { LangProvider, useT } from "./i18n";
import { ErrorBoundary } from "./ErrorBoundary";
import { CivitaiModeProvider } from "./context/CivitaiMode";
import { cpuStatLevel, formatGB } from "./utils/format";
import "./App.css";

const FONT_SCALE_KEY = "kaistu-font-scale";

function getInitialLang(): "es" | "en" {
  try {
    const saved = localStorage.getItem("kaistu-lang");
    if (saved === "en") return "en";
  } catch { /* noop */ }
  return "es";
}

export default function App() {
  const [view, setView] = useState<ViewPath>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appVersion, setAppVersion] = useState("?");
  const [backendStatus, setBackendStatus] = useState<"unknown" | "healthy" | "unreachable">("unknown");
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [panelTab, setPanelTab] = useState<"terminal" | "logs" | null>(null);
  const [panelHeight, setPanelHeight] = useState(200);
  const [webMenuOpen, setWebMenuOpen] = useState(false);
  const { t } = useT();

  useEffect(() => {
    const handler = () => setWebMenuOpen((o) => !o);
    window.addEventListener("kaistu-show-root-menu", handler);
    return () => window.removeEventListener("kaistu-show-root-menu", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      setView(detail ? ("settings." + detail) as any : "settings");
    };
    window.addEventListener("kaistu-navigate-settings", handler as any);
    return () => window.removeEventListener("kaistu-navigate-settings", handler as any);
  }, []);

  useEffect(() => { window.electronAPI?.getAppVersion().then((v) => setAppVersion(v ?? "?")).catch(() => {}); }, []);
  useEffect(() => {
    const cleanup = window.electronAPI?.onMenuAction((action: MenuAction) => {
      if (action === "about") window.electronAPI?.getAppVersion().then((v) => alert("KAISTU Studio v" + v + "\nAI-powered content creation studio"));
    });
    return () => cleanup?.();
  }, []);
  useEffect(() => {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    const poll = () => {
      if (window.electronAPI) {
        return window.electronAPI.backendHealth().then((res) => setBackendStatus(res.status === "healthy" ? "healthy" : "unreachable")).catch(() => {});
      }
      return fetch(BACKEND_URL + "/api/v1/health").then((r) => r.json()).then((res) => setBackendStatus(res.status === "healthy" ? "healthy" : "unreachable")).catch(() => setBackendStatus("unreachable"));
    };
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

const renderView = useCallback(() => {
    switch (view) {
      case "home": return <HomeView onNavigate={setView} />;
      case "executions": return <ExecutionsView onNavigate={setView} />;
      case "upscale": return <ScaleSelectionView onNavigate={setView} />;
      case "upscale-image": return <UpscaleImageView onNavigate={setView} />;
      case "upscale-video": return <UpscaleVideoView onNavigate={setView} />;
      case "downscale-image": return <DownscaleImageView onNavigate={setView} />;
      case "downscale-video": return <DownscaleVideoView onNavigate={setView} />;
      case "rescale-image": return <RescaleImageView onNavigate={setView} />;
      case "rescale-video": return <RescaleVideoView onNavigate={setView} />;
      case "clean-image": return <CleanImageView onNavigate={setView} />;
      case "clean-video": return <CleanVideoView onNavigate={setView} />;
      case "image": case "audio": case "video": return <ContentView kind={view} />;
      case "library": return <LibraryView />;
      case "settings": return <SettingsView version={appVersion} sidebarCollapsed={sidebarCollapsed} />;
      case "settings.tools": return <SettingsView version={appVersion} sidebarCollapsed={sidebarCollapsed} activeTab="tools" />;
      default:
        if (view?.startsWith("execution.")) {
          const execId = view.slice("execution.".length);
          return <ExecutionDetailView execId={execId} onBack={() => setView("executions")} />;
        }
        return null;
    }
  }, [view, appVersion, sidebarCollapsed]);

  return (
    <LangProvider initialLang={getInitialLang()}>
      <CivitaiModeProvider>
        <div className="app">

          <TitleBar version={appVersion} />
          <WebRootMenu open={webMenuOpen} onClose={() => setWebMenuOpen(false)} version={appVersion} />
          <div className="app-body">
            <Sidebar active={view} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} onNavigate={setView} />
            <main className="content">
              <section className="workspace"><ErrorBoundary>{renderView()}</ErrorBoundary></section>
              <BottomPanel tab={panelTab} height={panelHeight} onTabChange={setPanelTab} onHeightChange={setPanelHeight} />
              <footer className="status-bar">
                <span className="status-bar-left">
                  <span className="status-bar-actions">
                    <IconButton icon="terminal" iconOnly className={"status-bar-btn" + (panelTab === "terminal" ? " active" : "")} onClick={() => setPanelTab(panelTab === "terminal" ? null : "terminal")} title={t("Abrir terminal")} />
                    <IconButton icon="description" iconOnly className={"status-bar-btn" + (panelTab === "logs" ? " active" : "")} onClick={() => setPanelTab(panelTab === "logs" ? null : "logs")} title={t("Abrir logs")} />
                  </span>
                  <span>{t("Backend")}: <span className={"status-dot " + (backendStatus === "healthy" ? "online" : "offline")} /></span>
                </span>
                <span className="status-bar-right">
                  {sysStats && (
                    <>
                      <span className={`sb-stat ts-${cpuStatLevel(sysStats.cpu)}`} title={`CPU: ${sysStats.cpu}%`}>
                        <span className="material-symbols-outlined sb-icon">dns</span>
                        {sysStats.cpu}%
                      </span>
                      {sysStats.gpus.map((gpu, i) => (
                        <span key={i} className={`sb-stat ${gpu.utilization >= 0 ? "ts-" + cpuStatLevel(gpu.utilization) : "ts-na"}`} title={gpu.utilization >= 0 ? `GPU ${i}: ${gpu.name} — ${gpu.utilization}% · ${formatGB(gpu.memoryUsedMB)}/${formatGB(gpu.memoryTotalMB)} GB` : `GPU ${i}: ${gpu.name}`}>
                          <span className="material-symbols-outlined sb-icon">developer_board</span>
                          {i > 0 && <span className="sb-gpu-label">{i}</span>}
                          {gpu.utilization >= 0 ? `${gpu.utilization}%` : "N/A"}
                        </span>
                      ))}
                      <span className={`sb-stat ts-${cpuStatLevel(sysStats.memory.percent)}`} title={`RAM: ${sysStats.memory.usedGB} / ${sysStats.memory.totalGB} GB (${sysStats.memory.percent}%)`}>
                        <span className="material-symbols-outlined sb-icon">memory</span>
                        {sysStats.memory.percent}%
                      </span>
                    </>
                  )}
                </span>
              </footer>
            </main>
          </div>
        </div>
      </CivitaiModeProvider>
    </LangProvider>
  );
}

// Load saved accent color
try {
  const saved = localStorage.getItem("kaistu-accent");
  if (saved) document.documentElement.style.setProperty("--accent", saved);
} catch { /* noop */ }