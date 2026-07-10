import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsView } from "../components/SettingsView";

vi.mock("../i18n", () => ({
  useT: () => ({ t: (k: string) => k, lang: "es", setLang: vi.fn() }),
  LangProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function clickTab(label: string) {
  const btn = screen.getByTitle(label);
  fireEvent.click(btn);
}

describe("SettingsView", () => {
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
});
