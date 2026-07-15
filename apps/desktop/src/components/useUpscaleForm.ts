import { useState, useEffect, useCallback } from "react";
import { useT } from "../i18n";
import { buildOutputPath } from "../utils/format";
import { formatDuration } from "./VideoDropzone";
import type { UpscalerInfo, ParamValues } from "./UpscaleSidebar";
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

const PLACEHOLDER_MODEL: UpscalerInfo = {
  id: "ffmpeg",
  name: "FFmpeg",
  shortDesc: "Procesamiento sin IA",
  usage: "Los modos Downscaling, Rescaling y Cleaning usan FFmpeg directamente sin requerir modelos de IA.",
  size: "0 MB",
  installed: true,
  downloadsTo: "",
  scales: [],
  defaultScale: 1,
  author: "FFmpeg Team",
  authorUrl: "https://ffmpeg.org",
};

export { PLACEHOLDER_MODEL };

function defaultOutputDir(mediaDir: string, isVideo: boolean): string {
  const sub = isVideo ? "video" : "image";
  return mediaDir + "/output/" + sub;
}

export type { UpscalerInfo, ParamValues } from "./UpscaleSidebar";

interface MediaData {
  name: string;
  path: string;
  isVideo: boolean;
  size: string;
  width: number;
  height: number;
  duration?: string;
}

export type ScaleKind = "image" | "video" | "folder";
export type ScaleMode = "upscale" | "downscale" | "rescale" | "clean";

export function useUpscaleForm(kind: ScaleKind, mode: ScaleMode) {
  const { t } = useT();
  const isFFmpegMode = mode !== "upscale";

  const [upscalers, setUpscalers] = useState<UpscalerInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<UpscalerInfo | null>(() => isFFmpegMode ? PLACEHOLDER_MODEL : null);
  const [scale, setScale] = useState<number>(2);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [paramValues, setParamValues] = useState<ParamValues>({});
  const [media, setMedia] = useState<MediaData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [destDir, setDestDir] = useState<string>("");

  useEffect(() => {
    window.electronAPI.getUpscalers().then((data) => {
      const mapped = data.map(API_TO_LOCAL);
      setUpscalers(mapped);
      if (isFFmpegMode) {
        setSelectedModel(PLACEHOLDER_MODEL);
      } else if (mapped.length > 0) {
        const model = mapped[0];
        setSelectedModel(model);
        setScale(mode === "downscale" ? 0.5 : model.defaultScale);
      }
      setLoading(false);
    });
  }, [isFFmpegMode]);

  useEffect(() => {
    if (isFFmpegMode) {
      setParamValues({});
    }
  }, [isFFmpegMode]);

  const handleModelChange = (id: string) => {
    if (isFFmpegMode) return;
    const m = upscalers.find((u) => u.id === id);
    if (m) {
      setSelectedModel(m);
    }
  };

  const handleDownload = async () => {
    if (isFFmpegMode || !selectedModel) return;
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
    const isVideo = kind === "video" || file.type.startsWith("video/");
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
  };

  const handleSelectDest = async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) setDestDir(folder.replace(/\\/g, "/"));
  };

  const handleImgLoad = (width: number, height: number) => {
    setMedia((prev) => prev ? { ...prev, width, height } : prev);
  };

  const handleVideoLoad = (width: number, height: number, duration: number) => {
    setMedia((prev) => prev ? { ...prev, width, height, duration: formatDuration(duration) } : prev);
  };

  const getRunLabel = useCallback(() => {
    switch (mode) {
      case "upscale": return t("Escalar");
      case "downscale": return t("Reducir");
      case "rescale": return t("Redimensionar");
      case "clean": return t("Limpiar");
    }
  }, [mode]);

  const handleRun = async () => {
    const modelId = selectedModel?.id ?? (isFFmpegMode ? "ffmpeg" : "");
    if (!modelId || !media) return null;
    const fmt = String(paramValues.output_format ?? (media.isVideo ? "mp4" : "png"));
    const dir = destDir || defaultOutputDir(await window.electronAPI.getAppDataPath(), media.isVideo);
    const effectiveScale = mode === "clean" ? 1 : scale;
    const outPath = buildOutputPath(dir, media.name, effectiveScale, fmt);
    const payload: Record<string, unknown> = {
      input_path: media.path,
      output_path: outPath,
      scale: effectiveScale,
      input_width: media.width,
      input_height: media.height,
      file_size: media.size,
      mode,
      params: { ...paramValues, output_format: fmt },
    };
    if (mode === "clean") {
      payload.params = { ...payload.params, noise_strength: paramValues.noise_strength ?? 5 };
    } else if (mode === "rescale") {
      payload.target_width = paramValues.target_width ? Number(paramValues.target_width) : undefined;
      payload.target_height = paramValues.target_height ? Number(paramValues.target_height) : undefined;
    } else if (!isFFmpegMode) {
      payload.face_enhance = !!paramValues.face_enhance;
    }
    try {
      const exec = await window.electronAPI.runUpscaler(modelId, payload);
      return exec;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw err;
    }
  };

  return {
    upscalers,
    selectedModel,
    scale,
    downloading,
    installError,
    showAdvanced,
    paramValues,
    media,
    loadError,
    destDir,
    isFFmpegMode,
    loading,
    setScale,
    setParamValues,
    setShowAdvanced,
    handleModelChange,
    handleDownload,
    handleDrop,
    handleSelectDest,
    handleImgLoad,
    handleVideoLoad,
    handleRun,
    getRunLabel,
    toLocalFileUrl,
  };
}