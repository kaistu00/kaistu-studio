import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { IconButton } from "./IconButton";
import { CompareSlider } from "./CompareSlider";
import type { Execution } from "../../electron/preload/index";

interface Props {
  execId: string;
  onBack: () => void;
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

export function ExecutionDetailView({ execId, onBack }: Props) {
  const { t } = useT();
  const [exec, setExec] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!execId) return;
    window.electronAPI?.getExecution(execId)
      .then(setExec)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [execId]);

  useEffect(() => {
    if (!exec || exec.status === "completed" || exec.status === "failed") return;
    const id = setInterval(() => {
      window.electronAPI?.getExecution(execId).then(setExec).catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [exec?.status, execId]);

  if (loading) {
    return (
      <div className="view">
        <h1>{t("Detalle de ejecución")}</h1>
        <p className="view-sub">{t("Cargando...")}</p>
      </div>
    );
  }

  if (!exec) {
    return (
      <div className="view">
        <h1>{t("Detalle de ejecución")}</h1>
        <p className="view-sub">{t("No se encontró la ejecución.")}</p>
        <IconButton icon="arrow_back" label={t("Volver a ejecuciones")} onClick={onBack} />
      </div>
    );
  }

  return (
    <div className="exec-detail-view">
      <div className="exec-detail-header">
        <IconButton icon="arrow_back" label={t("Volver")} onClick={onBack} />
        <h1>{t("Detalle de ejecución")}</h1>
      </div>

      {exec.status === "running" && (
        <div className="exec-progress-bar">
          <div className="exec-progress-fill" style={{ width: `${exec.progress}%` }} />
          <span className="exec-progress-text">{exec.progress}%</span>
        </div>
      )}

      {exec.error_message && (
        <div className="exec-detail-error">
          <span className="material-symbols-outlined">warning</span>
          {exec.error_message}
        </div>
      )}

      <div className="exec-detail-scroll">
        <div className="exec-detail-block">
          <div className="exec-detail-compact-row">
            <span className={`exec-badge ${STATUS_CLASS[exec.status]}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{STATUS_ICON[exec.status]}</span>
              {STATUS_LABEL[exec.status]}
            </span>
            <span className="exec-detail-pipe">|</span>
            <span>{exec.model_name}</span>
            <span className="exec-detail-pipe">|</span>
            <span>{exec.scale}x</span>
            <span className="exec-detail-pipe">|</span>
            <span>{exec.output_format.toUpperCase()}</span>
            {exec.input_width > 0 && (
              <>
                <span className="exec-detail-pipe">|</span>
                <span>{exec.input_width}×{exec.input_height} → {exec.input_width * exec.scale}×{exec.input_height * exec.scale}</span>
              </>
            )}
          </div>
          <div className="exec-detail-compact-row exec-detail-compact-secondary">
            <span title={exec.input_file}>
              <span className="exec-detail-muted">in: </span>{exec.input_file.split(/[/\\]/).pop()}
            </span>
            {exec.output_path && (
              <span title={exec.output_path}>
                <span className="exec-detail-muted">out: </span>{exec.output_path.split(/[/\\]/).pop()}
              </span>
            )}
            {exec.file_size && (
              <span><span className="exec-detail-muted">size: </span>{exec.file_size}</span>
            )}
          </div>
          <div className="exec-detail-compact-row exec-detail-compact-timestamps">
            <span>{exec.started_at ? new Date(exec.started_at).toLocaleString() : "—"}</span>
            {exec.completed_at && (
              <span>→ {new Date(exec.completed_at).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>

      {exec.status === "completed" && exec.output_path && (
        <div className="exec-detail-compare">
          <CompareSlider
            beforePath={exec.input_file}
            afterPath={exec.output_path}
            isVideo={exec.output_format === "mp4" || exec.output_format === "webp"}
          />
        </div>
      )}

      <div className="exec-detail-actions">
        <IconButton icon="folder_open" label={t("Abrir carpeta")} />
        <IconButton icon="delete" label={t("Eliminar")} />
      </div>
    </div>
  );
}
