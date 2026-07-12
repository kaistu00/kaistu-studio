import { useEffect, useState, useRef } from "react";
import { useT } from "../i18n";
import { copyToClipboard } from "../utils/clipboard";
import { IconButton } from "./IconButton";

export function LogsView() {
  const { t } = useT();
  const [logLines, setLogLines] = useState<string[]>([]);
  const logsRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    window.electronAPI?.getLogs().then((content) => {
      if (content) setLogLines(content.split("\n").filter(Boolean));
    });
    const unsub = window.electronAPI?.onLogEntry((entry) => {
      setLogLines((prev) => [...prev, entry].slice(-1000));
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logLines]);

  return (
    <div className="logs-view">
      <div className="logs-actions">
        <IconButton icon="content_copy" iconOnly className="icon-btn" onClick={() => copyToClipboard(logLines.join("\n"))} title={t("Copiar logs")} />
      </div>
      <div className="logs-output" ref={logsRef}>
        {logLines.length === 0 ? (
          <span className="logs-empty">{t("(esperando logs...)")}</span>
        ) : (
          logLines.map((line, i) => {
            const spaceIdx = line.indexOf(" ");
            const ts = spaceIdx > 0 ? line.slice(0, spaceIdx) : "";
            const msg = spaceIdx > 0 ? line.slice(spaceIdx + 1) : line;
            return (
              <div key={i} className="log-line">
                {ts && <span className="log-ts">{ts}</span>}
                <span className="log-msg">{msg}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
