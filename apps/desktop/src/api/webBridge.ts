import type { ElectronAPI, SystemStats, SystemCapabilities, DiscoveredPath, ModelInfo, HFModelResult, CivitaiModelResult } from "../electron/preload/index";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const API = `${BACKEND_URL}/api/v1`;

async function getJSON<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(API + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function deleteJSON<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { method: "DELETE", headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const noopCleanup = () => () => {};

export function createWebBridge(): ElectronAPI {
  return {
    getAppVersion: () => getJSON<{ version: string }>("/config").then(r => r.version || "0.1.0").catch(() => "0.1.0 (web)"),

    onMenuAction: () => noopCleanup(),

    backendHealth: () => getJSON<{ status: string; service: string }>("/health"),

    minimizeWindow: () => Promise.resolve(),
    maximizeWindow: () => Promise.resolve(),
    closeWindow: () => Promise.resolve(),
    isMaximized: () => Promise.resolve(false),
    onWindowState: () => noopCleanup(),

    showRootMenu: () => {
      window.dispatchEvent(new CustomEvent("kaistu-show-root-menu"));
      return Promise.resolve();
    },

    getSystemStats: () => getJSON<SystemStats>("/system-stats"),
    getSystemCapabilities: () => getJSON<SystemCapabilities>("/system/capabilities"),

    getModelPaths: () => getJSON<string[]>("/models/paths"),
    setModelPaths: (paths: string[]) => postJSON<void>("/models/paths", paths),
    scanModels: (sources: Array<{ path: string; label: string }>) =>
      postJSON<ModelInfo[]>("/models/scan", sources),
    discoverModelPaths: () => getJSON<DiscoveredPath[]>("/models/discover"),

    revealInFolder: () => Promise.resolve(),

    deleteModel: (path: string) => postJSON<void>("/models/delete", { path }),
    downloadModel: (url: string, filename: string, type: string) =>
      postJSON<{ success: boolean; path: string }>("/models/download", { url, filename, type }),

    searchHFModel: (query: string) =>
      getJSON<HFModelResult | null>("/search/huggingface", { q: query }),
    searchCivitaiModel: (query: string, nsfw?: boolean) =>
      getJSON<CivitaiModelResult | null>("/search/civitai", { q: query, nsfw: String(!!nsfw) }),

    getAPIKeys: () => getJSON<Array<{ service: string }>>("/api-keys"),
    saveAPIKey: (payload: { service: string; api_key: string }) =>
      postJSON<{ service: string }>("/api-keys", payload),
    deleteAPIKey: (service: string) => deleteJSON<void>(`/api-keys/${service}`),

    runInTerminal: () =>
      Promise.resolve({ stdout: "", stderr: "Terminal no disponible en la versión web." }),
    getLogs: () => Promise.resolve(""),
    getTerminalInfo: () =>
      Promise.resolve({ user: "web", host: "web", cwd: "", venv: "" }),
    onLogEntry: () => noopCleanup(),
    getConfig: () => getJSON<Record<string, unknown>>("/config"),
    setConfig: (cfg: Record<string, unknown>) => postJSON<void>("/config", cfg),
  };
}
