export interface Crumb { label: string; tab?: string }

export function Breadcrumb({ crumbs, onNavigate }: { crumbs: Crumb[]; onNavigate: (tab: string) => void }) {
  return (
    <div className="breadcrumb">
      {crumbs.map((cr, i) => (
        <span key={i} className="breadcrumb-item">
          {i > 0 && <span className="breadcrumb-sep">›</span>}
          {cr.tab ? (
            <button className="breadcrumb-link" onClick={() => onNavigate(cr.tab!)}>{cr.label}</button>
          ) : (
            <span className="breadcrumb-current">{cr.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}