import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { CivitaiMode } from "../utils/civitai";

const STORAGE_KEY = "kaistu-civitai-mode";

function getInitialMode(): CivitaiMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "nsfw" || saved === "sfw") return saved;
  } catch { /* noop */ }
  return "sfw";
}

interface CivitaiModeCtx {
  mode: CivitaiMode;
  setMode: (m: CivitaiMode) => void;
  toggle: () => void;
}

const Ctx = createContext<CivitaiModeCtx>({ mode: "sfw", setMode: () => {}, toggle: () => {} });

export function CivitaiModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<CivitaiMode>(getInitialMode);

  const setMode = useCallback((m: CivitaiMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* noop */ }
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: CivitaiMode = prev === "sfw" ? "nsfw" : "sfw";
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ mode, setMode, toggle }}>{children}</Ctx.Provider>;
}

export const useCivitaiMode = () => useContext(Ctx);
