import { contextBridge, ipcRenderer } from "electron";
import type { MenuAction } from "@kaistu/shared";

export interface SystemStats {
  cpu: number;
  memory: { usedGB: number; totalGB: number; percent: number };
  gpus: Array<{ name: string; utilization: number; memoryUsedMB: number; memoryTotalMB: number }>;
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

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  onMenuAction: (callback: (action: MenuAction) => void) => () => void;
  backendHealth: () => Promise<{ status: string; service: string }>;
  generate: (input: { prompt: string; mediaType: string }) => Promise<unknown>;
  listProjects: () => Promise<unknown>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onWindowState: (callback: (state: "maximized" | "normal") => void) => () => void;
  showMenu: (menuKey: string) => Promise<void>;
  showRootMenu: () => Promise<void>;
  getSystemStats: () => Promise<SystemStats>;
  getModelPaths: () => Promise<string[]>;
  setModelPaths: (paths: string[]) => Promise<void>;
  scanModels: (sources: Array<{ path: string; label: string }>) => Promise<ModelInfo[]>;
  discoverModelPaths: () => Promise<DiscoveredPath[]>;
  getConfig: () => Promise<Record<string, unknown>>;
  setConfig: (cfg: Record<string, unknown>) => Promise<void>;
  searchHFModel: (query: string) => Promise<HFModelResult | null>;
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
    cardData: any;
  } | null;
  secondary: Array<{
    id: string; downloads: number; likes: number; pipeline_tag: string;
    description: string; tags: string[]; author: string; safetensors: number | null;
    license: string; cardData: any;
  }>;
  variants: string[];
}

const electronAPI: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  onMenuAction: (callback: (action: MenuAction) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: MenuAction) => callback(action);
    ipcRenderer.on("menu-action", handler);
    return () => ipcRenderer.removeListener("menu-action", handler);
  },

  backendHealth: () => ipcRenderer.invoke("backend-health"),
  generate: (input) => ipcRenderer.invoke("generate", input),
  listProjects: () => ipcRenderer.invoke("list-projects"),

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

  showMenu: (menuKey) => ipcRenderer.invoke("show-menu", menuKey),
  showRootMenu: () => ipcRenderer.invoke("show-root-menu"),
  getSystemStats: () => ipcRenderer.invoke("get-system-stats"),
  getModelPaths: () => ipcRenderer.invoke("get-model-paths"),
  setModelPaths: (paths) => ipcRenderer.invoke("set-model-paths", paths),
  scanModels: (sources) => ipcRenderer.invoke("scan-models", sources),
  discoverModelPaths: () => ipcRenderer.invoke("discover-model-paths"),
  getConfig: () => ipcRenderer.invoke("get-config"),
  setConfig: (cfg) => ipcRenderer.invoke("set-config", cfg),
  searchHFModel: (query) => ipcRenderer.invoke("search-hf-model", query),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
