import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { MenuAction } from "@kaistu/shared";

export interface SystemStats {
  cpu: number;
  memory: { usedGB: number; totalGB: number; percent: number };
  gpus: Array<{ name: string; utilization: number; memoryUsedMB: number; memoryTotalMB: number }>;
}

export interface GPUInfo {
  index: number;
  name: string;
  vram_total_mb: number;
  vram_free_mb: number;
}

export interface SystemCapabilities {
  gpu_type: "nvidia" | "amd" | "apple" | "intel" | "none";
  gpus: GPUInfo[];
  ram_gb: number;
  cpu_count: number;
  platform: string;
  python_version: string;
  pytorch_backend: string | null;
  capability_level: number;
  capability_name: string;
  features: string[];
  all_features: Array<{ name: string; available: boolean; required_level: string; reason: string | null }>;
  venv: {
    python: string;
    executable: string;
    prefix: string;
    is_venv: boolean;
    package_count: number;
    packages: Array<{ name: string; version: string }>;
  };
}

export interface DiscoveredPath {
  label: string;
  path: string;
}

export interface ModelInfo {
  name: string;
  path: string;
  type: string;
  sizeMB: number;
  software: string;
}

export interface TextModel {
  id: string;
}

export interface HFModelResult {
  primary: {
    id: string;
    downloads: number;
    likes: number;
    pipeline_tag: string;
    description: string;
    tags: string[];
    author: string;
    safetensors: number | null;
    license: string;
    files: string[];
  } | null;
  secondary: Array<{
    id: string; downloads: number; likes: number; pipeline_tag: string;
    description: string; tags: string[]; author: string; safetensors: number | null;
    license: string; cardData: any; files: string[];
  }>;
  variants: string[];
}

export interface CivitaiModelResult {
  primary: {
    id: number;
    name: string;
    type: string;
    nsfw: boolean;
    description: string;
    tags: string[];
    downloadCount: number;
    thumbsUpCount: number;
    creator: { username: string };
    modelVersions: Array<{
      id: number;
      name: string;
      downloadUrl: string;
      files: Array<{ name: string; primary: boolean }>;
    }>;
  } | null;
  secondary: Array<{
    id: number;
    name: string;
    type: string;
  }>;
}

export interface Upscaler {
  model_id: string;
  name: string;
  short_desc: string;
  usage: string;
  size: string;
  downloads_to: string;
  scales: number[];
  default_scale: number;
  author: string;
  author_url: string;
  installed: boolean;
}

export interface Execution {
  id: string;
  model_id: string;
  model_name: string;
  input_file: string;
  input_width: number;
  input_height: number;
  file_size: string;
  output_format: string;
  scale: number;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  started_at: string;
  completed_at: string | null;
  output_path: string | null;
  error_message: string | null;
  params_json: string;
}

export interface ExecStats {
  total: number;
  completed: number;
  running: number;
  failed: number;
}

export interface SpaceInfo {
  reliability: string;
  success_rate: number | null;
  error?: string;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  onMenuAction: (callback: (action: MenuAction) => void) => () => void;
  backendHealth: () => Promise<{ status: string; service: string }>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onWindowState: (callback: (state: "maximized" | "normal") => void) => () => void;
  showRootMenu: () => Promise<void>;
  getSystemStats: () => Promise<SystemStats>;
  getSystemCapabilities: () => Promise<SystemCapabilities>;
  getModelPaths: () => Promise<string[]>;
  setModelPaths: (paths: string[]) => Promise<void>;
  scanModels: (sources: Array<{ path: string; label: string }>) => Promise<ModelInfo[]>;
  discoverModelPaths: () => Promise<DiscoveredPath[]>;
  revealInFolder: (path: string) => Promise<void>;
  deleteModel: (path: string) => Promise<void>;
  downloadModel: (url: string, filename: string, type: string) => Promise<{ success: boolean; path: string }>;
  searchHFModel: (query: string) => Promise<HFModelResult | null>;
  searchCivitaiModel: (query: string, nsfw?: boolean) => Promise<CivitaiModelResult | null>;
  getAPIKeys: () => Promise<Array<{ service: string }>>;
  saveAPIKey: (payload: { service: string; api_key: string }) => Promise<{ service: string }>;
  deleteAPIKey: (service: string) => Promise<void>;
  runInTerminal: (cmd: string) => Promise<{ stdout: string; stderr: string }>;
  getLogs: () => Promise<string>;
  getTerminalInfo: () => Promise<{ user: string; host: string; cwd: string; venv: string }>;
  onLogEntry: (callback: (entry: string) => void) => () => void;
  hfTextLeaderboard: () => Promise<TextModel[]>;
  getFilePath: (file: File) => string;
  getUpscalers: () => Promise<Upscaler[]>;
  installUpscaler: (modelId: string) => Promise<Upscaler>;
  runUpscaler: (modelId: string, payload: Record<string, unknown>) => Promise<Execution>;
  selectFolder: () => Promise<string | null>;
  listExecutions: () => Promise<Execution[]>;
  getExecution: (execId: string) => Promise<Execution>;
  getExecutionStats: () => Promise<ExecStats>;
  getAppDataPath: () => Promise<string>;
  openFile: (path: string) => Promise<void>;
  saveFileAs: (sourcePath: string) => Promise<string | null>;
}

const electronAPI: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  onMenuAction: (callback: (action: MenuAction) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: MenuAction) => callback(action);
    ipcRenderer.on("menu-action", handler);
    return () => ipcRenderer.removeListener("menu-action", handler);
  },

  backendHealth: () => ipcRenderer.invoke("backend-health"),

  minimizeWindow: () => ipcRenderer.invoke("minimize-window"),
  maximizeWindow: () => ipcRenderer.invoke("maximize-window"),
  closeWindow: () => ipcRenderer.invoke("close-window"),
  isMaximized: () => ipcRenderer.invoke("is-maximized"),

  onWindowState: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: "maximized" | "normal") =>
      callback(state);
    ipcRenderer.on("window-state", handler);
    return () => ipcRenderer.removeListener("window-state", handler);
  },

  showRootMenu: () => ipcRenderer.invoke("show-root-menu"),
  getSystemStats: () => ipcRenderer.invoke("get-system-stats"),
  getSystemCapabilities: () => ipcRenderer.invoke("get-system-capabilities"),
  getModelPaths: () => ipcRenderer.invoke("get-model-paths"),
  setModelPaths: (paths) => ipcRenderer.invoke("set-model-paths", paths),
  scanModels: (sources) => ipcRenderer.invoke("scan-models", sources),
  discoverModelPaths: () => ipcRenderer.invoke("discover-model-paths"),
  revealInFolder: (path) => ipcRenderer.invoke("reveal-in-folder", path),
  deleteModel: (path) => ipcRenderer.invoke("delete-model", path),
  downloadModel: (url, filename, type) => ipcRenderer.invoke("download-model", url, filename, type),
  searchHFModel: (query) => ipcRenderer.invoke("search-hf-model", query),
  searchCivitaiModel: (query, nsfw) => ipcRenderer.invoke("search-civitai-model", query, nsfw),
  getAPIKeys: () => ipcRenderer.invoke("get-api-keys"),
  saveAPIKey: (payload) => ipcRenderer.invoke("save-api-key", payload),
  deleteAPIKey: (service) => ipcRenderer.invoke("delete-api-key", service),
  runInTerminal: (cmd: string) => ipcRenderer.invoke("run-in-terminal", cmd),
  getLogs: () => ipcRenderer.invoke("get-logs"),
  getTerminalInfo: () => ipcRenderer.invoke("get-terminal-info"),
  onLogEntry: (callback: (entry: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: string) => callback(entry);
    ipcRenderer.on("log-entry", handler);
    return () => ipcRenderer.removeListener("log-entry", handler);
  },
  hfTextLeaderboard: () => ipcRenderer.invoke("hf-text-leaderboard"),
   getFilePath: (file: File) => webUtils.getPathForFile(file),
   getUpscalers: () => ipcRenderer.invoke("get-upscalers"),
   installUpscaler: (modelId: string) => ipcRenderer.invoke("install-upscaler", modelId),
   runUpscaler: (modelId: string, payload) => ipcRenderer.invoke("run-upscaler", modelId, payload),
   selectFolder: () => ipcRenderer.invoke("select-folder"),
   listExecutions: () => ipcRenderer.invoke("list-executions"),
   getExecution: (execId) => ipcRenderer.invoke("get-execution", execId),
   getExecutionStats: () => ipcRenderer.invoke("get-execution-stats"),
  getAppDataPath: () => ipcRenderer.invoke("get-app-data-path"),
  openFile: (path: string) => ipcRenderer.invoke("open-file", path),
  saveFileAs: (sourcePath: string) => ipcRenderer.invoke("save-file-as", sourcePath),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);