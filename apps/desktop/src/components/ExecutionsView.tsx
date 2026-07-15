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
   cancelled: "close",
 };

 const STATUS_CLASS: Record<string, string> = {
   pending: "exec-badge-pending",
   running: "exec-badge-running",
   completed: "exec-badge-completed",
   failed: "exec-badge-failed",
   cancelled: "exec-badge-cancelled",
 };

 const STATUS_LABEL: Record<string, string> = {
   pending: "Pendiente",
   running: "Ejecutando",
   completed: "Completado",
   failed: "Fallido",
   cancelled: "Cancelado",
 };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

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
            <div key={ex.id} className="exec-row" onClick={() => onNavigate(`execution.${ex.id}` as ViewPath)}>
              <span className={`exec-badge ${STATUS_CLASS[ex.status]}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{STATUS_ICON[ex.status]}</span>
                {STATUS_LABEL[ex.status]}
              </span>
{ex.model_name && (
               <>
               <span className="exec-row-pipe">|</span>
               <span className={`exec-row-model ${ex.mode !== "upscale" ? "exec-row-mode-" + ex.mode : ""}`}>{ex.model_name}</span>
               </>
               )}
               {ex.mode && ex.mode !== "upscale" && (
               <>
               <span className="exec-row-pipe">|</span>
               <span className="exec-row-mode">{t(ex.mode === "downscale" ? "Reducir" : ex.mode === "rescale" ? "Redimensionar" : "Limpiar")}</span>
               </>
               )}
              <span className="exec-row-pipe">|</span>
              <span>{ex.scale}x</span>
              <span className="exec-row-pipe">|</span>
              <span>{ex.output_format.toUpperCase()}</span>
              {ex.input_width > 0 && (
                <>
                  <span className="exec-row-pipe">|</span>
                  <span>{ex.input_width}×{ex.input_height}</span>
                </>
              )}
              {ex.file_size && (
                <>
                  <span className="exec-row-pipe">|</span>
                  <span>{ex.file_size}</span>
                </>
              )}
              <span className="exec-row-spacer" />
              <span className="exec-row-time">{ex.started_at ? timeAgo(ex.started_at) : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
