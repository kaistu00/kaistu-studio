import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import ES from "./es";
import EN from "./en";

export type Lang = "es" | "en";

const MAPS: Record<Lang, Record<string, string>> = { es: ES, en: EN };

interface LangCtx { lang: Lang; t: (key: string) => string; setLang: (l: Lang) => void; }
const Ctx = createContext<LangCtx>({ lang: "es", t: (k) => k, setLang: () => {} });

export function LangProvider({ children, initialLang = "es" }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("kaistu-lang", l); } catch { /* noop */ }
  }, []);
  const t = useCallback((key: string) => MAPS[lang][key] ?? key, [lang]);
  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
