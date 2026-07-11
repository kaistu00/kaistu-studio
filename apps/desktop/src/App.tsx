import { useEffect, useState, useRef, useCallback } from "react";
import type { MenuAction } from "@kaistu/shared";
import { TitleBar, Sidebar, SettingsView, LibraryView, IconButton, BottomPanel, ProjectsView, ContentView } from "./components";
import type { ViewPath } from "./components";
import type { SystemStats } from "../electron/preload/index";
import { LangProvider, useT } from "./i18n";
import { ErrorBoundary } from "./ErrorBoundary";
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

  const renderView = useCallback(() => {
    switch (view) {
      case "projects": return <ProjectsView />;
      case "text": case "image": case "audio": case "video": return <ContentView kind={view} />;
      case "library": return <LibraryView />;
      case "settings": return <SettingsView version={appVersion} sidebarCollapsed={sidebarCollapsed} />;
    }
  }, [view, appVersion, sidebarCollapsed]);

  return (
    <LangProvider initialLang={getInitialLang()}>
      <div className="app">
        <TitleBar version={appVersion} sysStats={sysStats} />
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
