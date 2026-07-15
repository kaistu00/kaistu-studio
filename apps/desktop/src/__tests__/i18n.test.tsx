import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";
import { LangProvider, useT } from "../i18n";

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
});

describe("useT", () => {
  it("returns Spanish translations by default", () => {
    const { result } = renderHook(() => useT(), {
      wrapper: ({ children }) => <LangProvider>{children}</LangProvider>,
    });
    expect(result.current.lang).toBe("es");
    expect(result.current.t("Inicio")).toBe("Inicio");
  });

  it("returns English translations when lang is en", () => {
    const { result } = renderHook(() => useT(), {
      wrapper: ({ children }) => <LangProvider initialLang="en">{children}</LangProvider>,
    });
    expect(result.current.lang).toBe("en");
    expect(result.current.t("Inicio")).toBe("Home");
  });

  it("falls back to key when translation is missing", () => {
    const { result } = renderHook(() => useT(), {
      wrapper: ({ children }) => <LangProvider>{children}</LangProvider>,
    });
    expect(result.current.t("NonExistentKey__test")).toBe("NonExistentKey__test");
  });

  it("switches language with setLang", () => {
    const { result } = renderHook(() => useT(), {
      wrapper: ({ children }) => <LangProvider>{children}</LangProvider>,
    });
    expect(result.current.t("Inicio")).toBe("Inicio");
    act(() => result.current.setLang("en"));
    expect(result.current.lang).toBe("en");
    expect(result.current.t("Inicio")).toBe("Home");
  });

  it("persists language to localStorage", () => {
    const { result } = renderHook(() => useT(), {
      wrapper: ({ children }) => <LangProvider>{children}</LangProvider>,
    });
    act(() => result.current.setLang("en"));
    expect(localStorage.getItem("kaistu-lang")).toBe("en");
  });
});

describe("LangProvider", () => {
  it("renders children", () => {
    render(
      <LangProvider>
        <div data-testid="child">Hello</div>
      </LangProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
