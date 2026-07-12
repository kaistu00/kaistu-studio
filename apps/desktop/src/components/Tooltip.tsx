import { useState, useRef, useCallback, type ReactNode } from "react";

interface Props {
  text: string;
  delay?: number;
  children: ReactNode;
}

export function Tooltip({ text, delay = 400, children }: Props) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<number | null>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setPos({ x: e.clientX, y: e.clientY + 16 });
      setVisible(true);
    }, delay);
  }, [delay]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  return (
    <>
      <span onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ display: "inline-flex" }}>
        {children}
      </span>
      {visible && (
        <div
          className="tooltip-floating"
          style={{ left: pos.x, top: pos.y }}
        >
          {text}
        </div>
      )}
    </>
  );
}
