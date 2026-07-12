import { useState } from "react";
import { IconButton } from "./";

type GenerationType = "text" | "image" | "video" | "audio";

const TYPE_LABELS: Record<GenerationType, string> = {
  text: "Texto",
  image: "Imagen",
  audio: "Audio",
  video: "Video",
};

const TYPE_ICONS: Record<GenerationType, string> = {
  text: "text_fields",
  image: "image",
  audio: "music_note",
  video: "movie",
};

export function ContentView({ kind }: { kind: string }) {
  const labels: Record<string, string> = {
    text: "Generación",
    image: "Edición",
    audio: "Análisis",
    video: "Clonación",
  };
  const icons: Record<string, string> = {
    text: "auto_awesome",
    image: "edit",
    audio: "analytics",
    video: "content_copy",
  };
  
  const mainLabel = labels[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
  const mainIcon = icons[kind] ?? "auto_awesome";
  
  // Inside "Generación" tab, show type selector as icon buttons
  const [genType, setGenType] = useState<GenerationType>("text");
  const isGeneration = kind === "text";

  return (
    <div className="view">
      <h1>{mainLabel}</h1>
      <p className="view-sub">{`${mainLabel} con IA.`}</p>
      
      {isGeneration && (
        <div className="gen-type-selector">
          <span className="gen-type-label">Qué quieres generar:</span>
          <div className="gen-type-buttons">
            {(Object.keys(TYPE_LABELS) as GenerationType[]).map((t) => (
              <button
                key={t}
                className={"gen-type-btn " + (genType === t ? "active" : "")}
                onClick={() => setGenType(t)}
                title={TYPE_LABELS[t]}
              >
                <span className="material-symbols-outlined gen-type-icon">{TYPE_ICONS[t]}</span>
                <span className="gen-type-text">{TYPE_LABELS[t]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}