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
  getSystemCapabilities: vi.fn().mockResolvedValue({
    gpu_type: "nvidia", gpus: [{ index: 0, name: "RTX 5080", vram_total_mb: 16303, vram_free_mb: 12000 }],
    ram_gb: 16, cpu_count: 8,
    platform: "Windows", python_version: "3.14",
    pytorch_backend: "cpu", capability_level: 3, capability_name: "Standard",
    features: ["text-generation", "text-to-image", "image-to-image", "lora-support", "controlnet", "inpainting"],
    all_features: [
      { name: "text-generation", available: true, required_level: "none", reason: null },
      { name: "text-to-image", available: true, required_level: "minimal", reason: null },
      { name: "training", available: false, required_level: "ultra", reason: "24+ GB VRAM and powerful GPU required" },
      { name: "real-time", available: false, required_level: "ultra", reason: "24+ GB VRAM and powerful GPU required" },
    ],
    venv: { python: "3.14.6", executable: "python.exe", prefix: "C:\\venv", is_venv: true, package_count: 12, packages: [{ name: "fastapi", version: "0.115.0" }] },
  }),
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
