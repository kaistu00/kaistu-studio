import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsLayout } from "../components/SettingsLayout";

vi.mock("../App.css", () => ({}));
vi.mock("../i18n", () => ({
  useT: () => ({ t: (k: string) => k, lang: "es", setLang: vi.fn() }),
  LangProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const tabs = [
  { id: "general", label: "General", icon: "settings" },
  { id: "models", label: "Modelos", icon: "folder" },
];

describe("SettingsLayout", () => {
  it("renders tabs", () => {
    render(
      <SettingsLayout
        tabs={tabs}
        activeTab="general"
        onTabChange={vi.fn()}
        breadcrumbCrumbs={[{ label: "Inicio" }]}
        onBreadcrumbNavigate={vi.fn()}
      >
        <div data-testid="content">Content</div>
      </SettingsLayout>
    );
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Modelos")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("highlights active tab", () => {
    render(
      <SettingsLayout
        tabs={tabs}
        activeTab="models"
        onTabChange={vi.fn()}
        breadcrumbCrumbs={[{ label: "Inicio" }]}
        onBreadcrumbNavigate={vi.fn()}
      >
        <div>Content</div>
      </SettingsLayout>
    );
    const modelTab = screen.getByTitle("Modelos");
    expect(modelTab.classList.contains("active")).toBe(true);
  });

  it("calls onTabChange when tab clicked", async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SettingsLayout
        tabs={tabs}
        activeTab="general"
        onTabChange={onTabChange}
        breadcrumbCrumbs={[{ label: "Inicio" }]}
        onBreadcrumbNavigate={vi.fn()}
      >
        <div>Content</div>
      </SettingsLayout>
    );
    await user.click(screen.getByTitle("Modelos"));
    expect(onTabChange).toHaveBeenCalledWith("models");
  });

  it("renders breadcrumb", () => {
    render(
      <SettingsLayout
        tabs={tabs}
        activeTab="general"
        onTabChange={vi.fn()}
        breadcrumbCrumbs={[{ label: "Inicio" }, { label: "Actual" }]}
        onBreadcrumbNavigate={vi.fn()}
      >
        <div>Content</div>
      </SettingsLayout>
    );
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.getByText("Actual")).toBeInTheDocument();
  });

  it("renders rightPanel when provided", () => {
    render(
      <SettingsLayout
        tabs={tabs}
        activeTab="general"
        onTabChange={vi.fn()}
        breadcrumbCrumbs={[{ label: "Inicio" }]}
        onBreadcrumbNavigate={vi.fn()}
        rightPanel={<div data-testid="right-panel">Side</div>}
      >
        <div>Content</div>
      </SettingsLayout>
    );
    expect(screen.getByTestId("right-panel")).toBeInTheDocument();
  });

  it("hides labels when collapsed", () => {
    render(
      <SettingsLayout
        tabs={tabs}
        activeTab="general"
        onTabChange={vi.fn()}
        collapsed
        breadcrumbCrumbs={[{ label: "Inicio" }]}
        onBreadcrumbNavigate={vi.fn()}
      >
        <div>Content</div>
      </SettingsLayout>
    );
    expect(screen.queryByText("General")).not.toBeInTheDocument();
  });
});
