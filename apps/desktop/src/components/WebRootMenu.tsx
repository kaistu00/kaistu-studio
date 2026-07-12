import { useEffect, useRef } from "react";
import { useT } from "../i18n";
import { IconButton } from "./";

type MenuAction = "about" | "docs" | string;

interface MenuItem {
  label: string;
  action?: MenuAction;
  separator?: boolean;
}

const WEB_MENUS: Array<{ label: string; items: MenuItem[] }> = [
  {
    label: "Archivo",
    items: [
      { label: "Nuevo proyecto", action: "new-project" },
      { label: "Abrir proyecto...", action: "open-project" },
      { label: "---", separator: true },
      { label: "Guardar", action: "save" },
      { label: "Exportar...", action: "export" },
    ],
  },
  {
    label: "Editar",
    items: [
      { label: "Deshacer", action: "undo" },
      { label: "Rehacer", action: "redo" },
      { label: "---", separator: true },
      { label: "Copiar", action: "copy" },
      { label: "Pegar", action: "paste" },
    ],
  },
  {
    label: "Ver",
    items: [
      { label: "Pantalla completa", action: "fullscreen" },
    ],
  },
  {
    label: "Herramientas",
    items: [
      { label: "Preferencias...", action: "preferences" },
    ],
  },
  {
    label: "Ayuda",
    items: [
      { label: "Acerca de KAISTU Studio", action: "about" },
      { label: "Documentación", action: "docs" },
    ],
  },
];

export function WebRootMenu({ open, onClose, version }: { open: boolean; onClose: () => void; version: string }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const runAction = (action?: MenuAction) => {
    onClose();
    if (action === "about") {
      window.alert(`KAISTU Studio v${version}\nAI-powered content creation studio`);
    } else if (action === "docs") {
      window.open("https://github.com/anomalyco/opencode", "_blank", "noopener");
    }
  };

  return (
    <div className="web-root-menu" ref={ref}>
      <div className="web-root-menu-bar">
        {WEB_MENUS.map((m) => (
          <div key={m.label} className="web-root-menu-col">
            <div className="web-root-menu-title">{t(m.label)}</div>
            {m.items.map((item, i) =>
              item.separator ? (
                <div key={i} className="web-root-menu-sep" />
              ) : (
                <button
                  key={i}
                  className="web-root-menu-item"
                  onClick={() => runAction(item.action)}
                >
                  {t(item.label)}
                </button>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
