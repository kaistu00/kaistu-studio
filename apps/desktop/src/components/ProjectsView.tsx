import { useEffect, useState } from "react";
import { useT } from "../i18n";

export function ProjectsView() {
  const { t } = useT();
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
          <span><strong>{t("Configura tu token de Civitai")}:</strong> {t("Permite búsqueda y descarga de modelos.")}</span>
        </div>
      )}
    </div>
  );
}
