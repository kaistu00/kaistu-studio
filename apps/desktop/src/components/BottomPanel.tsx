import { useT } from "../i18n";
import { IconButton } from "./IconButton";
import { TerminalView } from "./TerminalView";
import { LogsView } from "./LogsView";

interface Props {
  tab: "terminal" | "logs" | null;
  height: number;
  onTabChange: (tab: "terminal" | "logs" | null) => void;
  onHeightChange: (h: number) => void;
}

export function BottomPanel({ tab, height, onTabChange, onHeightChange }: Props) {
  const { t } = useT();

  if (!tab) return null;

  return (
    <div className="bottom-panel" style={{ height }}>
      <div
        className="bottom-panel-drag"
        onMouseDown={(e) => {
          e.preventDefault();
          const startH = height;
          const startY = e.clientY;
          const onMove = (ev: MouseEvent) => onHeightChange(Math.max(120, Math.min(600, startH + startY - ev.clientY)));
          const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      />
      <div className="bottom-panel-header">
        <div className="bottom-panel-tabs">
          <IconButton
            icon="terminal"
            label={t("Terminal")}
            className={"bottom-panel-tab" + (tab === "terminal" ? " active" : "")}
            onClick={() => onTabChange("terminal")}
          />
          <IconButton
            icon="description"
            label={t("Logs")}
            className={"bottom-panel-tab" + (tab === "logs" ? " active" : "")}
            onClick={() => onTabChange("logs")}
          />
        </div>
        <IconButton icon="close" iconOnly className="bottom-panel-close" onClick={() => onTabChange(null)} />
      </div>
      <div className="bottom-panel-body">
        {tab === "terminal" ? <TerminalView /> : <LogsView />}
      </div>
    </div>
  );
}
