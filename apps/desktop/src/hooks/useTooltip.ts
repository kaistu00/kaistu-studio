import { useRef, useCallback } from "react";

interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

export function useTooltip(delay = 400) {
  const timeoutRef = useRef<number | null>(null);
  const stateRef = useRef<TooltipState>({ visible: false, text: "", x: 0, y: 0 });

  const show = useCallback((text: string, e: React.MouseEvent | MouseEvent) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      stateRef.current = { visible: true, text, x: e.clientX, y: e.clientY };
      forceUpdate();
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    stateRef.current.visible = false;
    forceUpdate();
  }, []);

  return { show, hide };
}

function forceUpdate() {
  // Trigger re-render by dispatching a custom event
  window.dispatchEvent(new CustomEvent("tooltip-update"));
}
