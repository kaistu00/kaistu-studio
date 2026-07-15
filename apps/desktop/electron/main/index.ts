import { app, BrowserWindow, Menu, MenuItemConstructorOptions, shell, ipcMain, protocol, dialog } from "electron";
import { basename, join, dirname, extname } from "path";
import https from "https";

// Register privileged scheme before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-file",
    privileges: {
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from "fs";
import { spawn, exec } from "child_process";
import { is } from "@electron-toolkit/utils";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;
let isMaximized = false;
let pendingLogs: string[] = [];

// Log storage
let logBuffer: string[] = [];

function logToBuffer(...args: any[]) {
  const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
  logBuffer.push(new Date().toISOString() + " " + msg);
  if (logBuffer.length > 1000) logBuffer = logBuffer.slice(-500);
}

function sendLogEntry(msg: string) {
  // Store if no window ready, send when available
  if (!mainWindow || mainWindow.webContents.isDestroyed()) {
    pendingLogs.push(msg);
    if (pendingLogs.length > 500) pendingLogs = pendingLogs.slice(-100);
    return;
  }
  try {
    // Flush pending logs
    for (const pending of pendingLogs) {
      mainWindow.webContents.send("log-entry", pending);
    }
    pendingLogs = [];
    mainWindow.webContents.send("log-entry", msg);
  } catch {}
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

let backendProcess: import("child_process").ChildProcess | null = null;

function getBackendDir(): string {
  // Look for backend directory relative to the app root
  const candidates = [
    join(__dirname, "../../../../backend"),      // dev: apps/desktop/electron/main -> root/backend
    join(process.cwd(), "backend"),              // cwd fallback
  ];
  for (const d of candidates) {
    if (existsSync(d)) return d;
  }
  return join(process.cwd(), "backend");
}

function getVenvDir(backendDir: string): string {
  return join(backendDir, "kaistu-studio");
}

function getVenvPython(venvDir: string): string {
  return process.platform === "win32"
    ? join(venvDir, "Scripts", "python.exe")
    : join(venvDir, "bin", "python");
}

async function detectGPUType(): Promise<string> {
  // Use nvidia-smi to check for NVIDIA GPU
  try {
    const { stdout } = await execAsync("nvidia-smi --query-gpu=name --format=csv,noheader", { timeout: 5000 });
    if (stdout.trim()) return "nvidia";
  } catch {}
  // Check for AMD ROCm
  try {
    const { stdout } = await execAsync("rocm-smi --version", { timeout: 5000 });
    if (stdout.trim()) return "amd";
  } catch {}
  // Check for Apple Silicon
  if (process.platform === "darwin" && process.arch === "arm64") {
    try {
      const { stdout } = await execAsync("sysctl -n machdep.cpu.brand_string", { timeout: 3000 });
      if (stdout.includes("Apple")) return "apple";
    } catch {}
  }
  return "cpu";
}

function getGPUPackages(gpuType: string, cudaSuffix?: string, rocmSuffix?: string): string[] {
  const base = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "sqlalchemy>=2.0.0",
    "pydantic>=2.10.0",
    "psutil>=5.9.0",
    "httpx>=0.27.0",
    "alembic>=1.14.0",
    "python-multipart>=0.0.18",
    "GPUtil>=1.4.0",
    "cryptography>=44.0.0",
  ];
  switch (gpuType) {
    case "nvidia":
      return [
        ...base,
        "--index-url", `https://download.pytorch.org/whl/${cudaSuffix ?? "cu128"}`,
        "torch", "torchvision", "torchaudio",
        "xformers",
      ];
    case "amd":
      return [
        ...base,
        "--index-url", `https://download.pytorch.org/whl/${rocmSuffix ?? "rocm6.2"}`,
        "torch", "torchvision", "torchaudio",
      ];
    case "apple":
      return [
        ...base,
        "torch", "torchvision", "torchaudio",
      ];
    default:
      return [
        ...base,
        "torch", "torchvision", "torchaudio",
      ];
  }
}

async function ensureVenv(backendDir: string): Promise<{ python: string; gpuType: string }> {
  const venvDir = getVenvDir(backendDir);
  const python = getVenvPython(venvDir);

  let gpuType = "cpu";

  if (existsSync(python)) {
    console.log(`[backend] venv found at ${venvDir}`);
    // Still detect GPU type for module checks
    try { gpuType = await detectGPUType(); } catch {}
    return { python, gpuType };
  }

  console.log(`[backend] creating venv at ${venvDir}...`);
  const venvCreation = await execAsync(`py -m venv "${venvDir}"`, { cwd: backendDir, timeout: 30000 });
  if (venvCreation.stderr) console.warn(`[backend] venv stderr: ${venvCreation.stderr}`);

  if (!existsSync(python)) {
    throw new Error("Failed to create venv");
  }

  // Detect GPU hardware before installing
  console.log(`[backend] detecting GPU type...`);
  gpuType = await detectGPUType();
  console.log(`[backend] detected GPU: ${gpuType}`);

  // Fetch latest PyTorch versions from the repo
  const [cudaSuffix, rocmSuffix] = await Promise.all([
    fetchLatestPytorchCudaSuffix(),
    fetchLatestPytorchRocmSuffix(),
  ]);

  // Install packages based on GPU type
  const packages = getGPUPackages(gpuType, cudaSuffix, rocmSuffix);
  console.log(`[backend] installing ${packages.length} packages (${gpuType} profile)...`);
  const pkgList = packages.join(" ");
  const install = await execAsync(
    `"${python}" -m pip install ${pkgList}`,
    { cwd: backendDir, timeout: 600000, maxBuffer: 50 * 1024 * 1024 }
  );
  if (install.stderr) console.warn(`[backend] pip stderr: ${install.stderr.slice(0, 2000)}`);

  console.log(`[backend] venv ready with ${gpuType} support`);
  return { python, gpuType };
}

const MODULE_TO_PACKAGE: Record<string, string> = {
  "fastapi": "fastapi>=0.115.0",
  "uvicorn": "uvicorn[standard]>=0.34.0",
  "sqlalchemy": "sqlalchemy>=2.0.0",
  "pydantic": "pydantic>=2.10.0",
  "psutil": "psutil>=5.9.0",
  "httpx": "httpx>=0.27.0",
  "alembic": "alembic>=1.14.0",
  "multipart": "python-multipart>=0.0.18",
  "GPUtil": "GPUtil>=1.4.0",
  "torch": "torch>=2.5.0",
  "torchvision": "torchvision",
  "torchaudio": "torchaudio",
  "xformers": "xformers>=0.0.29",
  "cryptography": "cryptography>=44.0.0",
};

async function checkAndInstallModules(python: string, gpuType: string, backendDir: string): Promise<void> {
  const requiredModules = [
    "fastapi", "uvicorn", "sqlalchemy", "pydantic",
    "psutil", "httpx", "alembic", "multipart", "GPUtil",
    "torch", "torchvision", "torchaudio", "cryptography",
  ];
  if (gpuType === "nvidia") requiredModules.push("xformers");

  // Write a temp Python script to check imports
  const checkScript = requiredModules.map(m => `  try: import ${m}; print("OK:${m}")\nexcept Exception: print("MISS:${m}")`).join("\n");
  const scriptContent = `import sys\n${checkScript}\n`;
  const scriptPath = join(backendDir, "__check_modules.py");
  writeFileSync(scriptPath, scriptContent, "utf-8");

  let result: string;
  try {
    const { stdout } = await execAsync(`"${python}" "${scriptPath}"`, { timeout: 15000 });
    result = stdout;
  } catch {
    result = ""; // fallback below
  } finally {
    try { unlinkSync(scriptPath); } catch {}
  }

  const missing = result.split("\n")
    .filter(l => l.startsWith("MISS:"))
    .map(l => l.replace("MISS:", "").trim())
    .filter(Boolean);

  if (missing.length === 0) {
    console.log(`[backend] all ${requiredModules.length} modules verified`);
    return;
  }

  const packages = missing.map(m => MODULE_TO_PACKAGE[m]).filter(Boolean);
  if (packages.length === 0) {
    console.warn(`[backend] missing modules with no known package: ${missing.join(", ")}`);
    return;
  }

  console.log(`[backend] installing missing modules: ${missing.join(", ")}`);
  // If torch is missing on NVIDIA, use the latest CUDA index
  const torchPkgs = ["torch", "torchvision", "torchaudio"];
  const needsCuda = gpuType === "nvidia" && torchPkgs.some(m => missing.includes(m));
  const extraArgs = needsCuda
    ? ["--index-url", `https://download.pytorch.org/whl/${await fetchLatestPytorchCudaSuffix()}`]
    : [];
  const installArgs = [...extraArgs, ...packages];
  const install = await execAsync(
    `"${python}" -m pip install ${installArgs.join(" ")}`,
    { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }
  );
  if (install.stderr) console.warn(`[backend] pip stderr: ${install.stderr.slice(0, 2000)}`);
  console.log(`[backend] missing modules installed`);
}

async function fetchLatestPytorchCudaSuffix(): Promise<string> {
  const knownCuda = [128, 126, 124];
  try {
    const html = await new Promise<string>((resolve, reject) => {
      https.get("https://download.pytorch.org/whl/torch_stable.html", (res) => {
        let data = "";
        res.on("data", (chunk: string) => data += chunk);
        res.on("end", () => resolve(data));
      }).on("error", reject);
    });
    const cudaVersions = new Set([...html.matchAll(/cu(\d{3})/g)].map(m => parseInt(m[1])));
    const best = knownCuda.find(v => cudaVersions.has(v));
    if (best) {
      console.log(`[backend] latest PyTorch CUDA version: cu${best}`);
      return `cu${best}`;
    }
  } catch (err) {
    console.warn(`[backend] failed to fetch PyTorch CUDA versions: ${err}`);
  }
  return "cu128";
}

async function fetchLatestPytorchRocmSuffix(): Promise<string> {
  try {
    const html = await new Promise<string>((resolve, reject) => {
      https.get("https://download.pytorch.org/whl/torch_stable.html", (res) => {
        let data = "";
        res.on("data", (chunk: string) => data += chunk);
        res.on("end", () => resolve(data));
      }).on("error", reject);
    });
    const matches = [...html.matchAll(/rocm(\d+\.\d+)/g)].map(m => parseFloat(m[1]));
    if (matches.length > 0) {
      const latest = Math.max(...matches).toFixed(1);
      console.log(`[backend] latest PyTorch ROCm version: rocm${latest}`);
      return `rocm${latest}`;
    }
  } catch (err) {
    console.warn(`[backend] failed to fetch PyTorch ROCm versions: ${err}`);
  }
  return "rocm6.2";
}

async function ensureOptimalPytorch(python: string, backendDir: string): Promise<string> {
  const gpuType = await detectGPUType();
  if (gpuType === "cpu") {
    console.log(`[backend] no GPU detected, keeping CPU PyTorch`);
    return gpuType;
  }

  // Check current PyTorch backend
  const checkScript = [
    'import sys',
    'try:',
    '  import torch',
    '  if torch.cuda.is_available(): sys.stdout.write("cuda")',
    '  elif torch.backends.mps.is_available(): sys.stdout.write("mps")',
    '  else: sys.stdout.write("cpu")',
    'except Exception: sys.stdout.write("null")',
  ].join("\n");
  const scriptPath = join(backendDir, "__check_torch.py");
  writeFileSync(scriptPath, checkScript, "utf-8");

  let current = "null";
  try {
    const { stdout } = await execAsync(`"${python}" "${scriptPath}"`, { timeout: 15000 });
    current = stdout.trim();
  } catch {} finally {
    try { unlinkSync(scriptPath); } catch {}
  }

  if (current !== "cpu") {
    console.log(`[backend] PyTorch already uses ${current}, no upgrade needed`);
    return gpuType;
  }

  if (gpuType === "nvidia") {
    const cudaSuffix = await fetchLatestPytorchCudaSuffix();
    console.log(`[backend] NVIDIA GPU detected but PyTorch is CPU. Upgrading to ${cudaSuffix}...`);
    const install = await execAsync(
      `"${python}" -m pip install --upgrade --force-reinstall --index-url https://download.pytorch.org/whl/${cudaSuffix} torch torchvision torchaudio xformers`,
      { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }
    );
    if (install.stderr) console.warn(`[backend] pip stderr: ${install.stderr.slice(0, 2000)}`);
    console.log(`[backend] PyTorch upgraded to ${cudaSuffix}`);
  } else if (gpuType === "amd") {
    const rocmSuffix = await fetchLatestPytorchRocmSuffix();
    console.log(`[backend] AMD GPU detected but PyTorch is CPU. Upgrading to ${rocmSuffix}...`);
    const install = await execAsync(
      `"${python}" -m pip install --upgrade --force-reinstall --index-url https://download.pytorch.org/whl/${rocmSuffix} torch torchvision torchaudio`,
      { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }
    );
    if (install.stderr) console.warn(`[backend] pip stderr: ${install.stderr.slice(0, 2000)}`);
    console.log(`[backend] PyTorch upgraded to ${rocmSuffix}`);
  }
  return gpuType;
}

async function startBackend(): Promise<void> {
  const backendDir = getBackendDir();
  console.log(`[backend] backend dir: ${backendDir}`);

  if (!existsSync(backendDir)) {
    console.warn(`[backend] backend directory not found, skipping auto-start`);
    return;
  }

  let info: { python: string; gpuType: string };
  try {
    info = await ensureVenv(backendDir);
  } catch (err) {
    console.error(`[backend] venv setup failed: ${err}`);
    return;
  }

  // Check and install any missing modules before starting
  try {
    await checkAndInstallModules(info.python, info.gpuType, backendDir);
  } catch (err) {
    console.error(`[backend] module check failed: ${err}`);
  }

  // Ensure the best PyTorch variant for the detected GPU
  try {
    info.gpuType = await ensureOptimalPytorch(info.python, backendDir);
  } catch (err) {
    console.error(`[backend] PyTorch optimization failed: ${err}`);
  }

console.log(`[backend] starting uvicorn...`);
   backendProcess = spawn(info.python, ["-m", "uvicorn", "app.main:app", "--port", "8000"], {
     cwd: backendDir,
     shell: true,
     stdio: ["ignore", "pipe", "pipe"],
   });

  backendProcess.stdout?.on("data", (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(`[backend] ${text}`);
  });

  backendProcess.stderr?.on("data", (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(`[backend] ${text}`);
  });

  backendProcess.on("error", (err) => {
    console.error(`[backend] process error: ${err.message}`);
  });

  backendProcess.on("exit", (code) => {
    console.log(`[backend] exited with code ${code}`);
    backendProcess = null;
  });

  // Wait for backend to be healthy
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/health`);
      if (res.ok) {
        console.log(`[backend] healthy after ${i + 1}s`);
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  console.warn(`[backend] did not become healthy within 30s`);
}

async function stopBackend(): Promise<void> {
   if (backendProcess) {
     console.log(`[backend] stopping...`);
     if (process.platform === "win32") {
       // Kill entire process tree
       await execAsync(`taskkill /pid ${backendProcess.pid} /T /F`).catch(() => {});
       // Also kill any lingering uvicorn/python processes
       await execAsync("taskkill /im uvicorn.exe /T /F").catch(() => {});
       await execAsync("taskkill /im python.exe /T /F").catch(() => {});
       await new Promise(r => setTimeout(r, 500));
     } else {
       backendProcess.kill("SIGTERM");
       await new Promise(r => setTimeout(r, 1000));
       if (backendProcess) backendProcess.kill("SIGKILL");
     }
     backendProcess = null;
   }
 }

async function fetchBackend(path: string, options?: RequestInit) {
  const url = `${BACKEND_URL}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    let detail = "";
    try { const body = await res.json(); detail = body.detail || JSON.stringify(body); } catch { detail = res.statusText; }
    throw new Error(`Backend error: ${res.status} — ${detail}`);
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

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    // Flush pending logs on first show
    for (const pending of pendingLogs) {
      mainWindow?.webContents.send("log-entry", pending);
    }
    pendingLogs = [];
  });
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

app.whenReady().then(async () => {
  await startBackend();

  // Register local-file protocol for serving local media files
  protocol.handle("local-file", (request) => {
    let filePath = decodeURI(request.url.slice("local-file://".length));
    if (process.platform === "win32" && /^\/[A-Za-z]:/.test(filePath)) {
      filePath = filePath.slice(1);
    }
    console.log("[local-file] serving:", filePath);
    const ext = extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".ogg": "video/ogg",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
      ".mkv": "video/x-matroska",
      ".wmv": "video/x-ms-wmv",
      ".flv": "video/x-flv",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
    };
    try {
      const buffer = readFileSync(filePath);
      return new Response(buffer, {
        headers: { "Content-Type": mimeMap[ext] || "video/mp4" },
      });
    } catch (err) {
      console.error("[local-file] error:", err);
      return new Response("File not found", { status: 404 });
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", async () => {
  await stopBackend();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── IPC Handlers ──────────────────────────────────────────

ipcMain.handle("log-message", async (_event, source: string, level: string, message: string) => {
  console.log(`[${source}] ${message}`);
  try {
    await fetch(`${BACKEND_URL}/api/v1/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, level, message }),
    });
  } catch {}
});

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

ipcMain.handle("get-system-capabilities", async () => {
  return fetchBackend("/system/capabilities");
});

// ── Config (accent color, language, etc) ──────────────────

ipcMain.handle("get-config", async () => {
  return fetchBackend("/config");
});
ipcMain.handle("set-config", async (_event, cfg: Record<string, unknown>) => {
  return fetchBackend("/config", { method: "POST", body: JSON.stringify(cfg) });
});

// ── Model Manager ─────────────────────────────────────────
const modelPathsFile = join(app.getPath("appData"), "kaistu-studio", "model-paths.json");

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
    const dir = dirname(modelPathsFile);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(modelPathsFile, JSON.stringify(paths, null, 2), "utf-8");
  } catch { /* ignore */ }
}

ipcMain.handle("get-model-paths", () => loadModelPaths());

ipcMain.handle("set-model-paths", (_event, paths: string[]) => {
  saveModelPaths(paths);
});

ipcMain.handle("discover-model-paths", async () => {
  return fetchBackend("/models/discover");
});

ipcMain.handle("scan-models", async (_event, sources: Array<{ path: string; label: string }>) => {
  return fetchBackend("/models/scan", { method: "POST", body: JSON.stringify(sources) });
});

ipcMain.handle("reveal-in-folder", async (_event, path: string) => {
   shell.showItemInFolder(path.replace(/\//g, "\\"));
 });

ipcMain.handle("open-file", async (_event, path: string) => {
  shell.openPath(path.replace(/\//g, "\\"));
});

ipcMain.handle("save-file-as", async (_event, sourcePath: string) => {
  const defaultName = basename(sourcePath);
  const result = await dialog.showSaveDialog({ defaultPath: defaultName });
  if (!result.canceled && result.filePath) {
    copyFileSync(sourcePath, result.filePath);
    return result.filePath;
  }
  return null;
});

ipcMain.handle("delete-model", async (_event, path: string) => {
  return fetchBackend("/models/delete", { method: "POST", body: JSON.stringify({ path }) });
});

ipcMain.handle("download-model", async (_event, url: string, filename: string, type: string) => {
  return fetchBackend("/models/download", { method: "POST", body: JSON.stringify({ url, filename, type }) });
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

ipcMain.handle("search-civitai-model", async (_event, query: string, nsfw?: boolean) => {
  try {
    const normalize = (s: string) => s.toLowerCase().replace(/[_.-\s]/g, "");
    const normQuery = normalize(query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://civitai.com/api/v1/models?limit=10&query=${encodeURIComponent(query)}&nsfw=${nsfw ? "true" : "false"}`, {
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

// ── HF Text Leaderboard ────────────────────────────────────────────

ipcMain.handle("hf-text-leaderboard", async () => {
  return fetchBackend("/models/hf-text-leaderboard");
});

ipcMain.handle("run-space", async (_event, spaceName: string, payload: any) => {
   console.log(`[IPC] run-space called with: ${spaceName}`);
   const safeEndpoint = spaceName.replace(/\//g, ":");
   console.log(`[IPC] mapped endpoint: /spaces/${safeEndpoint}`);
   const result = await fetchBackend(`/spaces/${safeEndpoint}`, { method: "POST", body: JSON.stringify(payload) });
   console.log(`[IPC] run-space result type: ${result?.type}`);
   return result;
 });

ipcMain.handle("get-space-info", async (_event, spaceId: string) => {
  const safeId = spaceId.replace(/\//g, ":");
  return fetchBackend(`/spaces/info/${safeId}`);
 });

// ── Upscalers (vía backend) ─────────────────────────────────

ipcMain.handle("get-upscalers", async () => {
  return fetchBackend("/upscalers");
});

ipcMain.handle("install-upscaler", async (_event, modelId: string) => {
  return fetchBackend(`/upscalers/${modelId}/install`, { method: "POST" });
});

// ── Upscaler Run ─────────────────────────────────────────

ipcMain.handle("run-upscaler", async (_event, modelId: string, payload: Record<string, unknown>) => {
  console.log(`[run-upscaler] model: ${modelId}, input: ${payload.input_path}`);
  return fetchBackend(`/upscalers/${modelId}/run`, { method: "POST", body: JSON.stringify(payload) });
});

// ── App data path ────────────────────────────────────────

ipcMain.handle("get-app-data-path", async () => {
  return join(app.getPath("appData"), "kaistu-studio");
});

// ── Folder picker ────────────────────────────────────────

ipcMain.handle("select-folder", async () => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── Executions (vía backend) ─────────────────────────────

ipcMain.handle("list-executions", async () => {
  return fetchBackend("/executions");
});

ipcMain.handle("start-execution", async (_event, params: Record<string, unknown>) => {
  return fetchBackend("/executions/start", { method: "POST", body: JSON.stringify(params) });
});

ipcMain.handle("update-execution", async (_event, execId: string, payload: Record<string, unknown>) => {
  return fetchBackend(`/executions/${execId}/progress`, { method: "POST", body: JSON.stringify(payload) });
});

ipcMain.handle("get-execution", async (_event, execId: string) => {
  return fetchBackend(`/executions/${execId}`);
});

ipcMain.handle("get-execution-stats", async () => {
   return fetchBackend("/executions/stats");
 });

ipcMain.handle("cancel-execution", async (_event, execId: string) => {
   return fetchBackend(`/executions/${execId}`, { method: "DELETE" });
 });

ipcMain.handle("read-file", async (_event, path: string) => {
   try {
     const data = readFileSync(path);
     return data.toString("base64");
   } catch {
     return null;
   }
 });

 ipcMain.handle("get-file-size", async (_event, path: string) => {
   try {
     const stat = await import("fs/promises").then(fs => fs.stat(path));
     if (!stat) throw new Error("not found");
     return String(stat.size);
   } catch {
     return null;
   }
 });

ipcMain.handle("get-video-preview", async (_event, path: string) => {
  try {
    const data = readFileSync(path);
    const ext = path.split(".").pop()?.toLowerCase() || "mp4";
    const mime = ext === "webm" ? "video/webm" : ext === "ogg" ? "video/ogg" : "video/mp4";
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
});


