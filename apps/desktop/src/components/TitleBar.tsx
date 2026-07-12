import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { IconButton } from "./";

export function TitleBar({ version }: { version?: string }) {
  const { t } = useT();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.isMaximized().then(setMaximized);
    const cleanup = window.electronAPI.onWindowState((s) => setMaximized(s === "maximized"));
    return cleanup;
  }, []);

  return (
    <header className="titlebar">
      <div className="titlebar-top">
        <div className="titlebar-drag">
          <IconButton icon="menu" iconOnly iconClass="hamburger-icon" className="hamburger-btn" onClick={() => window.electronAPI?.showRootMenu()} title={t("Menú")} />
          <span className="titlebar-title">KAISTU Studio</span>
          {version && <span className="titlebar-version">v{version}</span>}
        </div>
        {!window.__KAISTU_IS_WEB__ && (
        <div className="titlebar-controls">
          <button className="tb-btn" onClick={() => window.electronAPI?.minimizeWindow()} title={t("Minimizar")}>
            <svg width="10" height="10" viewBox="0 0 12 12"><rect x="1" y="5.5" width="10" height="1" fill="currentColor" /></svg>
          </button>
          <button className="tb-btn" onClick={() => window.electronAPI?.maximizeWindow()} title={maximized ? t("Restaurar") : t("Maximizar")}>
            {maximized ? (
              <svg width="10" height="10" viewBox="0 0 12 12">
                <rect x="2.5" y="0.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
                <rect x="0.5" y="2.5" width="9" height="9" rx="1" fill="var(--bg-primary)" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 12 12">
                <rect x="1" y="1" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            )}
          </button>
          <button className="tb-btn tb-close" onClick={() => window.electronAPI?.closeWindow()} title={t("Cerrar")}>
            <svg width="10" height="10" viewBox="0 0 12 12">
              <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
              <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
        )}
      </div>
    </header>
  );
}
