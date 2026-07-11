import { app, BrowserWindow, Menu, MenuItemConstructorOptions, shell, ipcMain } from "electron";
import { join } from "path";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from "fs";
import { spawn } from "child_process";
import { is } from "@electron-toolkit/utils";
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";
import { any } from "zod/v4";

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;
let isMaximized = false;

// HF Debug storage
let lastHfRequests: string[] = [];
let lastHfResponses: string[] = [];

// Log storage
let logBuffer: string[] = [];

function logToBuffer(...args: any[]) {
  const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
  logBuffer.push(new Date().toISOString() + " " + msg);
  if (logBuffer.length > 1000) logBuffer = logBuffer.slice(-500);
}

function sendLogEntry(msg: string) {
  try { mainWindow?.webContents.send("log-entry", msg); } catch {}
}
(["log", "info", "warn", "error"] as const).forEach((method) => {
  const orig = (console as any)[method];
  (console as any)[method] = (...args: any[]) => {
    orig(...args);
    logToBuffer(...args);
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    sendLogEntry(new Date().toISOString() + " " + msg);
  };
});

const BACKEND_URL = "http://127.0.0.1:8000";

async function fetchBackend(path: string, options?: RequestInit) {
  const url = `${BACKEND_URL}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

type MenuDef = { label: string; submenu: { label: string; accelerator?: string; action: string }[] };

const MENUS: Record<string, MenuDef> = {
  archivo: {
    label: "Archivo",
    submenu: [
      { label: "Nuevo proyecto", accelerator: "CmdOrCtrl+N", action: "new-project" },
      { label: "Abrir proyecto...", accelerator: "CmdOrCtrl+O", action: "open-project" },
      { label: "---", action: "" },
      { label: "Guardar", accelerator: "CmdOrCtrl+S", action: "save" },
      { label: "Guardar como...", accelerator: "CmdOrCtrl+Shift+S", action: "save-as" },
      { label: "---", action: "" },
      { label: "Exportar...", accelerator: "CmdOrCtrl+E", action: "export" },
      { label: "---", action: "" },
      { label: "Salir", accelerator: "CmdOrCtrl+Q", action: "quit" },
    ],
  },
  editar: {
    label: "Editar",
    submenu: [
      { label: "Deshacer", accelerator: "CmdOrCtrl+Z", action: "undo" },
      { label: "Rehacer", accelerator: "CmdOrCtrl+Shift+Z", action: "redo" },
      { label: "---", action: "" },
      { label: "Cortar", accelerator: "CmdOrCtrl+X", action: "cut" },
      { label: "Copiar", accelerator: "CmdOrCtrl+C", action: "copy" },
      { label: "Pegar", accelerator: "CmdOrCtrl+V", action: "paste" },
      { label: "Seleccionar todo", accelerator: "CmdOrCtrl+A", action: "select-all" },
    ],
  },
  ver: {
    label: "Ver",
    submenu: [
      { label: "Recargar", accelerator: "CmdOrCtrl+R", action: "reload" },
      { label: "---", action: "" },
      { label: "Pantalla completa", accelerator: "F11", action: "fullscreen" },
      { label: "Alternar DevTools", accelerator: "CmdOrCtrl+Shift+I", action: "toggle-devtools" },
    ],
  },
  herramientas: {
    label: "Herramientas",
    submenu: [
      { label: "Preferencias...", accelerator: "CmdOrCtrl+,", action: "preferences" },
    ],
  },
  ayuda: {
    label: "Ayuda",
    submenu: [
      { label: "Acerca de KAISTU Studio", action: "about" },
      { label: "Documentación", action: "docs" },
    ],
  },
};

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false,
    title: "KAISTU Studio",
    icon: join(__dirname, "../../assets/icon.png"),
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  mainWindow.on("maximize", () => {
    isMaximized = true;
    mainWindow?.webContents.send("window-state", "maximized");
  });
  mainWindow.on("unmaximize", () => {
    isMaximized = false;
    mainWindow?.webContents.send("window-state", "normal");
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── IPC Handlers ──────────────────────────────────────────

ipcMain.handle("get-app-version", () => app.getVersion());

ipcMain.handle("backend-health", async () => {
  try {
    return await fetchBackend("/health");
  } catch {
    return { status: "unreachable", service: "kaistu-studio-backend" };
  }
});

ipcMain.handle("generate", async (_event, input: { prompt: string; mediaType: string }) => {
  return fetchBackend("/generate", { method: "POST", body: JSON.stringify(input) });
});

ipcMain.handle("list-projects", async () => fetchBackend("/projects"));

// ── Window Controls ───────────────────────────────────────

ipcMain.handle("minimize-window", () => mainWindow?.minimize());
ipcMain.handle("maximize-window", () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
});
ipcMain.handle("close-window", () => mainWindow?.close());
ipcMain.handle("is-maximized", () => isMaximized);

// ── System Stats ──────────────────────────────────────────

let lastCpuTimes: { idle: number; total: number } | null = null;

function getCpuUsage(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }
  const current = { idle, total };
  if (!lastCpuTimes) { lastCpuTimes = current; return 0; }
  const idleDelta = current.idle - lastCpuTimes.idle;
  const totalDelta = current.total - lastCpuTimes.total;
  lastCpuTimes = current;
  if (totalDelta === 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 100);
}

function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    usedGB: Math.round(used / (1024 * 1024 * 1024) * 100) / 100,
    totalGB: Math.round(total / (1024 * 1024 * 1024) * 100) / 100,
    percent: Math.round((used / total) * 100),
  };
}

function getGpuInfo(): Promise<Array<{ name: string; utilization: number; memoryUsedMB: number; memoryTotalMB: number }>> {
  return (async () => {
    const gpus: Array<{ name: string; utilization: number; memoryUsedMB: number; memoryTotalMB: number }> = [];

    // Step 1: nvidia-smi — detailed stats for NVIDIA GPUs
    try {
      const { stdout } = await execAsync(
        'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,name --format=csv,noheader,nounits',
        { timeout: 2000 }
      );
      for (const line of stdout.trim().split("\n").filter(Boolean)) {
        const parts = line.split(", ");
        gpus.push({
          name: parts[3]?.trim() ?? "Unknown",
          utilization: parseFloat(parts[0] ?? "0"),
          memoryUsedMB: parseFloat(parts[1] ?? "0"),
          memoryTotalMB: parseFloat(parts[2] ?? "0"),
        });
      }
    } catch { /* nvidia-smi not available */ }

    // Step 2: WMI — always get ALL GPU names + total VRAM (works for every vendor)
    try {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Sort-Object PNPDeviceID | Select-Object Name, AdapterRAM | ConvertTo-Json -Compress"',
        { timeout: 3000 }
      );
      const trimmed = stdout.trim();
      if (trimmed) {
        const raw = JSON.parse(trimmed);
        const wmiGpus = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        const knownNames = new Set(gpus.map(g => g.name.toLowerCase()));
        for (const wmi of wmiGpus) {
          const name = wmi?.Name;
          if (!name || knownNames.has(name.toLowerCase())) continue;
          gpus.push({
            name,
            utilization: -1,
            memoryUsedMB: 0,
            memoryTotalMB: Math.round((wmi.AdapterRAM ?? 0) / (1024 * 1024)),
          });
        }
      }
    } catch { /* WMI not available */ }

    // Step 3: Windows Performance Counters — utilization + VRAM usage for all GPUs
    try {
      const script = [
        '$samples = Get-Counter "\\GPU Engine(*)\\Utilization Percentage" -MaxSamples 1 -ErrorAction SilentlyContinue',
        '$memSamples = Get-Counter "\\GPU Adapter Memory(*)\\Dedicated Usage" -MaxSamples 1 -ErrorAction SilentlyContinue',
        '$utilMap = @{}; $memMap = @{}',
        'if ($samples) { foreach ($s in $samples.CounterSamples) { $a = ($s.Path -split "[(),]")[1]; if ($a) { if (-not $utilMap.ContainsKey($a)) { $utilMap[$a] = @() }; $utilMap[$a] += $s.CookedValue } } }',
        'if ($memSamples) { foreach ($s in $memSamples.CounterSamples) { $a = ($s.Path -split "[(),]")[1]; if ($a) { $memMap[$a] = [math]::Round($s.CookedValue / 1MB, 0) } } }',
        '$avgUtil = @{}',
        'foreach ($k in $utilMap.Keys) { $avgUtil[$k] = [math]::Round(($utilMap[$k] | Measure-Object -Average).Average, 1) }',
        '$i = 0',
        'foreach ($gpu in (Get-CimInstance Win32_VideoController | Sort-Object PNPDeviceID)) {',
        '  $key = "adapter$i"',
        '  $u = if ($avgUtil.ContainsKey($key)) { $avgUtil[$key] } else { "-" }',
        '  $m = if ($memMap.ContainsKey($key)) { $memMap[$key] } else { "-" }',
        '  "$($gpu.Name)|$u|$m"',
        '  $i++',
        '}',
      ].join("; ");
      const encoded = Buffer.from(script, "utf16le").toString("base64");
      const { stdout } = await execAsync(
        `powershell -NoProfile -EncodedCommand ${encoded}`,
        { timeout: 5000 }
      );
      const lines = stdout.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        const parts = line.split("|");
        if (parts.length < 3) continue;
        const name = parts[0]!;
        const utilVal = parts[1]!;
        const memVal = parts[2]!;
        const gpu = gpus.find(g => g.name.toLowerCase() === name.toLowerCase());
        if (!gpu) continue;
        if (utilVal !== "-") gpu.utilization = parseFloat(utilVal) || 0;
        if (memVal !== "-") gpu.memoryUsedMB = parseInt(memVal, 10) || 0;
      }
    } catch { /* Windows Performance Counters not available */ }

    return gpus;
  })();
}

ipcMain.handle("get-system-stats", async () => {
  const [gpus] = await Promise.all([getGpuInfo()]);
  return { cpu: getCpuUsage(), memory: getMemoryInfo(), gpus };
});

// ── Config (accent color, language, etc) ──────────────────

const configDir = join(app.getPath("userData"), "kaistu-studio");
const configFile = join(configDir, "config.json");

function loadConfig(): Record<string, unknown> {
  try {
    if (existsSync(configFile)) {
      return JSON.parse(readFileSync(configFile, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(cfg: Record<string, unknown>) {
  try {
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
    const current = loadConfig();
    writeFileSync(configFile, JSON.stringify({ ...current, ...cfg }, null, 2), "utf-8");
  } catch { /* ignore */ }
}

ipcMain.handle("get-config", () => loadConfig());
ipcMain.handle("set-config", (_event, cfg: Record<string, unknown>) => {
  saveConfig(cfg);
});

// ── Model Manager ─────────────────────────────────────────
const modelPathsFile = join(configDir, "model-paths.json");

function loadModelPaths(): string[] {
  try {
    if (existsSync(modelPathsFile)) {
      return JSON.parse(readFileSync(modelPathsFile, "utf-8"));
    }
  } catch { /* ignore */ }
  return [];
}

function saveModelPaths(paths: string[]) {
  try {
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
    writeFileSync(modelPathsFile, JSON.stringify(paths, null, 2), "utf-8");
  } catch { /* ignore */ }
}

const MODEL_EXTENSIONS = new Set([
  ".ckpt", ".safetensors", ".pt", ".pth", ".bin",
  ".vae.pt", ".vae.safetensors", ".patch", ".gguf", ".gguf_model",
]);

function isModelFile(name: string): boolean {
  const lower = name.toLowerCase();
  for (const ext of MODEL_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

const FOLDER_TYPE_MAP: Record<string, string> = {
  "checkpoint": "checkpoint",
  "checkpoints": "checkpoint",
  "diffusion_models": "checkpoint",
  "stable-diffusion": "checkpoint",
  "lora": "lora",
  "loras": "lora",
  "lycoris": "lora",
  "vae": "vae",
  "vaes": "vae",
  "clip": "clip",
  "clips": "clip",
  "clip_vision": "clip_vision",
  "text_encoder": "text_encoder",
  "text_encoders": "text_encoder",
  "controlnet": "controlnet",
  "controlnets": "controlnet",
  "cnet": "controlnet",
  "upscaler": "upscaler",
  "upscalers": "upscaler",
  "upscale_models": "upscaler",
  "embedding": "embedding",
  "embeddings": "embedding",
  "unet": "unet",
  "unets": "unet",
  "gligen": "gligen",
  "style_model": "style_model",
  "style_models": "style_model",
  "hypernetwork": "hypernetwork",
  "hypernetworks": "hypernetwork",
  "inpaint": "inpaint",
};

function detectTypeByFolder(folder: string): string | null {
  const lower = folder.toLowerCase().replace(/[ _-]/g, "_");
  // Check all path segments for type matches
  const segments = lower.split(/[/\\]/);
  for (const seg of segments) {
    const normalized = seg.replace(/_+$/, "");
    for (const [key, val] of Object.entries(FOLDER_TYPE_MAP)) {
      if (normalized === key || normalized === key.replace(/_/g, "")) return val;
    }
  }
  return null;
}

function detectTypeByName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("clip_vision") || lower.includes("clip-vision")) return "clip_vision";
  if (lower.includes("vae")) return "vae";
  if (lower.includes("lora") || lower.includes("lycoris")) return "lora";
  if (lower.includes("embedding") || lower.includes("textual")) return "embedding";
  if (lower.includes("control") || lower.includes("cnet")) return "controlnet";
  if (lower.includes("upscale") || lower.includes("esrgan") || lower.includes("realesr")) return "upscaler";
  if (lower.includes("unet")) return "unet";
  if (lower.includes("gligen")) return "gligen";
  if (lower.includes("style") || lower.includes("style_model")) return "style_model";
  if (lower.includes("hypernetwork") || lower.includes("hyper_network")) return "hypernetwork";
  if (lower.includes("inpaint")) return "inpaint";
  if (lower.includes("clip")) return "clip";
  if (lower.endsWith(".safetensors") || lower.endsWith(".ckpt") || lower.endsWith(".pt") || lower.endsWith(".pth") || lower.endsWith(".gguf") || lower.endsWith(".gguf_model")) return "checkpoint";
  return "other";
}

function getParentFolderName(filePath: string, rootDir: string): string {
  // Return full relative path (without filename) for type detection
  const rel = filePath.slice(rootDir.length).replace(/^[\\/]+/, "");
  return rel.split(/[/\\]/).slice(0, -1).join("/") ?? "";
}

function scanDirectory(dir: string): Array<{ name: string; path: string; type: string; sizeMB: number; folder: string }> {
  const results: Array<{ name: string; path: string; type: string; sizeMB: number; folder: string }> = [];
  function walk(d: string, depth: number) {
    if (depth > 5) return;
    try {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const fullPath = join(d, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (entry.isFile() && isModelFile(entry.name)) {
          try {
            const stats = statSync(fullPath);
            const sizeMB = stats.size / (1024 * 1024);
            const folder = getParentFolderName(fullPath, dir);
            results.push({ name: entry.name, path: fullPath, type: "", sizeMB, folder });
          } catch { /* skip */ }
        }
      }
    } catch { /* permission denied etc */ }
  }
  walk(dir, 0);
  return results;
}

function hasModelFiles(dir: string): boolean {
  // Check up to 3 levels deep: models/*, models/*/*, models/*/*/*
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && isModelFile(entry.name)) return true;
    }
  } catch { /* skip */ }
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        for (const sub of readdirSync(join(dir, entry.name), { withFileTypes: true })) {
          if (sub.isFile() && isModelFile(sub.name)) return true;
          if (sub.isDirectory()) {
            try {
              for (const sub2 of readdirSync(join(dir, entry.name, sub.name), { withFileTypes: true })) {
                if (sub2.isFile() && isModelFile(sub2.name)) return true;
              }
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return false;
}

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".svn", "__pycache__",
  "temp", "tmp", "logs", "log", ".npm", ".yarn", ".pnpm",
  "Microsoft", "Windows", "WinSxS", "System32", "SysWOW64",
  "Intel", "AMD", "NVIDIA", "Package Cache", "Installer",
  "Common Files", "Internet Explorer", "MSBuild",
]);

function findModelsFolders(rootPath: string, maxDepth: number): Array<{ label: string; path: string }> {
  const results: Array<{ label: string; path: string }> = [];
  const seen = new Set<string>();
  function walk(d: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const fullPath = join(d, entry.name);
        if (!entry.isDirectory()) continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        const normalized = fullPath.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        if (entry.name.toLowerCase() === "models") {
          // Don't filter by hasModelFiles here — scanDirectory will handle it
          const parent = basename(d);
          results.push({ label: parent || d, path: fullPath });
        } else {
          walk(fullPath, depth + 1);
        }
      }
    } catch { /* skip */ }
  }
  walk(rootPath, 0);
  return results;
}

const DISCOVER_SEARCH_ROOTS: Array<{ path: string; depth: number }> = [];

function initDiscoverRoots() {
  if (DISCOVER_SEARCH_ROOTS.length > 0) return;
  const localAppData = process.env.LOCALAPPDATA ?? join(os.homedir(), "AppData", "Local");
  const appData = process.env.APPDATA ?? join(os.homedir(), "AppData", "Roaming");
  const userHome = os.homedir();

  // AppData dirs — best chance for AI tool models
  DISCOVER_SEARCH_ROOTS.push({ path: localAppData, depth: 4 });
  if (appData !== localAppData) DISCOVER_SEARCH_ROOTS.push({ path: appData, depth: 4 });

  // User home — shallow search only (avoid deep junk like node_modules, .git, etc.)
  DISCOVER_SEARCH_ROOTS.push({ path: userHome, depth: 3 });

  // ProgramData
  const progData = process.env.PROGRAMDATA ?? "C:\\ProgramData";
  if (existsSync(progData)) DISCOVER_SEARCH_ROOTS.push({ path: progData, depth: 3 });

  // Program Files (some tools install here)
  const progFiles = process.env.PROGRAMFILES ?? "C:\\Program Files";
  if (existsSync(progFiles)) DISCOVER_SEARCH_ROOTS.push({ path: progFiles, depth: 3 });
  const progFilesX86 = process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";
  if (existsSync(progFilesX86) && progFilesX86 !== progFiles) {
    DISCOVER_SEARCH_ROOTS.push({ path: progFilesX86, depth: 3 });
  }
}

function getSoftwareLabelFromPath(modelsPath: string): string {
  const lower = modelsPath.toLowerCase();
  if (lower.includes("comfy")) return "ComfyUI";
  if (lower.includes("stable-diffusion-webui") || lower.includes("a1111")) return "A1111 / Forge";
  if (lower.includes("invokeai")) return "InvokeAI";
  if (lower.includes("diffusionbee")) return "DiffusionBee";
  if (lower.includes("fooocus")) return "Fooocus";
  if (lower.includes("ltx")) return "LTX Studio";
  const parent = basename(dirname(modelsPath));
  return parent || "Modelos";
}

ipcMain.handle("get-model-paths", () => loadModelPaths());

ipcMain.handle("set-model-paths", (_event, paths: string[]) => {
  saveModelPaths(paths);
});

ipcMain.handle("discover-model-paths", () => {
  const discovered: Array<{ label: string; path: string }> = [];
  const localAppData = process.env.LOCALAPPDATA ?? join(os.homedir(), "AppData", "Local");
  const userHome = os.homedir();

  // ── Keep hardcoded known paths for speed ──
  const comfyDesktop = join(localAppData, "Comfy-Desktop");
  const comfyShared = join(comfyDesktop, "ComfyUI-Shared", "models");
  if (existsSync(comfyShared)) discovered.push({ label: "ComfyUI (Shared)", path: comfyShared });
  const comfyInstalls = join(comfyDesktop, "ComfyUI-Installs");
  if (existsSync(comfyInstalls)) {
    try {
      for (const entry of readdirSync(comfyInstalls, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const modelsDir = join(comfyInstalls, entry.name, "ComfyUI", "models");
          if (existsSync(modelsDir)) discovered.push({ label: `ComfyUI (${entry.name})`, path: modelsDir });
        }
      }
    } catch { /* skip */ }
  }
  const comfyPortable = join(userHome, "ComfyUI", "models");
  if (existsSync(comfyPortable)) discovered.push({ label: "ComfyUI (Portable)", path: comfyPortable });
  const sdBase = join(userHome, "stable-diffusion-webui", "models");
  if (existsSync(sdBase)) discovered.push({ label: "A1111 / Forge", path: sdBase });
  const invokeDir = join(userHome, "invokeai", "models");
  if (existsSync(invokeDir)) discovered.push({ label: "InvokeAI", path: invokeDir });
  const beeDir = join(userHome, "DiffusionBee", "models");
  if (existsSync(beeDir)) discovered.push({ label: "DiffusionBee", path: beeDir });
  const fooocusDir = join(userHome, "Fooocus", "models");
  if (existsSync(fooocusDir)) discovered.push({ label: "Fooocus", path: fooocusDir });
  const ltxDir = join(userHome, "LTX Studio", "models");
  if (existsSync(ltxDir)) discovered.push({ label: "LTX Studio", path: ltxDir });
  const ltxLocal = join(localAppData, "LTX Studio", "models");
  if (existsSync(ltxLocal)) discovered.push({ label: "LTX Studio", path: ltxLocal });
  const ltxPrograms = join(localAppData, "Programs", "LTX Studio", "models");
  if (existsSync(ltxPrograms)) discovered.push({ label: "LTX Studio", path: ltxPrograms });

  // ── Broad search for any folder named "models" with model files ──
  initDiscoverRoots();
  const seen = new Set<string>();
  for (const r of DISCOVER_SEARCH_ROOTS) {
    if (!existsSync(r.path)) continue;
    const found = findModelsFolders(r.path, r.depth);
    for (const f of found) {
      if (seen.has(f.path)) continue;
      seen.add(f.path);
      // Only add if not already discovered
      if (!discovered.some((d) => d.path === f.path)) {
        discovered.push(f);
      }
    }
  }

  return discovered;
});

ipcMain.handle("scan-models", async (_event, sources: Array<{ path: string; label: string }>) => {
  const all: Array<{ name: string; path: string; type: string; sizeMB: number; software: string }> = [];
  for (const src of sources) {
    if (existsSync(src.path)) {
      const files = scanDirectory(src.path);
      for (const f of files) {
        // Determine type: folder name first, then filename fallback
        const folderType = f.folder ? detectTypeByFolder(f.folder) : null;
        const type = folderType ?? detectTypeByName(f.name);
        all.push({
          name: f.name,
          path: f.path,
          type,
          sizeMB: f.sizeMB,
          software: src.label || getSoftwareLabelFromPath(src.path),
        });
      }
    }
  }
  return all;
});

// ── Model actions ─────────────────────────────────────────────

ipcMain.handle("reveal-in-folder", async (_event, path: string) => {
  shell.showItemInFolder(path);
});

ipcMain.handle("delete-model", async (_event, path: string) => {
  if (existsSync(path)) {
    unlinkSync(path);
  }
});

// ── Menu via IPC ──────────────────────────────────────────

ipcMain.handle("show-menu", (_event, menuKey: string) => {
  const def = MENUS[menuKey];
  if (!def) return;

  const template: MenuItemConstructorOptions[] = def.submenu.map((item) => {
    if (item.label === "---") return { type: "separator" };
    return {
      label: item.label,
      ...(item.accelerator ? { accelerator: item.accelerator } : {}),
      click: () => mainWindow?.webContents.send("menu-action", item.action),
    };
  });

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow! });
});

// ── Hugging Face API ──────────────────────────────────────

const HF_TOKEN_PATH = join(os.homedir(), ".cache", "huggingface", "token");
let hfToken: string | null = null;
try {
  if (existsSync(HF_TOKEN_PATH)) {
    hfToken = readFileSync(HF_TOKEN_PATH, "utf-8").trim();
  }
} catch { /* no token */ }

async function hfFetch(path: string): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const fullUrl = `https://huggingface.co${path}`;
  try {
    const res = await fetch(fullUrl, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HF error: ${res.status}`);
    const data = await res.json();
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function similarity(a: string, b: string): number {
  const al = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const bl = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (al === bl) return 1;
  if (al.includes(bl) || bl.includes(al)) return 0.9;
  const short = al.length < bl.length ? al : bl;
  const long = al.length < bl.length ? bl : al;
  let matchCount = 0;
  for (let i = 0; i < short.length; i++) {
    if (long.includes(short.slice(i, i + 3)) && short.length >= 3) matchCount++;
  }
  return matchCount / short.length;
}

function stripQuantSuffix(name: string): string {
  // Strip quantization tokens from right to left (e.g. _fp4_mixed, _it, _fp8, _int4, _Q4, etc.)
  let stripped = name;
  while (true) {
    const next = stripped.replace(/[_\-](?:fp\d+|int\d+|q\d+|mixed|it|bf\d+|gguf|ggml|nf\d+)[_\-]?$/i, "");
    if (next === stripped) break;
    stripped = next;
  }
  return stripped;
}

ipcMain.handle("search-hf-model", async (_event, query: string) => {
  console.info("[HF] HANDLER ENTERED:", query);
  try {
    const normalize = (s: string) => s.toLowerCase().replace(/[_.-\s]/g, "");
    const extMatch = query.match(/^(.+?)\.([^.]+)$/);
    const name = extMatch ? extMatch[1]! : query;
    const nameWithExt = query;
    const normNameWithExt = normalize(nameWithExt);
    const normName = normalize(name);

    // Step 1: Search HF API with name+extension
    const url1 = `/api/models?search=${encodeURIComponent(nameWithExt)}&limit=10`;
    console.info("[HF] LLAMADA 1:", url1);
    const data = await hfFetch(url1);
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.info("[HF] 0 resultados, no existe");
      return null;
    }
    console.info(`[HF] ${data.length} resultados`);

    // Helper: build secondary list from search results (excluding winner id)
    const buildSecondary = (excludeId?: string) =>
      data
        .filter((d: any) => d.id !== excludeId)
        .map((d: any) => ({
          id: d.id,
          downloads: d.downloads ?? 0,
          likes: d.likes ?? 0,
          pipeline_tag: d.pipeline_tag ?? "",
          description: "",
          tags: [],
          author: d.id.split("/")[0] ?? "",
          safetensors: null,
          license: "",
        }));

    // Helper: format result with detail
    const formatResult = (top: any, detail: any) => ({
      primary: {
        id: top.id,
        downloads: top.downloads ?? 0,
        likes: top.likes ?? 0,
        pipeline_tag: top.pipeline_tag ?? "",
        description: detail?.cardData?.description ?? detail?.cardData?.summary ?? "",
        tags: Array.isArray(detail?.tags) ? detail.tags.map((t: unknown) => typeof t === "string" ? t : String(t)) : [],
        author: top.id.split("/")[0] ?? "",
        safetensors: detail?.safetensors?.total ?? null,
        license: detail?.cardData?.license ?? "",
        files: (detail?.siblings ?? []).map((s: any) => s.rfilename).filter((f: string) => /\.(safetensors|ckpt|gguf|pt|pth)$/i.test(f)),
      },
      secondary: buildSecondary(top.id),
      variants: [],
    });

    // Step 2: Filter 1 - normalized repo.id === normalized name+ext
    let found = data.find((d: any) => d.id && normalize(d.id) === normNameWithExt);
    if (found) {
      console.info("[HF] Filter 1 match:", found.id);
      const detail: any = await hfFetch(`/api/models/${found.id}`);
      return formatResult(found, detail);
    }

    // Step 3: Filter 2 - normalized repo.id === normalized name (sin ext)
    found = data.find((d: any) => d.id && normalize(d.id) === normName);
    if (found) {
      console.info("[HF] Filter 2 match:", found.id);
      const detail: any = await hfFetch(`/api/models/${found.id}`);
      return formatResult(found, detail);
    }

    // Step 4: Filter 3 - for each repo, check if any file === nameWithExt
    for (const d of data) {
      console.info("[HF] Filter 3 - buscando en archivos de:", d.id);
      try {
        const detail: any = await hfFetch(`/api/models/${d.id}`);
        if (detail) {
          const files: string[] = (detail?.siblings ?? []).map((s: any) => s.rfilename);
          if (files.includes(nameWithExt)) {
            console.info("[HF] Filter 3 match por archivo:", d.id);
            return formatResult(d, detail);
          }
        }
      } catch { /* skip */ }
    }

    // Step 5: No exact match - return all as secondary
    console.info("[HF] Sin match exacto, devolviendo todos como posibles");
    return {
      primary: null,
      secondary: buildSecondary(),
      variants: [],
    };
  } catch (err) {
    console.error(`[HF] Handler error:`, err);
    return null;
  }
});

ipcMain.handle("show-root-menu", () => {
  const template: MenuItemConstructorOptions[] = Object.values(MENUS).map((m) => ({
    label: m.label,
    submenu: m.submenu.map((item) => {
      if (item.label === "---") return { type: "separator" as const };
      return {
        label: item.label,
        ...(item.accelerator ? { accelerator: item.accelerator } : {}),
        click: () => mainWindow?.webContents.send("menu-action", item.action),
      };
    }),
  }));
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow! });
});

// ── API Keys (via backend) ─────────────────────────────────── (v2)

ipcMain.handle("get-api-keys", async () => {
  return fetchBackend("/api-keys");
});

ipcMain.handle("save-api-key", async (_event, payload: { service: string; api_key: string }) => {
  return fetchBackend("/api-keys", { method: "POST", body: JSON.stringify(payload) });
});

ipcMain.handle("delete-api-key", async (_event, service: string) => {
  return fetchBackend(`/api-keys/${service}`, { method: "DELETE" });
});

// ── Civitai Search ───────────────────────────────────────────────

ipcMain.handle("search-civitai-model", async (_event, query: string) => {
  try {
    const normalize = (s: string) => s.toLowerCase().replace(/[_.-\s]/g, "");
    const normQuery = normalize(query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://civitai.com/api/v1/models?limit=10&query=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;

    // Find best match: exact normalized → includes → closest highest downloads
    let best: any = null;
    let bestScore = -1;
    for (const item of data.items) {
      const normName = normalize(item.name);
      if (normName === normQuery) { best = item; bestScore = 3; break; }
      if (normName.includes(normQuery) || normQuery.includes(normName)) {
        if (bestScore < 2) { best = item; bestScore = 2; }
        continue;
      }
      // Partial word match: at least 2 query words appear in name
      const queryWords = normQuery.split(/\d+/).filter(Boolean).concat(normQuery.match(/\d+/g) || []);
      const nameWords = normName.split(/\d+/).filter(Boolean).concat(normName.match(/\d+/g) || []);
      const matches = queryWords.filter(w => nameWords.some(n => n.includes(w)));
      if (matches.length >= 2 && bestScore < 1) { best = item; bestScore = 1; }
    }

    // Fallback: just highest downloads
    if (!best) {
      best = data.items.reduce((a: any, b: any) => (a.downloadCount || 0) > (b.downloadCount || 0) ? a : b);
    }
    return {
      primary: best,
      secondary: data.items.filter((i: any) => i.id !== best.id),
    };
  } catch {
    return null;
  }
});

ipcMain.handle("run-in-terminal", async (_event, cmd: string) => {
  return new Promise((resolve) => {
    const proc = spawn(cmd, [], { shell: true, cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => stdout += d.toString());
    proc.stderr?.on("data", (d) => stderr += d.toString());
    proc.on("close", () => resolve({ stdout, stderr }));
    proc.on("error", (e) => resolve({ stdout: "", stderr: String(e) }));
  });
});

ipcMain.handle("get-logs", async () => {
  try {
    return logBuffer.join("\n") || "No logs yet. Try running a HuggingFace search to see debug output.";
  } catch {
    return "Error reading logs";
  }
});

ipcMain.handle("get-terminal-info", async () => {
  const user = process.env.USERNAME || process.env.USER || "unknown";
  const host = os.hostname();
  const cwd = process.cwd();
  const venv = process.env.VIRTUAL_ENV || process.env.CONDA_PREFIX || "";
  return { user, host, cwd, venv };
});

ipcMain.handle("get-hf-debug", async () => {
  return { requests: lastHfRequests, responses: lastHfResponses };
});
function stripExtension(query: string): string {
  return query.replace(/\.(safetensors|ckpt|gguf|pt|pth)$/i, "");
}

