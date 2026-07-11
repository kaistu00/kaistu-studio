import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

const mockElectronAPI = {
  getAppVersion: vi.fn().mockResolvedValue("0.1.0"),
  onMenuAction: vi.fn().mockReturnValue(vi.fn()),
  backendHealth: vi.fn().mockResolvedValue({ status: "healthy", service: "test" }),
  minimizeWindow: vi.fn().mockResolvedValue(undefined),
  maximizeWindow: vi.fn().mockResolvedValue(undefined),
  closeWindow: vi.fn().mockResolvedValue(undefined),
  isMaximized: vi.fn().mockResolvedValue(false),
  onWindowState: vi.fn().mockReturnValue(vi.fn()),
  showRootMenu: vi.fn().mockResolvedValue(undefined),
  getSystemStats: vi.fn().mockResolvedValue({ cpu: 0, memory: { usedGB: 0, totalGB: 16, percent: 0 }, gpus: [] }),
  getModelPaths: vi.fn().mockResolvedValue([]),
  setModelPaths: vi.fn().mockResolvedValue(undefined),
  scanModels: vi.fn().mockResolvedValue([]),
  discoverModelPaths: vi.fn().mockResolvedValue([]),
  searchHFModel: vi.fn().mockResolvedValue(null),
  searchCivitaiModel: vi.fn().mockResolvedValue(null),
  revealInFolder: vi.fn().mockResolvedValue(undefined),
  deleteModel: vi.fn().mockResolvedValue(undefined),
  getAPIKeys: vi.fn().mockResolvedValue([]),
  saveAPIKey: vi.fn().mockResolvedValue({ service: "test" }),
  deleteAPIKey: vi.fn().mockResolvedValue(undefined),
  runInTerminal: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
  getLogs: vi.fn().mockResolvedValue(""),
  getTerminalInfo: vi.fn().mockResolvedValue({ user: "test", host: "pc", cwd: "C:\\", venv: "" }),
  onLogEntry: vi.fn().mockReturnValue(vi.fn()),
};

Object.defineProperty(window, "electronAPI", {
  value: mockElectronAPI,
  writable: true,
  configurable: true,
});
