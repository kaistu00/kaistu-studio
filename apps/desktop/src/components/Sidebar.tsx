import { useT } from "../i18n";

export type ViewPath = "projects" | "text" | "image" | "audio" | "video" | "library" | "terminal" | "logs" | "settings";

interface NavItem { id: ViewPath; label: string; icon: string; }

const NAV_ITEMS: NavItem[] = [
   { id: "projects", label: "Proyectos", icon: "folder" },
   { id: "text", label: "Texto", icon: "text_fields" },
   { id: "image", label: "Imagen", icon: "image" },
   { id: "audio", label: "Audio", icon: "music_note" },
   { id: "video", label: "Video", icon: "movie" },
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
          <button
            key={item.id}
            className={"nav-btn" + (active === item.id ? " active" : "")}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon material-symbols-outlined">{item.icon}</span>
            {!collapsed && <span className="nav-label">{t(item.label)}</span>}
          </button>
        ))}
      </nav>
<div className="sidebar-bottom">
          {BOTTOM_ITEMS.map((item) => (
            <button
              key={item.id}
              className={"nav-btn" + (active === item.id ? " active" : "")}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? t(item.label) : undefined}
            >
              <span className="nav-icon material-symbols-outlined">{item.icon}</span>
              {!collapsed && <span className="nav-label">{t(item.label)}</span>}
            </button>
          ))}
          <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? t("Expandir") : t("Colapsar")}>
            <span className="material-symbols-outlined toggle-icon">{collapsed ? "chevron_right" : "chevron_left"}</span>
          </button>
        </div>
    </aside>
  );
}
