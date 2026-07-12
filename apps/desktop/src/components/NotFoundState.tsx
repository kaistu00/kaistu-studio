interface Props {
  message?: string;
  icon?: string;
}

export function NotFoundState({ message, icon = "search_off" }: Props) {
  return (
    <div className="not-found-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 12px", textAlign: "center" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--warning)" }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>
        {message || "No encontrado"}
      </span>
    </div>
  );
}
