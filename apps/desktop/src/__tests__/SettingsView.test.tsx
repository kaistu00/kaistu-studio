import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsView } from "../components/SettingsView";

const electronAPI = {
  getAppVersion: () => Promise.resolve("0.1.0"),
  onMenuAction: () => () => {},
  backendHealth: () => Promise.resolve({ status: "healthy" }),
  generate: () => Promise.resolve({}),
  listProjects: () => Promise.resolve([]),
  minimizeWindow: () => Promise.resolve(),
  maximizeWindow: () => Promise.resolve(),
  closeWindow: () => Promise.resolve(),
  isMaximized: () => Promise.resolve(false),
  onWindowState: () => () => {},
  showMenu: () => Promise.resolve(),
  showRootMenu: () => Promise.resolve(),
  getSystemStats: () => Promise.resolve({ cpu: 0, memory: { usedGB: 0, totalGB: 0, percent: 0 }, gpus: [] }),
  getModelPaths: () => Promise.resolve([]),
  setModelPaths: () => Promise.resolve(),
  scanModels: () => Promise.resolve([]),
  discoverModelPaths: () => Promise.resolve([]),
  getConfig: () => Promise.resolve({}),
  setConfig: () => Promise.resolve(),
  searchHFModel: () => Promise.resolve(null),
  getAPIKeys: () => Promise.resolve([]),
  saveAPIKey: () => Promise.resolve({}),
  deleteAPIKey: () => Promise.resolve(),
};

vi.mock("../i18n", () => ({
  useT: () => ({ t: (k: string) => k, lang: "es", setLang: vi.fn() }),
  LangProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../preload", () => ({
  contextBridge: { exposeInMainWorld: () => {} },
}));

function clickTab(label: string) {
  const btn = screen.getByTitle(label);
  fireEvent.click(btn);
}

describe("SettingsView", () => {
  beforeEach(() => {
    Object.defineProperty(window, "electronAPI", { value: electronAPI, writable: true, configurable: true });
  });
  it("renders without crashing", () => {
    const { container } = render(<SettingsView version="0.1.0" sidebarCollapsed={false} />);
    expect(container).toBeTruthy();
  });

  it("renders sidebar tabs", () => {
    render(<SettingsView version="0.1.0" sidebarCollapsed={false} />);
    expect(screen.getAllByText("General").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Modelos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Apariencia").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Acerca de").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Models tab (default)", () => {
    render(<SettingsView version="0.1.0" sidebarCollapsed={false} />);
    expect(screen.getByText("Rutas personalizadas")).toBeTruthy();
  });

  it("renders General tab", () => {
    render(<SettingsView version="0.1.0" sidebarCollapsed={false} />);
    clickTab("General");
    expect(screen.getByText("Idioma")).toBeTruthy();
  });

  it("renders Appearance tab", () => {
    render(<SettingsView version="0.1.0" sidebarCollapsed={false} />);
    clickTab("Apariencia");
    expect(screen.getByText("Color de acento")).toBeTruthy();
  });

  it("renders About tab", () => {
    render(<SettingsView version="0.1.0" sidebarCollapsed={false} />);
    clickTab("Acerca de");
    expect(screen.getByText("KAISTU Studio v0.1.0")).toBeTruthy();
  });

  it("renders Tools tab (API Keys renamed)", () => {
    render(<SettingsView version="0.1.0" sidebarCollapsed={false} />);
    clickTab("Tools");
    expect(screen.getByRole("heading", { name: "Tools" })).toBeTruthy();
  });
});
