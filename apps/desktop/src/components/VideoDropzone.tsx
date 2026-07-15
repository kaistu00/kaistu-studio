import { useRef } from "react";
import { useT } from "../i18n";

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  src: string;
  name: string;
  loadError: boolean;
  mediaInfo?: { name: string; width: number; height: number; size?: string; duration?: string };
  onLoad: (width: number, height: number, duration: number) => void;
  onError: () => void;
  onDrop: (file: File) => void;
}

export function VideoDropzone({ src, name, loadError, mediaInfo, onLoad, onError, onDrop }: Props) {
  const { t } = useT();
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onDrop(file);
  };

  const handleVideoLoad = () => {
    const v = videoRef.current;
    if (v && v.videoWidth) {
      onLoad(v.videoWidth, v.videoHeight, v.duration);
    }
  };

  const hasMedia = !!mediaInfo.name;

  return (
    <div className="upscale-preview" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      {!hasMedia && (
        <div className="preview-placeholder">
          <span className="material-symbols-outlined" style={{ fontSize: 48 }}>movie_creation</span>
          <span>{t("Arrastra video aquí")}</span>
        </div>
      )}

      {hasMedia && !loadError && (
        <div className="preview-video">
          <video ref={videoRef} src={src} controls onLoadedMetadata={handleVideoLoad} onError={onError} style={{ maxWidth: "100%", maxHeight: "100%" }} />
        </div>
      )}

      {hasMedia && loadError && (
        <div className="preview-placeholder">
          <span className="material-symbols-outlined" style={{ fontSize: 48 }}>error</span>
          <span>{t("No se pudo cargar el archivo")}</span>
        </div>
      )}

      <div className="media-info" style={{ display: hasMedia ? "flex" : "none" }}>
          <span className="media-info-item">
            <span className="material-symbols-outlined">title</span>
            {mediaInfo.name}
          </span>
          <span className="media-info-item">
            <span className="material-symbols-outlined">crop</span>
            {mediaInfo.width}×{mediaInfo.height}
          </span>
          {mediaInfo.size && (
            <span className="media-info-item">
              <span className="material-symbols-outlined">storage</span>
              {mediaInfo.size}
            </span>
          )}
          {mediaInfo.duration && (
            <span className="media-info-item">
              <span className="material-symbols-outlined">schedule</span>
              {mediaInfo.duration}
            </span>
          )}
          <span className="media-info-item">
            <span className="material-symbols-outlined">movie</span>
            {t("Video")}
          </span>
        </div>
    </div>
  );
}
