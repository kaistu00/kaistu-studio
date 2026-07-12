import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "../components/Sidebar";

vi.mock("../App.css", () => ({}));

describe("Sidebar", () => {
  const onNavigate = vi.fn();
  const onToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all nav items", () => {
    render(<Sidebar active="projects" collapsed={false} onToggle={onToggle} onNavigate={onNavigate} />);
    expect(screen.getByText("Proyectos")).toBeInTheDocument();
    expect(screen.getByText("Generación")).toBeInTheDocument();
    expect(screen.getByText("Edición")).toBeInTheDocument();
    expect(screen.getByText("Análisis")).toBeInTheDocument();
    expect(screen.getByText("Clonación")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Configuración")).toBeInTheDocument();
  });

  it("highlights active item", () => {
    const { container } = render(<Sidebar active="text" collapsed={false} onToggle={onToggle} onNavigate={onNavigate} />);
    const buttons = container.querySelectorAll(".nav-btn");
    const active = Array.from(buttons).find((b) => b.classList.contains("active"));
    expect(active?.textContent).toContain("Generación");
  });

  it("navigates on item click", async () => {
    const user = userEvent.setup();
    render(<Sidebar active="projects" collapsed={false} onToggle={onToggle} onNavigate={onNavigate} />);
    await user.click(screen.getByText("Análisis"));
    expect(onNavigate).toHaveBeenCalledWith("audio");
  });

  it("calls onToggle when toggle button is clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar active="projects" collapsed={false} onToggle={onToggle} onNavigate={onNavigate} />);
    await user.click(screen.getByTitle("Colapsar"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("hides labels when collapsed", () => {
    render(<Sidebar active="projects" collapsed={true} onToggle={onToggle} onNavigate={onNavigate} />);
    expect(screen.queryByText("Proyectos")).not.toBeInTheDocument();
    expect(screen.getByTitle("Expandir")).toBeInTheDocument();
  });
});
