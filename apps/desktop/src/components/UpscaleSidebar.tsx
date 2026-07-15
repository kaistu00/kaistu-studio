import { useT } from "../i18n";
import { buildOutputPath } from "../utils/format";
import { IconButton } from "./IconButton";
export interface MediaInfo {
  name: string;
  path: string;
  width: number;
  height: number;
  isVideo: boolean;
  size: string;
  duration?: string;
}

export interface UpscalerInfo {
  id: string;
  name: string;
  shortDesc: string;
  usage: string;
  size: string;
  installed: boolean;
  downloadsTo: string;
  scales: number[];
  defaultScale: number;
  author: string;
  authorUrl: string;
}

export interface ParamDef {
  key: string;
  label: string;
  type: "number" | "string" | "boolean" | "select";
  default: unknown;
  options?: { label: string; value: string }[];
  description?: string;
  cliFlag: string;
}

export type ParamValues = Record<string, unknown>;

const IMAGE_FORMATS = [
  { label: "PNG (sin pérdida)", value: "png" },
  { label: "JPG (comprimido)", value: "jpg" },
  { label: "WebP (eficiente)", value: "webp" },
];

const VIDEO_FORMATS = [
  { label: "MP4 (H.264)", value: "mp4" },
  { label: "PNG (secuencia)", value: "png" },
  { label: "WebP (video)", value: "webp" },
];

const BASE_PARAMS: ParamDef[] = [
  { key: "tile_size", label: "Tile size", type: "number", default: 0, cliFlag: "-t", description: "Divide la imagen en fragmentos (tiles) para reducir el uso de VRAM. 0 = automático. Útil si tienes poca memoria GPU o imágenes grandes. Valores típicos: 100-400." },
  { key: "gpu_id", label: "GPU device", type: "number", default: 0, cliFlag: "-g", description: "Selecciona qué GPU usar si tienes varias. 0 = primera GPU, 1 = segunda, etc." },
  { key: "threads", label: "Threads (load:proc:save)", type: "string", default: "1:2:2", cliFlag: "-j", description: "Hilos de CPU para cargar, procesar y guardar. Más hilos acelera pero usa más CPU. Formato: carga:procesamiento:guardado." },
  { key: "tta", label: "TTA mode", type: "boolean", default: false, cliFlag: "-x", description: "Test-time augmentation — procesa la imagen con 8 aumentos y promedia el resultado. Mejora calidad pero es 8× más lento." },
];

export type ScaleMode = "upscale" | "downscale" | "rescale" | "clean";

const DOWNSCALE_RATIOS = [
  { label: "1/2 (50%)", value: 0.5 },
  { label: "1/4 (25%)", value: 0.25 },
  { label: "1/8 (12.5%)", value: 0.125 },
];

const MODEL_PARAMS: Record<string, ParamDef[]> = {
  realesrgan_x4plus: BASE_PARAMS,
  realesrnet_x4plus: BASE_PARAMS,
  realesrgan_x4plus_anime: BASE_PARAMS,
  realesr_animevideov3: BASE_PARAMS,
};

export function getOutputFormatDef(isVideo?: boolean): ParamDef {
  const formats = isVideo ? VIDEO_FORMATS : IMAGE_FORMATS;
  const defaultVal = isVideo ? "mp4" : "png";
  return {
    key: "output_format",
    label: "Output format",
    type: "select",
    default: defaultVal,
    options: formats,
    cliFlag: "-f",
    description: "Formato de salida.",
  };
}

const FORMAT_INFO: Record<string, string> = {
  png: "Sin pérdida — preserva cada detalle de píxel. Archivo más grande que JPG/WebP.",
  jpg: "Con pérdida — reduce tamaño eliminando datos imperceptibles. Más pequeño que PNG.",
  webp: "Compresión moderna — calidad similar a PNG con tamaño cercano a JPG. Ideal para web.",
  mp4: "Video H.264 — comprimido, máxima compatibilidad con reproductores y editores.",
};

export function getParams(modelId: string): ParamDef[] {
  const key = modelId.replace(/-/g, "_");
  return MODEL_PARAMS[key] ?? BASE_PARAMS;
}

export function defaultParamValues(modelId: string, isVideo?: boolean, mode?: ScaleMode): ParamValues {
  const vals: ParamValues = {};
  for (const p of getParams(modelId)) {
    vals[p.key] = p.default;
  }
  const fmt = getOutputFormatDef(isVideo);
  vals[fmt.key] = fmt.default;
  vals.face_enhance = false;
  vals.scale = 4;
  if (mode === "clean") {
    vals.noise_strength = 5;
  } else if (mode === "downscale") {
    vals.scale = 0.5;
  }
  return vals;
}

export function getRunLabel(mode: ScaleMode): string {
  switch (mode) {
    case "upscale": return "Escalar";
    case "downscale": return "Reducir";
    case "rescale": return "Redimensionar";
    case "clean": return "Limpiar";
  }
}

interface Props {
  model: UpscalerInfo;
  upscalers: UpscalerInfo[];
  scale: number;
  media: MediaInfo | null;
  paramValues: ParamValues;
  showAdvanced: boolean;
  downloading: boolean;
  installError: string | null;
  destDir?: string;
  isRunning?: boolean;
  mode?: ScaleMode;
  onModelChange: (id: string) => void;
  onScaleChange: (s: number) => void;
  onParamChange: (values: ParamValues) => void;
  onToggleAdvanced: () => void;
  onDownload: () => void;
  onRun?: () => void;
  onSelectDest?: () => void;
}

export function UpscaleSidebar(props: Props) {
  const { t } = useT();
  const { model, upscalers, scale, media, paramValues, showAdvanced, downloading, installError, destDir, isRunning, mode = "upscale", onModelChange, onScaleChange, onParamChange, onToggleAdvanced, onDownload, onRun, onSelectDest } = props;

  const setParam = (key: string, value: unknown) => {
    onParamChange({ ...paramValues, [key]: value });
  };

  const scaleMode = mode;
  const isFFmpegMode = scaleMode !== "upscale";

  const outW = media ? (scaleMode === "rescale" ? (paramValues.target_width as number) || media.width : media.width * scale) : 0;
  const outH = media ? (scaleMode === "rescale" ? (paramValues.target_height as number) || media.height : media.height * scale) : 0;
  const megapixels = (outW * outH) / 1_000_000;
  const fmt = String(paramValues.output_format ?? "png");
  const mbPerMp: Record<string, number> = { png: 2.5, jpg: 0.6, webp: 0.4 };
  const estMb = fmt === "mp4" ? null : (megapixels * (mbPerMp[fmt] ?? 1.5)).toFixed(1);

  return (
    <div className="upscale-sidebar">
      <div className="upscale-sidebar-main">
        {!isFFmpegMode && (
          <>
            <div className="upscale-section-title">{t("Modelo")}</div>
            <div className="upscale-selector">
              <select className="upscale-dropdown" value={model.id} onChange={(e) => onModelChange(e.target.value)}>
                {upscalers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </select>
              <span className="upscale-short-desc">{model.shortDesc}</span>
              <div className="upscale-usage">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                {model.usage}
              </div>
              <a className="upscale-author" href={model.authorUrl} target="_blank" rel="noopener noreferrer">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>favorite</span>
                {model.author}
              </a>
            </div>
          </>
        )}

        {scaleMode === "rescale" && media && (
          <>
            <div className="upscale-section-title">{t("Dimensiones objetivo")}</div>
            <div className="upscale-rescale-fields">
              <input
                className="upscale-param-input upscale-rescale-input"
                type="number"
                placeholder={String(media.width)}
                value={paramValues.target_width ?? ""}
                onChange={(e) => setParam("target_width", Number(e.target.value))}
              />
              <span className="upscale-rescale-x">x</span>
              <input
                className="upscale-param-input upscale-rescale-input"
                type="number"
                placeholder={String(media.height)}
                value={paramValues.target_height ?? ""}
                onChange={(e) => setParam("target_height", Number(e.target.value))}
              />
            </div>
          </>
        )}

        {scaleMode === "clean" && (
          <>
            <div className="upscale-section-title">{t("Reduce ruido")}</div>
            <div className="upscale-selector">
              <input
                className="upscale-param-input"
                type="number"
                min={1}
                max={10}
                value={paramValues.noise_strength ?? 5}
                onChange={(e) => setParam("noise_strength", Number(e.target.value))}
              />
              <span className="upscale-short-desc">1-10 (mas alto = mas suavizado)</span>
            </div>
          </>
        )}

        {scaleMode === "downscale" && (
          <>
            <div className="upscale-section-title">{t("Ratio reduccion")}</div>
            <div className="upscale-scales">
              {DOWNSCALE_RATIOS.map((r) => (
                <button
                  key={r.value}
                  className={`upscale-scale-btn${scale === r.value ? " active" : ""}`}
                  onClick={() => onScaleChange(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </>
        )}

        {scaleMode === "upscale" && (
          <>
            <div className="upscale-section-title">{t("Factor de escala")}</div>
            <div className="upscale-scales">
              {model.scales.map((s) => (
                <button
                  key={s}
                  className={`upscale-scale-btn${scale === s ? " active" : ""}`}
                  onClick={() => onScaleChange(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
          </>
        )}

        {media && (
          <div className="upscale-preview-info">
            <span className="upscale-preview-res">
              {media.width}×{media.height} <span className="upscale-preview-arrow">→</span> {outW}×{outH}
            </span>
            {estMb && (
              <span className="upscale-preview-size">
                ~{estMb} MB ({fmt.toUpperCase()})
              </span>
            )}
          </div>
        )}

        <div className="upscale-section-title">{t("Formato de salida")}</div>
        <div className="upscale-selector">
          <select
            className="upscale-dropdown"
            value={String(paramValues.output_format ?? (media?.isVideo ? "mp4" : "png"))}
            onChange={(e) => setParam("output_format", e.target.value)}
          >
            {(media?.isVideo ? VIDEO_FORMATS : IMAGE_FORMATS).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="upscale-short-desc">
            {FORMAT_INFO[String(paramValues.output_format ?? (media?.isVideo ? "mp4" : "png"))] ?? ""}
          </span>
        </div>

        {!isFFmpegMode && (
          <label className="upscale-face-enhance">
            <input
              type="checkbox"
              checked={!!paramValues.face_enhance}
              onChange={(e) => setParam("face_enhance", e.target.checked)}
            />
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>face</span>
            {t("Mejora facial (GFPGAN)")}
          </label>
        )}

        <div className="upscale-section-title">{t("Destino")}</div>
        <div className="upscale-selector">
          <div className="upscale-dest-row">
            <input
              className="upscale-param-input upscale-dest-input"
              type="text"
              value={destDir || ""}
              readOnly
              placeholder={media ? t("Selecciona carpeta de destino") : ""}
            />
            <button className="upscale-dest-btn" onClick={onSelectDest} title={t("Seleccionar carpeta")}>
              <span className="material-symbols-outlined">folder</span>
            </button>
          </div>
          {media && destDir && (
            <span className="upscale-short-desc">
              {buildOutputPath(destDir, media.name, scale, String(paramValues.output_format ?? (media.isVideo ? "mp4" : "png")))}
            </span>
          )}
        </div>

        {!isFFmpegMode && model.installed && (
          <div className="upscale-advanced">
            <button className="upscale-advanced-toggle upscale-section-title" onClick={onToggleAdvanced}>
              {t("Parámetros avanzados")}
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {showAdvanced ? "expand_less" : "expand_more"}
              </span>
            </button>
            {showAdvanced && (
              <div className="upscale-advanced-body">
                {getParams(model.id).map((param) => (
                  <label key={param.key} className="upscale-param">
                    <span className="upscale-param-label">
                      {param.label}
                      <span className="material-symbols-outlined upscale-param-info" title={param.description || param.cliFlag}>info</span>
                    </span>
                    {param.type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={!!paramValues[param.key]}
                        onChange={(e) => setParam(param.key, e.target.checked)}
                      />
                    ) : param.type === "select" ? (
                      <select
                        className="upscale-param-select"
                        value={String(paramValues[param.key] ?? param.default)}
                        onChange={(e) => setParam(param.key, e.target.value)}
                      >
                        {(param.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="upscale-param-input"
                        type="text"
                        value={String(paramValues[param.key] ?? param.default)}
                        onChange={(e) => {
                          const v = param.type === "number" ? Number(e.target.value) : e.target.value;
                          setParam(param.key, v);
                        }}
                      />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="upscale-sidebar-bottom">
        {!isFFmpegMode ? (
          <div className="upscale-status">
            {model.installed ? (
              <span className="installed-check">
                <span className="material-symbols-outlined" style={{ color: "var(--success)", fontSize: 20 }}>check_circle</span>
                <span>{t("Instalado")}</span>
              </span>
            ) : downloading ? (
              <span className="installing-check">
                <span className="material-symbols-outlined" style={{ color: "var(--accent)", fontSize: 20 }}>schedule</span>
                <span>{t("Instalando...")}</span>
              </span>
            ) : installError ? (
              <span className="missing-check">
                <span className="material-symbols-outlined" style={{ color: "var(--error)", fontSize: 20 }}>cancel</span>
                <span>{t("Error")}: {installError}</span>
              </span>
            ) : (
              <>
                <span className="missing-check">
                  <span className="material-symbols-outlined" style={{ color: "var(--error)", fontSize: 20 }}>cancel</span>
                  <span>{t("No instalado")} ({model.size})</span>
                </span>
                <IconButton
                  icon="download"
                  label={t("Descargar")}
                  className="upscale-download-btn"
                  onClick={onDownload}
                />
              </>
            )}
          </div>
        ) : (
          <div />
        )}
        <button
          className="upscale-run-btn"
          disabled={(!isFFmpegMode && !model.installed) || !media || isRunning}
          title={
            isRunning
              ? t("Ejecutando...")
              : !media
                ? t("Arrastra una imagen o video primero")
                : !isFFmpegMode && !model.installed
                  ? t("Instala el modelo primero")
                  : undefined
          }
          onClick={onRun}
>
           <span className="material-symbols-outlined">{isRunning ? "sync" : (isFFmpegMode ? "magnification_small" : "play_arrow")}</span>
           {isRunning ? t("Ejecutando...") : getRunLabel(scaleMode)}
         </button>
      </div>
    </div>
  );
}
