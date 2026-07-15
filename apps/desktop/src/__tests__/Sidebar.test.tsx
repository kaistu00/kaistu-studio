import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "../components/Sidebar";

vi.mock("../App.css", () => ({}));
vi.mock("../i18n", () => ({
  useT: () => ({ t: (k: string) => k, lang: "es", setLang: vi.fn() }),
  LangProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Sidebar", () => {
  const onNavigate = vi.fn();
  const onToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all nav items", () => {
    render(<Sidebar active="home" collapsed={false} onToggle={onToggle} onNavigate={onNavigate} />);
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.getByText("Ejecuciones")).toBeInTheDocument();
    expect(screen.getByText("Escalado")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Configuración")).toBeInTheDocument();
  });

  it("highlights active item", () => {
    const { container } = render(<Sidebar active="upscale" collapsed={false} onToggle={onToggle} onNavigate={onNavigate} />);
    const buttons = container.querySelectorAll(".nav-btn");
    const active = Array.from(buttons).find((b) => b.classList.contains("active"));
    expect(active?.textContent).toContain("Escalado");
  });

  it("navigates on item click", async () => {
    const user = userEvent.setup();
    render(<Sidebar active="home" collapsed={false} onToggle={onToggle} onNavigate={onNavigate} />);
    await user.click(screen.getByText("Biblioteca"));
    expect(onNavigate).toHaveBeenCalledWith("library");
  });

  it("calls onToggle when toggle button is clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar active="home" collapsed={false} onToggle={onToggle} onNavigate={onNavigate} />);
    await user.click(screen.getByTitle("Colapsar"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("hides labels when collapsed", () => {
    render(<Sidebar active="home" collapsed={true} onToggle={onToggle} onNavigate={onNavigate} />);
    expect(screen.queryByText("Inicio")).not.toBeInTheDocument();
    expect(screen.getByTitle("Expandir")).toBeInTheDocument();
  });
});
