/// <reference types="vite/client" />

interface Window {
  electronAPI: import("../electron/preload/index").ElectronAPI;
  __KAISTU_IS_WEB__?: boolean;
}

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
