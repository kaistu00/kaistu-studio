export function formatFileSize(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1000)} KB`;
  if (mb < 1000) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export function formatParams(n: number | null): string {
  if (!n) return "";
  const b = n / 1_000_000_000;
  if (b >= 1) return b.toFixed(1) + "B";
  const m = n / 1_000_000;
  if (m >= 1) return m.toFixed(0) + "M";
  return String(n);
}

export function formatGB(mb: number): string {
  if (mb <= 0) return "?";
  return (mb / 1024).toFixed(mb >= 1024 ? 1 : 0);
}

export function cpuStatLevel(pct: number): "green" | "yellow" | "red" {
  if (pct < 35) return "green";
  if (pct < 70) return "yellow";
  return "red";
}

export function buildOutputPath(dir: string, inputName: string, scale: number, fmt: string): string {
  const ext = fmt === "jpg" ? "jpg" : fmt === "png" ? "png" : fmt === "webp" ? "webp" : fmt === "mp4" ? "mp4" : "png";
  const stem = inputName.replace(/\.[^.]+$/, "");
  return dir.replace(/\\/g, "/") + "/" + stem + "_x" + scale + "." + ext;
}
