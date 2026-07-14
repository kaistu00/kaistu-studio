import { useRef, useState, useCallback } from "react";

function toLocalFileUrl(winPath: string): string {
  const normalized = winPath.replace(/\\/g, "/");
  return "local-file:///" + encodeURI(normalized);
}

interface Props {
  beforePath: string;
  afterPath: string;
  isVideo?: boolean;
}

export function CompareSlider({ beforePath, afterPath, isVideo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const beforeSrc = toLocalFileUrl(beforePath);
  const afterSrc = toLocalFileUrl(afterPath);

  const updatePos = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPos((x / rect.width) * 100);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    updatePos(e.clientX);

    const onMove = (ev: globalThis.MouseEvent) => updatePos(ev.clientX);
    const onUp = () => { dragging.current = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) updatePos(e.touches[0]!.clientX);
  };

  const imgProps = {
    draggable: false as const,
    style: { display: "block" as const, width: "100%" as const, height: "100%" as const, objectFit: "contain" as const, objectPosition: "left center" as const, pointerEvents: "none" as const, userSelect: "none" as const },
  };

  return (
    <div className="compare-slider-container">
      <span className="compare-label compare-label-left">Original</span>
      <span className="compare-label compare-label-right">Escalado</span>
      <div ref={containerRef} className="compare-slider" onTouchMove={onTouchMove}>
        <div className="compare-before">
          {isVideo ? (
            <video src={beforeSrc} muted loop autoPlay playsInline {...imgProps} />
          ) : (
            <img src={beforeSrc} alt="original" {...imgProps} />
          )}
        </div>
        <div className="compare-after" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {isVideo ? (
            <video src={afterSrc} muted loop autoPlay playsInline {...imgProps} />
          ) : (
            <img src={afterSrc} alt="escalado" {...imgProps} />
          )}
        </div>
        <div className="compare-handle" style={{ left: `${pos}%` }} onMouseDown={onMouseDown}>
          <div className="compare-handle-line" />
          <div className="compare-handle-knob">
            <span>◀▶</span>
          </div>
          <div className="compare-handle-line" />
        </div>
      </div>
    </div>
  );
}
