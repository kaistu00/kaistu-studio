import { useState, useEffect } from "react";
import { useT } from "../i18n";
import { ImageDropzone } from "./ImageDropzone";
import { VideoDropzone, formatDuration } from "./VideoDropzone";
import { buildOutputPath } from "../utils/format";
import { UpscaleSidebar, UpscalerInfo, defaultParamValues, ParamValues } from "./UpscaleSidebar";
import type { Upscaler } from "../../electron/preload/index";

function toLocalFileUrl(winPath: string): string {
  const normalized = winPath.replace(/\\/g, "/");
  return "local-file:///" + encodeURI(normalized);
}

const API_TO_LOCAL = (a: Upscaler): UpscalerInfo => ({
  id: a.model_id,
  name: a.name,
  shortDesc: a.short_desc,
  usage: a.usage,
  size: a.size,
  installed: a.installed,
  downloadsTo: a.downloads_to,
  scales: a.scales,
  defaultScale: a.default_scale,
  author: a.author,
  authorUrl: a.author_url,
});

function defaultOutputDir(mediaDir: string, isVideo: boolean): string {
  const sub = isVideo ? "video" : "image";
  return mediaDir + "/output/" + sub;
}

export function UpscaleView({ onNavigate }: { onNavigate?: (v: string) => void }) {
  const { t } = useT();
  const [upscalers, setUpscalers] = useState<UpscalerInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<UpscalerInfo | null>(null);
  const [scale, setScale] = useState<number>(2);
  const [downloading, setDownloading] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [paramValues, setParamValues] = useState<ParamValues>({});
  const [media, setMedia] = useState<{
    name: string;
    path: string;
    isVideo: boolean;
    size: string;
    width: number;
    height: number;
    duration?: string;
  } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [runningExecId, setRunningExecId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [destDir, setDestDir] = useState<string>("");

  useEffect(() => {
    window.electronAPI.getUpscalers().then((data) => {
      const mapped = data.map(API_TO_LOCAL);
      setUpscalers(mapped);
      if (mapped.length > 0) {
        setSelectedModel(mapped[0]);
        setScale(mapped[0].defaultScale);
        setParamValues(defaultParamValues(mapped[0].id));
      }
    });
  }, []);

  const handleModelChange = (id: string) => {
    const m = upscalers.find((u) => u.id === id);
    if (m) {
      setSelectedModel(m);
      setParamValues(defaultParamValues(m.id, media?.isVideo));
      setScale(m.defaultScale);
    }
  };

  const handleDownload = async () => {
    if (!selectedModel) return;
    setDownloading(true);
    setInstallError(null);
    try {
      await window.electronAPI.installUpscaler(selectedModel.id);
      const data = await window.electronAPI.getUpscalers();
      const mapped = data.map(API_TO_LOCAL);
      setUpscalers(mapped);
      const updated = mapped.find((u) => u.id === selectedModel.id);
      if (updated) setSelectedModel(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setInstallError(msg);
      console.error("Install failed:", msg);
    } finally {
      setDownloading(false);
    }
  };

  const handleDrop = async (file: File) => {
    const size = (file.size / 1024 / 1024).toFixed(2) + " MB";
    const path = window.electronAPI.getFilePath(file) || file.name;
    const isVideo = file.type.startsWith("video/");
    const baseDir = await window.electronAPI.getAppDataPath();

    setLoadError(false);
    setDestDir(defaultOutputDir(baseDir, isVideo));
    setMedia({
      name: file.name,
      path,
      isVideo,
      size,
      width: 1920,
      height: 1080,
    });
    if (selectedModel) {
      setParamValues(defaultParamValues(selectedModel.id, isVideo));
    }
  };

  const handleSelectDest = async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) setDestDir(folder.replace(/\\/g, "/"));
  };

  const handleImgLoad = (width: number, height: number) => {
    setMedia((prev) => prev ? { ...prev, width, height } : prev);
  };

  const handleRun = async () => {
    if (!selectedModel || !media) return;
    setRunError(null);
    setRunningExecId(null);
    const fmt = String(paramValues.output_format ?? (media.isVideo ? "mp4" : "png"));
    const dir = destDir || defaultOutputDir(await window.electronAPI.getAppDataPath(), media.isVideo);
    const outPath = buildOutputPath(dir, media.name, scale, fmt);
    try {
      const faceEnhance = !!paramValues.face_enhance;
      const exec = await window.electronAPI.runUpscaler(selectedModel.id, {
        input_path: media.path,
        output_path: outPath,
        scale,
        input_width: media.width,
        input_height: media.height,
        file_size: media.size,
        face_enhance: faceEnhance,
        params: { ...paramValues, output_format: fmt },
      });
      onNavigate?.(`execution.${exec.id}` as ViewPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunError(msg);
    }
  };

  const isRunning = runningExecId !== null;

  const handleVideoLoad = (width: number, height: number, duration: number) => {
    setMedia((prev) => prev ? { ...prev, width, height, duration: formatDuration(duration) } : prev);
  };

  if (!selectedModel) {
    return (
      <div className="view">
        <h1>{t("Escalado")}</h1>
        <p className="view-sub">{t("Cargando upscalers...")}</p>
      </div>
    );
  }

  const isVideo = media?.isVideo ?? false;
  const mediaSrc = media?.path ? toLocalFileUrl(media.path) : "";
  const mediaName = media?.name ?? "";

  return (
    <div className="view">
      <h1>{t("Escalado")}</h1>
      <p className="view-sub">{t("Upscaling de imÃ¡genes mediante modelos IA.")}</p>

      <div className="upscale-container">
        {isVideo ? (
          <VideoDropzone
            src={mediaSrc}
            name={mediaName}
            loadError={loadError}
            mediaInfo={{
              name: mediaName,
              width: media?.width ?? 0,
              height: media?.height ?? 0,
              size: media?.size,
              duration: media?.duration,
            }}
            onLoad={handleVideoLoad}
            onError={() => setLoadError(true)}
            onDrop={handleDrop}
          />
        ) : (
          <ImageDropzone
            src={mediaSrc}
            name={mediaName}
            loadError={loadError}
            mediaInfo={{
              name: mediaName,
              width: media?.width ?? 0,
              height: media?.height ?? 0,
              size: media?.size,
            }}
            onLoad={handleImgLoad}
            onError={() => setLoadError(true)}
            onDrop={handleDrop}
          />
        )}

        <UpscaleSidebar
          model={selectedModel}
          upscalers={upscalers}
          scale={scale}
          media={media ? { name: media.name, width: media.width, height: media.height, isVideo: media.isVideo, size: media.size, duration: media.duration } : null}
          paramValues={paramValues}
          showAdvanced={showAdvanced}
          downloading={downloading}
          installError={installError}
          destDir={destDir}
          onModelChange={handleModelChange}
          onScaleChange={setScale}
          onParamChange={setParamValues}
          onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
          onDownload={handleDownload}
          onRun={handleRun}
          onSelectDest={handleSelectDest}
          isRunning={isRunning}
        />
      </div>
    </div>
  );
}
