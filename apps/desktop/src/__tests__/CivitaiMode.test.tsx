import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";
import { CivitaiModeProvider, useCivitaiMode } from "../context/CivitaiMode";

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
});

describe("useCivitaiMode", () => {
  it("defaults to sfw", () => {
    const { result } = renderHook(() => useCivitaiMode(), {
      wrapper: ({ children }) => <CivitaiModeProvider>{children}</CivitaiModeProvider>,
    });
    expect(result.current.mode).toBe("sfw");
  });

  it("setMode changes the mode", () => {
    const { result } = renderHook(() => useCivitaiMode(), {
      wrapper: ({ children }) => <CivitaiModeProvider>{children}</CivitaiModeProvider>,
    });
    act(() => result.current.setMode("nsfw"));
    expect(result.current.mode).toBe("nsfw");
  });

  it("toggle switches between sfw and nsfw", () => {
    const { result } = renderHook(() => useCivitaiMode(), {
      wrapper: ({ children }) => <CivitaiModeProvider>{children}</CivitaiModeProvider>,
    });
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("nsfw");
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("sfw");
  });

  it("persists mode to localStorage", () => {
    const { result } = renderHook(() => useCivitaiMode(), {
      wrapper: ({ children }) => <CivitaiModeProvider>{children}</CivitaiModeProvider>,
    });
    act(() => result.current.setMode("nsfw"));
    expect(localStorage.getItem("kaistu-civitai-mode")).toBe("nsfw");
  });
});

describe("CivitaiModeProvider", () => {
  it("renders children", () => {
    render(
      <CivitaiModeProvider>
        <div data-testid="child">Hello</div>
      </CivitaiModeProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
