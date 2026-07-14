import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { IconButton } from "./IconButton";
import type { ExecStats, Execution } from "../../electron/preload/index";
import type { ViewPath } from "./Sidebar";

interface Props {
  onNavigate: (v: ViewPath) => void;
}

export function HomeView({ onNavigate }: Props) {
  const { t } = useT();
  const [stats, setStats] = useState<ExecStats | null>(null);
  const [recent, setRecent] = useState<Execution[]>([]);
  const [modelCount, setModelCount] = useState(0);

  useEffect(() => {
    window.electronAPI?.getExecutionStats().then(setStats).catch(() => {});
    window.electronAPI?.listExecutions().then((list) => setRecent(list.slice(0, 5))).catch(() => {});
    window.electronAPI?.discoverModelPaths().then((discovered) => {
      window.electronAPI?.getModelPaths().then((saved) => {
        const sources = [
          ...discovered.map((d) => ({ path: d.path, label: d.label })),
          ...saved.map((p) => ({ path: p, label: "" })),
        ];
        const existing = sources.filter((s) => s.path);
        if (existing.length > 0) {
          window.electronAPI?.scanModels(existing).then((models) => {
            setModelCount(models.length);
          }).catch(() => {});
        }
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  return (
    <div className="view">
      <h1>{t("Inicio")}</h1>
      <p className="view-sub">KAISTU Studio — {t("Plataforma de generación y edición con IA.")}</p>

      <div className="home-grid">
        <div className="home-card">
          <div className="home-card-header">
            <span className="material-symbols-outlined">dashboard</span>
            {t("Resumen del sistema")}
          </div>
          <div className="home-stats">
            <div className="home-stat" style={{ cursor: "pointer" }} onClick={() => onNavigate("library")}>
              <span className="home-stat-value">{modelCount}</span>
              <span className="home-stat-label">{t("Modelos disponibles")}</span>
            </div>
            <div className="home-stat">
              <span className="home-stat-value">{stats?.total ?? "—"}</span>
              <span className="home-stat-label">{t("Ejecuciones")}</span>
            </div>
            <div className="home-stat" style={{ cursor: "pointer" }} onClick={() => onNavigate("executions")}>
              <span className="home-stat-value" style={{ color: "var(--success)" }}>{stats?.completed ?? "—"}</span>
              <span className="home-stat-label">{t("Completadas")}</span>
            </div>
            <div className="home-stat" style={{ cursor: "pointer" }} onClick={() => onNavigate("executions")}>
              <span className="home-stat-value" style={{ color: "var(--accent)" }}>{stats?.running ?? "—"}</span>
              <span className="home-stat-label">{t("En ejecución")}</span>
            </div>
          </div>
        </div>

        <div className="home-card">
          <div className="home-card-header">
            <span className="material-symbols-outlined">rocket_launch</span>
            {t("Inicio rápido")}
          </div>
          <div className="home-quick-actions">
            <IconButton
              icon="magnification_small"
              label={t("Upscaling de imágenes con IA")}
              className="home-action-btn"
              onClick={() => onNavigate("upscale")}
            />
            <IconButton
              icon="library_books"
              label={t("Explora modelos de IA")}
              className="home-action-btn"
              onClick={() => onNavigate("library")}
            />
            <IconButton
              icon="play_arrow"
              label={t("Ejecuciones")}
              className="home-action-btn"
              onClick={() => onNavigate("executions")}
            />
          </div>
        </div>

        <div className="home-card home-card-wide">
          <div className="home-card-header">
            <span className="material-symbols-outlined">history</span>
            {t("Ejecuciones recientes")}
          </div>
          {recent.length === 0 ? (
            <p className="view-sub">{t("No hay ejecuciones recientes")}</p>
          ) : (
            <div className="home-recent-list">
              {recent.map((ex) => (
                <div key={ex.id} className="home-recent-item" onClick={() => onNavigate(`execution.${ex.id}` as ViewPath)}>
                  <span className={`exec-status-dot status-${ex.status}`} />
                  <span className="home-recent-name">{ex.model_name}</span>
                  <span className="home-recent-scale">{ex.scale}x</span>
                  <span className="home-recent-status">{t(ex.status === "pending" ? "pendiente" : ex.status === "running" ? "ejecutando" : ex.status === "completed" ? "completado" : "fallido")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
