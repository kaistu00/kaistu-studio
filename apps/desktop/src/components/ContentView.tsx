export function ContentView({ kind }: { kind: string }) {
  const icon = { text: "text_fields", image: "image", audio: "music_note", video: "movie" }[kind] ?? "auto_awesome";
  return (
    <div className="view">
      <h1>{kind.charAt(0).toUpperCase() + kind.slice(1)}</h1>
      <p className="view-sub">Generación y edición de {kind} con IA.</p>
      <div className="media-cards">
        <div className="media-card">
          <span className="media-icon material-symbols-outlined">{icon}</span>
          <span className="media-label">Generar</span>
        </div>
        <div className="media-card">
          <span className="media-icon material-symbols-outlined">{icon}</span>
          <span className="media-label">Editar</span>
        </div>
      </div>
    </div>
  );
}
