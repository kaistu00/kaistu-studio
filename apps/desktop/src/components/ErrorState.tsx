import { IconButton } from "./IconButton";

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="error-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0", textAlign: "center" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 32, color: "var(--error)" }}>error</span>
      <span style={{ fontSize: 13, color: "var(--error)" }}>{message}</span>
      {onRetry && (
        <IconButton icon="refresh" label="Reintentar" className="settings-btn" onClick={onRetry} />
      )}
    </div>
  );
}
