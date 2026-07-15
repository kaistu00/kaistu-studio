import { useState } from "react";
import { useT } from "../i18n";
import { IconButton } from "./IconButton";

interface Props {
  onNavigate: (view: string) => void;
}

type ScaleMode = "upscale" | "downscale" | "rescale" | "clean";
type ScaleType = "image" | "video" | "folder";

export function ScaleSelectionView({ onNavigate }: Props) {
  const { t } = useT();
  const [scaleMode, setScaleMode] = useState<ScaleMode>("upscale");
  const [scaleType, setScaleType] = useState<ScaleType>("image");

  const modes: { id: ScaleMode; icon: string; label: string; desc: string; disabled?: boolean }[] = [
    { id: "upscale", icon: "magnification_large", label: t("Upscaling"), desc: t("Aumentar resolución") },
    { id: "downscale", icon: "magnification_small", label: t("Downscaling"), desc: t("Reducir resolución") },
    { id: "rescale", icon: "aspect_ratio", label: t("Rescaling"), desc: t("Redimensionar") },
    { id: "clean", icon: "cleaning_services", label: t("Clean"), desc: t("Eliminar ruido") },
  ];

  const types: { id: ScaleType; icon: string; label: string; desc: string; disabled?: boolean }[] = [
    { id: "image", icon: "image", label: t("Imagen"), desc: t("Una sola imagen") },
    { id: "video", icon: "movie", label: t("Video"), desc: t("Archivo de video") },
    { id: "folder", icon: "folder", label: t("Carpeta"), desc: t("Procesar lote") },
  ];

  const handleContinue = () => {
    const selectedMode = modes.find(m => m.id === scaleMode);
    const selectedType = types.find(t => t.id === scaleType);
    if (selectedMode?.disabled || selectedType?.disabled) return;
    onNavigate(`${scaleMode}-${scaleType}` as string);
  };

  const isDisabled = (m: { id: ScaleMode | ScaleType; disabled?: boolean }) => m.disabled;

  return (
    <div className="view">
      <h1>{t("Escalado")}</h1>
      <p className="view-sub">{t("Selecciona modo y tipo de contenido.")}</p>

      <div className="scale-selection-row">
        <h3>{t("Tipo")}</h3>
        <div className="scale-options">
          {types.map((tp) => (
            <button
              key={tp.id}
              className={`scale-option ${scaleType === tp.id ? "selected" : ""} ${tp.disabled ? "disabled" : ""}`}
              onClick={() => !tp.disabled && setScaleType(tp.id)}
            >
              <span className="material-symbols-outlined scale-option-icon">{tp.icon}</span>
              <span className="scale-option-label">{tp.label}</span>
              <span className="scale-option-desc">{tp.desc}</span>
              {tp.disabled && <span className="scale-option-soon">{t("Próximamente")}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="scale-selection-row">
        <h3>{t("Modo")}</h3>
        <div className="scale-options">
          {modes.map((m) => (
            <button
              key={m.id}
              className={`scale-option ${scaleMode === m.id ? "selected" : ""} ${m.disabled ? "disabled" : ""}`}
              onClick={() => !m.disabled && setScaleMode(m.id)}
            >
              <span className="material-symbols-outlined scale-option-icon">{m.icon}</span>
              <span className="scale-option-label">{m.label}</span>
              <span className="scale-option-desc">{m.desc}</span>
              {m.disabled && <span className="scale-option-soon">{t("Próximamente")}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="scale-selection-actions">
        <button className="scale-btn-primary" onClick={handleContinue}>
          <span className="material-symbols-outlined">arrow_forward</span>
          {t("Continuar")}
        </button>
      </div>
    </div>
  );
}