import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

const mockElectronAPI = {
  getAppVersion: vi.fn().mockResolvedValue("0.1.0"),
  onMenuAction: vi.fn().mockReturnValue(vi.fn()),
  backendHealth: vi.fn().mockResolvedValue({ status: "healthy", service: "test" }),
  generate: vi.fn(),
  listProjects: vi.fn(),
  minimizeWindow: vi.fn().mockResolvedValue(undefined),
  maximizeWindow: vi.fn().mockResolvedValue(undefined),
  closeWindow: vi.fn().mockResolvedValue(undefined),
  isMaximized: vi.fn().mockResolvedValue(false),
  onWindowState: vi.fn().mockReturnValue(vi.fn()),
  showMenu: vi.fn(),
  showRootMenu: vi.fn().mockResolvedValue(undefined),
  getSystemStats: vi.fn().mockResolvedValue({ cpu: 0, memory: { usedGB: 0, totalGB: 16, percent: 0 }, gpus: [] }),
  getModelPaths: vi.fn().mockResolvedValue([]),
  setModelPaths: vi.fn().mockResolvedValue(undefined),
  scanModels: vi.fn().mockResolvedValue([]),
  discoverModelPaths: vi.fn().mockResolvedValue([]),
  getConfig: vi.fn().mockResolvedValue({}),
  setConfig: vi.fn().mockResolvedValue(undefined),
  searchHFModel: vi.fn().mockResolvedValue(null),
};

Object.defineProperty(window, "electronAPI", {
  value: mockElectronAPI,
  writable: true,
  configurable: true,
});
