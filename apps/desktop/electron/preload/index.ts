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
   minimizeWindow: () => Promise<void>;
   maximizeWindow: () => Promise<void>;
   closeWindow: () => Promise<void>;
   isMaximized: () => Promise<boolean>;
   onWindowState: (callback: (state: "maximized" | "normal") => void) => () => void;
   showRootMenu: () => Promise<void>;
   getSystemStats: () => Promise<SystemStats>;
   getModelPaths: () => Promise<string[]>;
   setModelPaths: (paths: string[]) => Promise<void>;
   scanModels: (sources: Array<{ path: string; label: string }>) => Promise<ModelInfo[]>;
   discoverModelPaths: () => Promise<DiscoveredPath[]>;
   revealInFolder: (path: string) => Promise<void>;
   deleteModel: (path: string) => Promise<void>;
   searchHFModel: (query: string) => Promise<HFModelResult | null>;
   searchCivitaiModel: (query: string) => Promise<CivitaiModelResult | null>;
   getAPIKeys: () => Promise<Array<{ service: string }>>;
   saveAPIKey: (payload: { service: string; api_key: string }) => Promise<{ service: string }>;
   deleteAPIKey: (service: string) => Promise<void>;
   runInTerminal: (cmd: string) => Promise<{ stdout: string; stderr: string }>;
   getLogs: () => Promise<string>;
   getTerminalInfo: () => Promise<{ user: string; host: string; cwd: string; venv: string }>;
   onLogEntry: (callback: (entry: string) => void) => () => void;
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
   getModelPaths: () => ipcRenderer.invoke("get-model-paths"),
   setModelPaths: (paths) => ipcRenderer.invoke("set-model-paths", paths),
   scanModels: (sources) => ipcRenderer.invoke("scan-models", sources),
   discoverModelPaths: () => ipcRenderer.invoke("discover-model-paths"),
   revealInFolder: (path) => ipcRenderer.invoke("reveal-in-folder", path),
   deleteModel: (path) => ipcRenderer.invoke("delete-model", path),
   searchHFModel: (query) => ipcRenderer.invoke("search-hf-model", query),
   searchCivitaiModel: (query) => ipcRenderer.invoke("search-civitai-model", query),
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
  };

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
