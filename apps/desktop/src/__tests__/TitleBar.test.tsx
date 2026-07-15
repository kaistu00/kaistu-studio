import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TitleBar } from "../components/TitleBar";

vi.mock("../App.css", () => ({}));
vi.mock("../i18n", () => ({
  useT: () => ({ t: (k: string) => k, lang: "es", setLang: vi.fn() }),
  LangProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("TitleBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all buttons", () => {
    render(<TitleBar />);
    expect(screen.getByTitle("Menú")).toBeInTheDocument();
    expect(screen.getByTitle("Minimizar")).toBeInTheDocument();
    expect(screen.getByTitle("Maximizar")).toBeInTheDocument();
    expect(screen.getByTitle("Cerrar")).toBeInTheDocument();
    expect(screen.getByText("KAISTU Studio")).toBeInTheDocument();
  });

  it("calls showRootMenu on hamburger click", async () => {
    const user = userEvent.setup();
    render(<TitleBar />);
    await user.click(screen.getByTitle("Menú"));
    expect(window.electronAPI.showRootMenu).toHaveBeenCalledOnce();
  });

  it("calls minimizeWindow on minimize click", async () => {
    const user = userEvent.setup();
    render(<TitleBar />);
    await user.click(screen.getByTitle("Minimizar"));
    expect(window.electronAPI.minimizeWindow).toHaveBeenCalledOnce();
  });

  it("calls maximizeWindow on maximize click", async () => {
    const user = userEvent.setup();
    render(<TitleBar />);
    await user.click(screen.getByTitle("Maximizar"));
    expect(window.electronAPI.maximizeWindow).toHaveBeenCalledOnce();
  });

  it("calls closeWindow on close click", async () => {
    const user = userEvent.setup();
    render(<TitleBar />);
    await user.click(screen.getByTitle("Cerrar"));
    expect(window.electronAPI.closeWindow).toHaveBeenCalledOnce();
  });
});
