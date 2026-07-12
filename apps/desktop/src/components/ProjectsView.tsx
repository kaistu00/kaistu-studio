import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { withCivitaiRef } from "../utils/civitai";
import { useCivitaiMode } from "../context/CivitaiMode";

export function ProjectsView() {
  const { t } = useT();
  const { mode } = useCivitaiMode();
  const [civitaiConfigured, setCivitaiConfigured] = useState(false);

  useEffect(() => {
    window.electronAPI?.getAPIKeys?.().then((keys) => {
      setCivitaiConfigured(keys.some((k) => k.service === "civitai"));
    }).catch(() => {});
  }, []);

  return (
    <div className="view">
      <h1>{t("Proyectos")}</h1>
      <p className="view-sub">{t("Tus proyectos guardados aparecerán aquí.")}</p>
      {!civitaiConfigured && (
        <div className="civitai-setup-banner">
          <span className="material-symbols-outlined">info</span>
          <span>
            <strong>{t("Configura tu token de Civitai")}:</strong> {t("Permite búsqueda y descarga de modelos.")}{" "}
            <a href={withCivitaiRef("", mode)} target="_blank" rel="noopener noreferrer">civitai.com</a>
          </span>
        </div>
      )}
    </div>
  );
}
