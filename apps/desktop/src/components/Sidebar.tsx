import { useT } from "../i18n";
import { IconButton } from "./";

export type ViewPath = "projects" | "text" | "image" | "audio" | "video" | "library" | "terminal" | "logs" | "settings" | "bytheface";

interface NavItem { id: ViewPath; label: string; icon: string; }

const NAV_ITEMS: NavItem[] = [
  { id: "projects", label: "Proyectos", icon: "folder" },
  { id: "bytheface", label: "By The Face", icon: "🤗" },
  { id: "library", label: "Biblioteca", icon: "library_books" },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: "settings", label: "Configuración", icon: "settings" },
];

export function Sidebar({ active, collapsed, onToggle, onNavigate }: {
  active: ViewPath; collapsed: boolean; onToggle: () => void; onNavigate: (p: ViewPath) => void;
}) {
  const { t } = useT();

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
            className={"nav-btn" + (active === item.id ? " active" : "")}
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
            className={"nav-btn" + (active === item.id ? " active" : "")}
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