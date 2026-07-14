import { useRef } from "react";
import { useT } from "../i18n";

interface Props {
  src: string;
  name: string;
  loadError: boolean;
  mediaInfo: { name: string; width: number; height: number; size?: string };
  onLoad: (width: number, height: number) => void;
  onError: () => void;
  onDrop: (file: File) => void;
}

export function ImageDropzone({ src, name, loadError, mediaInfo, onLoad, onError, onDrop }: Props) {
  const { t } = useT();
  const imgRef = useRef<HTMLImageElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onDrop(file);
  };

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (img && img.naturalWidth) {
      onLoad(img.naturalWidth, img.naturalHeight);
    }
  };

  const hasMedia = !!mediaInfo.name;

  return (
    <div className="upscale-preview" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      {!hasMedia && (
        <div className="preview-placeholder">
          <span className="material-symbols-outlined" style={{ fontSize: 48 }}>image</span>
          <span>{t("Arrastra imagen aquí")}</span>
        </div>
      )}

      {hasMedia && !loadError && (
        <div className="preview-image">
          <img ref={imgRef} src={src} onLoad={handleImgLoad} onError={onError} alt={name} />
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
          <span className="media-info-item">
            <span className="material-symbols-outlined">image</span>
            {t("Imagen")}
          </span>
        </div>
    </div>
  );
}
