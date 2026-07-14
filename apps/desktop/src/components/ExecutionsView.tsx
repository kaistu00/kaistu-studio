import { useEffect, useState } from "react";
import { useT } from "../i18n";
import type { Execution } from "../../electron/preload/index";
import type { ViewPath } from "./Sidebar";

interface Props {
  onNavigate: (v: ViewPath) => void;
}

const STATUS_ICON: Record<string, string> = {
  pending: "schedule",
  running: "sync",
  completed: "check_circle",
  failed: "error",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "exec-badge-pending",
  running: "exec-badge-running",
  completed: "exec-badge-completed",
  failed: "exec-badge-failed",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  running: "Ejecutando",
  completed: "Completado",
  failed: "Fallido",
};

export function ExecutionsView({ onNavigate }: Props) {
  const { t } = useT();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI?.listExecutions()
      .then(setExecutions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="view">
      <h1>{t("Ejecuciones")}</h1>
      <p className="view-sub">{t("Tus ejecuciones de upscaling aparecerán aquí.")}</p>

      {loading ? (
        <p className="view-sub">{t("Cargando...")}</p>
      ) : executions.length === 0 ? (
        <div className="exec-empty">
          <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>play_arrow</span>
          <p>{t("No hay ejecuciones recientes")}</p>
        </div>
      ) : (
        <div className="exec-list">
          {executions.map((ex) => (
            <div key={ex.id} className="exec-card" onClick={() => onNavigate(`execution.${ex.id}` as ViewPath)}>
              <div className="exec-card-header">
                <span className="exec-card-type">Upscaler</span>
                <span className={`exec-badge ${STATUS_CLASS[ex.status]}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{STATUS_ICON[ex.status]}</span>
                  {STATUS_LABEL[ex.status]}
                </span>
              </div>
              <div className="exec-card-body">
                <div className="exec-card-field">
                  <span className="exec-card-label">Modelo</span>
                  <span className="exec-card-value">{ex.model_name}</span>
                </div>
                <div className="exec-card-field">
                  <span className="exec-card-label">Escala</span>
                  <span className="exec-card-value">{ex.scale}x</span>
                </div>
                <div className="exec-card-field">
                  <span className="exec-card-label">Inicio</span>
                  <span className="exec-card-value">{ex.started_at ? new Date(ex.started_at).toLocaleString() : "—"}</span>
                </div>
                <div className="exec-card-field">
                  <span className="exec-card-label">Fin</span>
                  <span className="exec-card-value">{ex.completed_at ? new Date(ex.completed_at).toLocaleString() : "—"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
