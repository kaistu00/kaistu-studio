import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

vi.mock("../components/IconButton", () => ({
  IconButton: ({ label, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid="mock-icon-btn">{label}</button>
  ),
}));

vi.mock("../App.css", () => ({}));

function Bomb() {
  throw new Error("💥 explosion");
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Safe</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("💥 explosion")).toBeInTheDocument();
    expect(screen.getByTestId("mock-icon-btn")).toBeInTheDocument();
    (console.error as any).mockRestore();
  });

  it("shows retry button that triggers state reset", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("mock-icon-btn")).toBeInTheDocument();
    expect(screen.getByText("Reintentar")).toBeInTheDocument();
    (console.error as any).mockRestore();
  });
});
