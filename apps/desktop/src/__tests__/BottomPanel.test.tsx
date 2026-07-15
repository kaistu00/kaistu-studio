import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomPanel } from "../components/BottomPanel";

vi.mock("../App.css", () => ({}));
vi.mock("../i18n", () => ({
  useT: () => ({ t: (k: string) => k, lang: "es", setLang: vi.fn() }),
  LangProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../components/TerminalView", () => ({
  TerminalView: () => <div data-testid="terminal-view">Terminal</div>,
}));

vi.mock("../components/LogsView", () => ({
  LogsView: () => <div data-testid="logs-view">Logs</div>,
}));

describe("BottomPanel", () => {
  it("returns null when tab is null", () => {
    const { container } = render(
      <BottomPanel tab={null} height={200} onTabChange={vi.fn()} onHeightChange={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders terminal tab content", () => {
    render(
      <BottomPanel tab="terminal" height={200} onTabChange={vi.fn()} onHeightChange={vi.fn()} />
    );
    expect(screen.getByTestId("terminal-view")).toBeInTheDocument();
    const terminals = screen.getAllByText("Terminal");
    expect(terminals.length).toBeGreaterThanOrEqual(1);
  });

  it("renders logs tab content", () => {
    render(
      <BottomPanel tab="logs" height={200} onTabChange={vi.fn()} onHeightChange={vi.fn()} />
    );
    expect(screen.getByTestId("logs-view")).toBeInTheDocument();
    const logs = screen.getAllByText("Logs");
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("highlights active tab", () => {
    render(
      <BottomPanel tab="logs" height={200} onTabChange={vi.fn()} onHeightChange={vi.fn()} />
    );
    const logBtns = screen.getAllByText("Logs");
    const btn = logBtns[0]!.closest("button");
    expect(btn?.classList.contains("active")).toBe(true);
  });

  it("calls onTabChange when closing", async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BottomPanel tab="terminal" height={200} onTabChange={onTabChange} onHeightChange={vi.fn()} />
    );
    const closeBtn = screen.getByText("close").closest("button");
    expect(closeBtn).toBeTruthy();
    await user.click(closeBtn!);
    expect(onTabChange).toHaveBeenCalledWith(null);
  });
});
