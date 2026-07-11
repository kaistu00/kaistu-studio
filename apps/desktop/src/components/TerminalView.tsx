import { useEffect, useState, useRef } from "react";
import { useT } from "../i18n";

export function TerminalView() {
  const { t } = useT();
  const [output, setOutput] = useState("");
  const [cmd, setCmd] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [termInfo, setTermInfo] = useState<{ user: string; host: string; cwd: string; venv: string } | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    window.electronAPI?.getTerminalInfo().then(setTermInfo);
  }, []);

  const promptParts = termInfo ? {
    venv: termInfo.venv ? `(${termInfo.venv.split("\\").pop()}) ` : null,
    userHost: `${termInfo.user}@${termInfo.host}`,
    cwd: `:${termInfo.cwd}`,
  } : null;

  const promptStr = promptParts
    ? (promptParts.venv || "") + promptParts.userHost + promptParts.cwd + "$"
    : "$";

  const runCommand = async () => {
    if (!cmd.trim()) return;
    setIsRunning(true);
    setOutput((prev) => prev + promptStr + " " + cmd + "\n");
    try {
      const result = await window.electronAPI?.runInTerminal(cmd);
      setOutput((prev) => {
        let newOutput = prev;
        if (result?.stdout) newOutput += result.stdout;
        if (result?.stderr) newOutput += "\n" + t("Error") + ": " + result.stderr;
        newOutput += "\n";
        return newOutput;
      });
    } catch (e) {
      setOutput((prev) => prev + t("Error") + ": " + String(e) + "\n");
    } finally {
      setIsRunning(false);
      setCmd("");
    }
  };

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  return (
    <div className="terminal-view">
      <div className="terminal-output">
        <pre ref={outputRef}>{output || t("(vacío)")}</pre>
      </div>
      <div className="terminal-input-row">
        <span className="terminal-prompt">
          {promptParts?.venv && <span className="venv-tag">{promptParts.venv}</span>}
          <span className="user-host">{promptParts?.userHost || ""}</span>
          <span className="path-part">{promptParts?.cwd || ""}</span>
          <span>$</span>
        </span>
        <input
          className="terminal-input"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !isRunning) runCommand(); }}
          placeholder={t("Escribe un comando...")}
          disabled={isRunning}
          autoFocus={!isRunning}
        />
      </div>
    </div>
  );
}
