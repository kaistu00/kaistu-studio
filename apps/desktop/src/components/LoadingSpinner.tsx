import { useT } from "../i18n";

interface Props {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const SIZE_MAP = { sm: 16, md: 20, lg: 32 };

export function LoadingSpinner({ size = "md", label }: Props) {
  const { t } = useT();
  const px = SIZE_MAP[size];
  return (
    <div className="loading-spinner" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", padding: "20px 0" }}>
      <span
        className="material-symbols-outlined loading-spinner-icon"
        style={{ fontSize: px, animation: "spin 1s linear infinite" }}
      >progress_activity</span>
      <span className="loading-spinner-label" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        {label || t("Cargando...")}
      </span>
    </div>
  );
}
