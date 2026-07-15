import { useUpscaleForm, PLACEHOLDER_MODEL } from "./useUpscaleForm";
import { VideoDropzone } from "./VideoDropzone";
import { UpscaleSidebar } from "./UpscaleSidebar";
import type { ViewPath } from "./Sidebar";

export function UpscaleVideoView({ onNavigate }: { onNavigate?: (v: string) => void }) {
  const state = useUpscaleForm("video", "upscale");
  const model = state.selectedModel || PLACEHOLDER_MODEL;

  const handleRun = async () => {
    const exec = await state.handleRun();
    if (exec) onNavigate?.(`execution.${exec.id}` as ViewPath);
  };

  const mediaSrc = state.media?.path ? state.toLocalFileUrl(state.media.path) : "";

  if (state.loading) {
    return (
      <div className="view">
        <p className="view-sub">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="upscale-container">
        <VideoDropzone
          src={mediaSrc}
          name={state.media?.name ?? ""}
          loadError={state.loadError}
          mediaInfo={state.media ? {
            name: state.media.name,
            width: state.media.width ?? 0,
            height: state.media.height ?? 0,
            size: state.media.size,
            duration: state.media.duration,
          } : undefined}
          onLoad={state.handleVideoLoad}
          onError={() => state.setLoadError(true)}
          onDrop={state.handleDrop}
        />
        <UpscaleSidebar
          model={model}
          upscalers={state.upscalers}
          scale={state.scale}
          media={state.media ? {
            name: state.media.name,
            path: state.media.path,
            width: state.media.width,
            height: state.media.height,
            isVideo: true,
            size: state.media.size,
            duration: state.media.duration,
          } : null}
          paramValues={state.paramValues}
          showAdvanced={state.showAdvanced}
          downloading={state.downloading}
          installError={state.installError}
          destDir={state.destDir}
          mode="upscale"
          onModelChange={state.handleModelChange}
          onScaleChange={state.setScale}
          onParamChange={state.setParamValues}
          onToggleAdvanced={() => state.setShowAdvanced(!state.showAdvanced)}
          onDownload={state.handleDownload}
          onRun={handleRun}
          onSelectDest={state.handleSelectDest}
        />
      </div>
    </div>
  );
}