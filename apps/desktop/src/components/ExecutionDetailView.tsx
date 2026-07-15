import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { IconButton } from "./IconButton";
import { CompareSlider } from "./CompareSlider";
import { Breadcrumb } from "./Breadcrumb";
import { buildOutputPath } from "../utils/format";
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function rebuildOutputPath(exec: Execution): string {
  const parts = exec.input_file.split(/[/\\]/);
  const filename = parts[parts.length - 1] || "output";
  const ext = filename.split(".").pop() || "png";
  const baseName = filename.replace("." + ext, "");
  const outFormat = exec.output_format || "png";
  return buildOutputPath(
    `${window.electronAPI.getAppDataPath()}/output/${outFormat === "mp4" ? "video" : "image"}`,
    baseName,
    exec.scale,
    outFormat
  );
}

export function ExecutionDetailView({ execId, onBack }: Props) {
   const { t } = useT();
   const [exec, setExec] = useState<Execution | null>(null);
   const [loading, setLoading] = useState(true);
   const [outputSize, setOutputSize] = useState<string | null>(null);

   useEffect(() => {
     if (!execId) return;
     window.electronAPI?.getExecution(execId)
       .then(setExec)
       .catch(() => {})
       .finally(() => setLoading(false));
   }, [execId]);

 useEffect(() => {
     if (!exec?.output_path) {
       setOutputSize(null);
       return;
     }
     window.electronAPI?.getFileSize(exec.output_path)
       .then((size) => setOutputSize(size ? formatFileSize(parseInt(size)) : null))
       .catch(() => {});
   }, [exec?.output_path]);

 useEffect(() => {
    if (!exec || exec.status === "completed" || exec.status === "failed" || exec.status === "cancelled") return;
    const id = setInterval(() => {
      window.electronAPI?.getExecution(execId).then(setExec).catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [exec?.status, execId]);

   const handleReRun = async () => {
     if (!exec) return;
     try {
       const params = JSON.parse(exec.params_json || "{}");
       const outputPath = exec.output_path || rebuildOutputPath(exec);
       const payload: Record<string, unknown> = {
         exec_id: exec.id,
         input_path: exec.input_file,
         output_path: outputPath,
         scale: exec.scale,
         input_width: exec.input_width,
         input_height: exec.input_height,
         file_size: exec.file_size,
         params,
       };
       await window.electronAPI?.runUpscaler(exec.model_id, payload);
     } catch (err) {
       console.error("re-run failed:", err);
     }
   };

   const handleCancel = async () => {
     if (!exec || exec.status !== "running") return;
     try {
       await window.electronAPI?.cancelExecution?.(exec.id);
     } catch (err) {
       console.error("cancel failed:", err);
     }
   };

   const handleOpen = (path: string) => window.electronAPI?.openFile(path);
   const handleSaveAs = (path: string) => window.electronAPI?.saveFileAs(path);
   const handleReveal = (path: string) => window.electronAPI?.revealInFolder(path);

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
        <IconButton icon="arrow_back" iconOnly label={t("Volver a ejecuciones")} onClick={onBack} />
      </div>
    );
  }

   return (
    <div className="exec-detail-view">
      <div className="exec-detail-header">
        <Breadcrumb crumbs={[
          { label: t("Ejecuciones"), tab: "executions" },
          { label: t("Detalle") },
        ]} onNavigate={onBack} />
      </div>

      {exec.error_message && (
        <div className="exec-detail-error">
          <span className="material-symbols-outlined">warning</span>
          {exec.error_message}
        </div>
      )}

      <div className="exec-detail-info">
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
          <span className="exec-detail-pipe">|</span>
          <span>{exec.file_size || "—"}{outputSize && ` → ${outputSize}`}</span>
        {exec.started_at && (
          <>
            <span className="exec-detail-pipe">|</span>
            <span>{new Date(exec.started_at).toLocaleString()}</span>
          </>
        )}
        {exec.completed_at && (
          <span> → {new Date(exec.completed_at).toLocaleString()}</span>
        )}
      </div>

      <div className="exec-detail-files">
        <div className="exec-detail-file">
          <span className="exec-detail-file-label">Original</span>
          <span className="exec-detail-file-name" title={exec.input_file}>{exec.input_file.split(/[/\\]/).pop()}</span>
          <div className="exec-detail-file-actions">
            <IconButton icon="open_in_new" iconOnly label="Abrir" className="exec-file-btn" onClick={() => handleOpen(exec.input_file)} />
            <IconButton icon="download" iconOnly label="Descargar" className="exec-file-btn" onClick={() => handleSaveAs(exec.input_file)} />
            <IconButton icon="folder_open" iconOnly label="Carpeta" className="exec-file-btn" onClick={() => handleReveal(exec.input_file)} />
          </div>
        </div>
        {exec.output_path && (
          <div className="exec-detail-file">
            <span className="exec-detail-file-label">Resultado</span>
            <span className="exec-detail-file-name" title={exec.output_path}>{exec.output_path.split(/[/\\]/).pop()}</span>
            <div className="exec-detail-file-actions">
              <IconButton icon="open_in_new" iconOnly label="Abrir" className="exec-file-btn" onClick={() => handleOpen(exec.output_path!)} />
              <IconButton icon="download" iconOnly label="Descargar" className="exec-file-btn" onClick={() => handleSaveAs(exec.output_path!)} />
              <IconButton icon="folder_open" iconOnly label="Carpeta" className="exec-file-btn" onClick={() => handleReveal(exec.output_path!)} />
            </div>
          </div>
        )}
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
        {exec.status === "running" ? (
          <IconButton icon="close" iconOnly label={t("Cancelar")} className="exec-btn-cancel" onClick={handleCancel} />
        ) : (
          <>
            <IconButton icon="replay" iconOnly label={t("Re-ejecutar")} className="exec-btn-rerun" onClick={handleReRun} />
            <IconButton icon="delete" iconOnly label={t("Eliminar")} className="exec-btn-delete" />
          </>
        )}
      </div>

      {exec.status === "cancelled" && (
        <div className="exec-detail-cancelled">
          <span className="material-symbols-outlined">close</span>
          {t("Ejecución cancelada")}
        </div>
      )}
    </div>
  );
}