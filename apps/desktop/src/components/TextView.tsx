import { useState, useEffect } from "react";
import { useT } from "../i18n";
import type { TextModel } from "../electron/preload/index";

export function TextView() {
  const { t } = useT();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [hfModels, setHfModels] = useState<TextModel[]>([]);
  const [hfLoading, setHfLoading] = useState(false);

  useEffect(() => {
    setHfLoading(true);
    window.electronAPI?.hfTextLeaderboard()
      .then((models) => models && setHfModels(models))
      .catch(() => {})
      .finally(() => setHfLoading(false));
  }, []);

  const generateText = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setTimeout(() => setGenerating(false), 2000);
  };

  return (
    <div className="text-view">
      <div className="text-panels">
        <div className="text-panel">
          <div className="panel-header">
            <span className="material-symbols-outlined">edit</span>
            <span>{t("Generar texto")}</span>
          </div>
          <textarea
            className="text-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("Escribe tu prompt aquí...")}
            rows={6}
          />
          <button className="gen-btn" onClick={generateText} disabled={generating || !prompt.trim()}>
            {generating ? t("Generando...") : t("Generar (botón)")}
          </button>
        </div>

        <div className="text-panel model-detail-hf-from-hf">
          <div className="panel-header">
            <span className="material-symbols-outlined model-detail-hf-emoji" style={{ color: "#ff9800" }}>hub</span>
            <span>{t("Huggingface Recommendations")}</span>
          </div>
          <div style={{ padding: "10px" }}>
            {hfLoading ? <div className="panel-loading">{t("Cargando...")}</div> :
              hfModels.length > 0 ?
              hfModels.map((m) => (
                <div key={m.id} className="model-detail-hf-title" style={{ marginBottom: "8px", padding: "6px 8px", borderRadius: "6px", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{m.id}</span>
                  <a
                    href={`https://huggingface.co/${m.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="model-detail-hf-external"
                    title="Ver en HuggingFace"
                    style={{ marginLeft: "auto", color: "#ff9800" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>open_in_new</span>
                  </a>
                </div>
              )) :
              <div className="panel-empty">{t("No se encontraron modelos")}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}