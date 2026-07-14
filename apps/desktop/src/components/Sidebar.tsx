import { useT } from "../i18n";
import { IconButton } from "./";
import { useCallback } from "react";

export type ViewPath = "home" | "executions" | "upscale" | "text" | "image" | "audio" | "video" | "library" | "terminal" | "logs" | "settings" | `${"settings" | "library"}.${string}`;

interface NavItem { id: ViewPath; label: string; icon: string; }

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "executions", label: "Ejecuciones", icon: "play_arrow" },
  { id: "upscale", label: "Escalado", icon: "magnification_small" },
  { id: "library", label: "Biblioteca", icon: "library_books" },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: "settings", label: "Configuración", icon: "settings" },
];

export function Sidebar({ active, collapsed, onToggle, onNavigate }: {
  active: ViewPath; collapsed: boolean; onToggle: () => void; onNavigate: (p: ViewPath) => void;
}) {
  const { t } = useT();
  
  const isActive = useCallback((id: ViewPath) => {
    if (active === id) return true;
    if (id === "settings" && active?.startsWith("settings")) return true;
    return false;
  }, [active]);

  return (
    <aside className={"sidebar" + (collapsed ? " collapsed" : "")}>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <IconButton
            key={item.id}
            icon={item.icon}
            iconClass="nav-icon"
            labelClass="nav-label"
            label={!collapsed ? t(item.label) : undefined}
            className={"nav-btn" + (isActive(item.id) ? " active" : "")}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? t(item.label) : undefined}
          />
        ))}
      </nav>
      <div className="sidebar-bottom">
        {BOTTOM_ITEMS.map((item) => (
          <IconButton
            key={item.id}
            icon={item.icon}
            iconClass="nav-icon"
            labelClass="nav-label"
            label={!collapsed ? t(item.label) : undefined}
            className={"nav-btn" + (isActive(item.id) ? " active" : "")}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? t(item.label) : undefined}
          />
        ))}
        <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? t("Expandir") : t("Colapsar")}>
          <span className="material-symbols-outlined toggle-icon">{collapsed ? "chevron_right" : "chevron_left"}</span>
        </button>
      </div>
    </aside>
  );
}