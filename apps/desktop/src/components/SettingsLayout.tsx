import type { ReactNode } from "react";
import { useT } from "../i18n";
import { Breadcrumb } from "./Breadcrumb";
import type { Crumb } from "./Breadcrumb";

interface SettingsLayoutTab {
  id: string;
  label: string;
  icon: string;
}

interface SettingsLayoutProps {
  tabs: SettingsLayoutTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  collapsed?: boolean;
  breadcrumbCrumbs: Crumb[];
  onBreadcrumbNavigate: (tab: string) => void;
  children: ReactNode;
  rightPanel?: ReactNode;
}

export function SettingsLayout({
  tabs, activeTab, onTabChange, collapsed, breadcrumbCrumbs, onBreadcrumbNavigate, children, rightPanel
}: SettingsLayoutProps) {
  const { t } = useT();
  return (
    <div className="settings-view">
      <nav className={"settings-sidebar" + (collapsed ? " collapsed" : "")}>
        {tabs.map((tt) => (
          <button
            key={tt.id}
            className={"settings-tab" + (activeTab === tt.id ? " active" : "")}
            onClick={() => onTabChange(tt.id)}
            title={t(tt.label)}
          >
            <span className="material-symbols-outlined settings-tab-icon">{tt.icon}</span>
            {!collapsed && <span className="settings-tab-label">{t(tt.label)}</span>}
          </button>
        ))}
      </nav>
      <div className="settings-content">
        <Breadcrumb crumbs={breadcrumbCrumbs} onNavigate={onBreadcrumbNavigate} />
        {children}
      </div>
      {rightPanel}
    </div>
  );
}
