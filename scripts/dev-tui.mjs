#!/usr/bin/env node
import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(ROOT, "backend");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const PB_URL = process.env.PB_URL || "http://127.0.0.1:8090";
const VITE_URL = process.env.VITE_URL || "http://127.0.0.1:3000";
const MAX_LOGS = 900;

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  inverse: "\x1b[7m",
};

const state = {
  logs: [],
  filter: "all",
  viewOffset: 0,
  commandMode: false,
  command: "",
  message: "Press s to start, ? for help, : for commands, q to quit.",
  quitting: false,
  renderQueued: false,
  lastStatsAt: 0,
  services: {
    pb: makeService("pb", "PocketBase", PB_URL),
    vite: makeService("vite", "Vite", VITE_URL),
  },
};

function makeService(key, label, url) {
  return {
    key,
    label,
    url,
    child: null,
    status: "stopped",
    starts: 0,
    restarts: 0,
    startedAt: null,
    exitCode: null,
    signal: null,
    http: "unknown",
    latencyMs: null,
    pidStats: null,
    stopRequested: false,
  };
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printCliHelp();
    process.exit(0);
  }

  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.error("dev-tui needs an interactive terminal.");
    console.error("Run `node scripts/dev-tui.mjs --help` for usage.");
    process.exit(1);
  }

  process.stdout.write("\x1b[?1049h\x1b[?25l");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", handleKey);
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  process.on("uncaughtException", (err) => {
    appendLog("tui", `uncaught: ${err.stack || err.message}`, "error");
    void shutdown(1);
  });

  appendLog("tui", "Converge dev console ready.");
  appendLog("tui", `PocketBase URL: ${PB_URL}`);
  appendLog("tui", `Frontend URL: ${VITE_URL}`);
  const pbBinary = resolvePocketBaseBinary();
  if (!pbBinary) {
    appendLog(
      "tui",
      "PocketBase binary missing. Put pocketbase(.exe) in backend/ or set PB_BINARY.",
      "warn",
    );
  } else {
    appendLog("tui", `PocketBase binary: ${pbBinary}`);
  }

  queueRender();
  setInterval(refreshStats, 1800).unref();
  setInterval(queueRender, 500).unref();
  refreshStats();

  if (!process.argv.includes("--no-start")) {
    setTimeout(startAll, 150);
  }
}

function printCliHelp() {
  console.log(`Converge Dev Console

Usage:
  node scripts/dev-tui.mjs [--no-start]

Options:
  --no-start   Open the TUI without starting PocketBase and Vite.
  --help       Show this help.

Environment:
  PB_BINARY                 Path to a PocketBase binary. Useful on macOS.
  PB_URL                    PocketBase URL shown and probed by the TUI. Default: http://127.0.0.1:8090
  VITE_URL                  Frontend URL shown and probed by the TUI. Default: http://127.0.0.1:3000
  PB_SUPERUSER_EMAIL        Enables admin API edit commands.
  PB_SUPERUSER_PASSWORD     Enables admin API edit commands.

Inside the TUI:
  s start, x stop, r restart, b restart PB, v restart Vite, : command prompt, ? help, q quit.
`);
}

function loadBackendEnv() {
  const envPath = path.join(BACKEND_DIR, ".env");
  if (!fs.existsSync(envPath)) return {};
  const loaded = {};
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    loaded[key] = value;
  }
  return loaded;
}

function resolvePocketBaseBinary() {
  if (process.env.PB_BINARY) return path.resolve(process.env.PB_BINARY);
  const platformBinary =
    process.platform === "win32"
      ? path.join(BACKEND_DIR, "pocketbase.exe")
      : path.join(BACKEND_DIR, "pocketbase");
  if (fs.existsSync(platformBinary)) return platformBinary;
  const fallbackExe = path.join(BACKEND_DIR, "pocketbase.exe");
  if (process.platform === "win32" && fs.existsSync(fallbackExe)) return fallbackExe;
  return null;
}

function npmBinary() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function startAll() {
  startService("pb");
  startService("vite");
}

function startService(key) {
  const service = state.services[key];
  if (!service || service.child) {
    setMessage(`${service?.label || key} is already running.`);
    return;
  }

  const backendEnv = loadBackendEnv();
  let command;
  let args;
  let cwd;
  let env = process.env;

  if (key === "pb") {
    command = resolvePocketBaseBinary();
    if (!command) {
      appendLog("pb", "Cannot start: PocketBase binary not found.", "error");
      return;
    }
    args = ["serve"];
    cwd = BACKEND_DIR;
    env = { ...process.env, ...backendEnv };
  } else {
    command = npmBinary();
    args = ["run", "dev"];
    cwd = FRONTEND_DIR;
  }

  appendLog(key, `starting: ${command} ${args.join(" ")}`);
  const child = spawn(command, args, {
    cwd,
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  service.child = child;
  service.status = "starting";
  service.starts += 1;
  service.startedAt = Date.now();
  service.exitCode = null;
  service.signal = null;
  service.stopRequested = false;

  pipeLogs(key, child.stdout);
  pipeLogs(key, child.stderr, "warn");

  child.on("spawn", () => {
    service.status = "running";
    appendLog(key, `started pid ${child.pid}`);
    queueRender();
  });

  child.on("error", (err) => {
    service.status = "error";
    appendLog(key, `spawn error: ${err.message}`, "error");
    queueRender();
  });

  child.on("exit", (code, signal) => {
    service.child = null;
    service.status = service.stopRequested ? "stopped" : "exited";
    service.exitCode = code;
    service.signal = signal;
    appendLog(key, `exited code=${code ?? "null"} signal=${signal ?? "none"}`);
    queueRender();
  });
}

function pipeLogs(source, stream, defaultLevel = "info") {
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => appendLog(source, line, defaultLevel));
}

async function stopAll() {
  await Promise.all([stopService("pb"), stopService("vite")]);
}

async function stopService(key) {
  const service = state.services[key];
  if (!service?.child) {
    setMessage(`${service?.label || key} is not running.`);
    return;
  }
  const pid = service.child.pid;
  service.stopRequested = true;
  appendLog(key, `stopping pid ${pid}`);

  if (process.platform === "win32") {
    await execFileSafe("taskkill.exe", ["/pid", String(pid), "/T", "/F"]);
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        service.child.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
  }
}

async function restartAll() {
  await stopAll();
  setTimeout(startAll, 600);
}

async function restartService(key) {
  const service = state.services[key];
  if (!service) return;
  service.restarts += 1;
  await stopService(key);
  setTimeout(() => startService(key), 600);
}

async function runOneShot(source, command, args, cwd, env = process.env) {
  appendLog(source, `$ ${command} ${args.join(" ")}`, "cmd");
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  pipeLogs(source, child.stdout);
  pipeLogs(source, child.stderr, "warn");
  child.on("exit", (code, signal) => {
    appendLog(source, `command finished code=${code ?? "null"} signal=${signal ?? "none"}`);
  });
  child.on("error", (err) => appendLog(source, `command error: ${err.message}`, "error"));
}

function handleKey(chunk) {
  if (state.quitting) return;
  if (chunk === "\u0003") {
    void shutdown();
    return;
  }

  if (state.commandMode) {
    handleCommandKey(chunk);
    return;
  }

  switch (chunk) {
    case "q":
      void shutdown();
      break;
    case "s":
      startAll();
      break;
    case "x":
      void stopAll();
      break;
    case "r":
      void restartAll();
      break;
    case "b":
      void restartService("pb");
      break;
    case "v":
      void restartService("vite");
      break;
    case "1":
      state.filter = "all";
      break;
    case "2":
      state.filter = "pb";
      break;
    case "3":
      state.filter = "vite";
      break;
    case "4":
      state.filter = "cmd";
      break;
    case "c":
      state.logs = [];
      appendLog("tui", "logs cleared");
      break;
    case ":":
      state.commandMode = true;
      state.command = "";
      break;
    case "?":
      showHelp();
      break;
    case "\x1b[A":
      state.viewOffset = Math.min(state.viewOffset + 3, filteredLogs().length);
      break;
    case "\x1b[B":
      state.viewOffset = Math.max(state.viewOffset - 3, 0);
      break;
  }
  queueRender();
}

function handleCommandKey(chunk) {
  if (chunk === "\r" || chunk === "\n") {
    const input = state.command.trim();
    state.commandMode = false;
    state.command = "";
    if (input) void runConsoleCommand(input);
    queueRender();
    return;
  }
  if (chunk === "\x1b") {
    state.commandMode = false;
    state.command = "";
    queueRender();
    return;
  }
  if (chunk === "\u007f" || chunk === "\b") {
    state.command = state.command.slice(0, -1);
    queueRender();
    return;
  }
  if (chunk >= " " && chunk !== "\x7f") {
    state.command += chunk;
    queueRender();
  }
}

async function runConsoleCommand(input) {
  appendLog("cmd", `:${input}`, "cmd");
  const [command, ...args] = splitArgs(input);

  switch (command) {
    case "help":
      showHelp();
      return;
    case "start":
      if (args[0] === "pb") startService("pb");
      else if (args[0] === "vite") startService("vite");
      else startAll();
      return;
    case "stop":
      if (args[0] === "pb") await stopService("pb");
      else if (args[0] === "vite") await stopService("vite");
      else await stopAll();
      return;
    case "restart":
      if (args[0] === "pb") await restartService("pb");
      else if (args[0] === "vite") await restartService("vite");
      else await restartAll();
      return;
    case "open":
      await openTarget(args[0] || "app");
      return;
    case "clear":
      state.logs = [];
      appendLog("tui", "logs cleared");
      return;
    case "status":
      logStatus();
      return;
    case "seed":
      runOneShot("cmd", npmBinary(), ["run", "seed"], FRONTEND_DIR);
      return;
    case "check-rules":
      runOneShot("cmd", npmBinary(), ["run", "check-rules"], FRONTEND_DIR);
      return;
    case "migrate":
      runPocketBaseCommand(["migrate", ...args]);
      return;
    case "superuser":
      runPocketBaseCommand(["superuser", ...args]);
      return;
    case "pb":
    case "pocketbase":
      runPocketBaseCommand(args);
      return;
    case "npm":
      runOneShot("cmd", npmBinary(), args, FRONTEND_DIR);
      return;
    case "collections":
      await listCollections();
      return;
    case "collection":
      await showCollection(args[0]);
      return;
    case "set-rule":
      await setCollectionRule(args);
      return;
    case "quit":
    case "exit":
      await shutdown();
      return;
    default:
      appendLog("cmd", `unknown command: ${command}. Try :help`, "warn");
  }
}

function runPocketBaseCommand(args) {
  const binary = resolvePocketBaseBinary();
  if (!binary) {
    appendLog("cmd", "PocketBase binary not found. Set PB_BINARY or add backend/pocketbase(.exe).", "error");
    return;
  }
  runOneShot("cmd", binary, args, BACKEND_DIR, {
    ...process.env,
    ...loadBackendEnv(),
  });
}

function showHelp() {
  const lines = [
    "keys: s start both | x stop both | r restart both | b restart PB | v restart Vite | 1 all logs | 2 PB | 3 Vite | 4 commands | c clear | q quit",
    "prompt: :start [pb|vite], :stop [pb|vite], :restart [pb|vite], :open [app|pb|admin], :status",
    "pocketbase: :pb <args>, :migrate up|down|create|collections, :superuser upsert <email> <password>",
    "admin API (requires PB_SUPERUSER_EMAIL/PB_SUPERUSER_PASSWORD or PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD): :collections, :collection <name>, :set-rule <collection> <ruleName> <rule|null>",
    "frontend: :npm <args>, :seed, :check-rules",
    "macOS note: install a macOS PocketBase binary at backend/pocketbase or launch with PB_BINARY=/path/to/pocketbase.",
  ];
  for (const line of lines) appendLog("tui", line);
}

function logStatus() {
  for (const service of Object.values(state.services)) {
    appendLog(
      "tui",
      `${service.label}: ${service.status}, pid=${service.child?.pid || "-"}, http=${service.http}, uptime=${formatDuration(uptimeMs(service))}`,
    );
  }
}

async function openTarget(target) {
  const url =
    target === "pb" || target === "admin"
      ? `${PB_URL}/_/`
      : target === "api"
        ? `${PB_URL}/api/health`
        : VITE_URL;
  const opener =
    process.platform === "win32"
      ? ["cmd.exe", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  appendLog("cmd", `opening ${url}`);
  await execFileSafe(opener[0], opener[1]);
}

async function listCollections() {
  const token = await getSuperuserToken();
  if (!token) return;
  const response = await pbFetch("/api/collections?perPage=200", { token });
  if (!response) return;
  for (const item of response.items || []) {
    appendLog("cmd", `${item.name} (${item.type}) id=${item.id}`);
  }
}

async function showCollection(name) {
  if (!name) {
    appendLog("cmd", "usage: :collection <name>", "warn");
    return;
  }
  const token = await getSuperuserToken();
  if (!token) return;
  const data = await pbFetch(`/api/collections/${encodeURIComponent(name)}`, { token });
  if (!data) return;
  appendLog("cmd", JSON.stringify({
    id: data.id,
    name: data.name,
    type: data.type,
    listRule: data.listRule,
    viewRule: data.viewRule,
    createRule: data.createRule,
    updateRule: data.updateRule,
    deleteRule: data.deleteRule,
    fields: (data.fields || []).map((field) => `${field.name}:${field.type}`),
  }, null, 2));
}

async function setCollectionRule(args) {
  const [collection, ruleName, ...ruleParts] = args;
  const validRules = new Set(["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]);
  if (!collection || !validRules.has(ruleName) || ruleParts.length === 0) {
    appendLog(
      "cmd",
      "usage: :set-rule <collection> <listRule|viewRule|createRule|updateRule|deleteRule> <rule|null>",
      "warn",
    );
    return;
  }
  const token = await getSuperuserToken();
  if (!token) return;
  const ruleRaw = ruleParts.join(" ");
  const rule = ruleRaw === "null" ? null : ruleRaw;
  const data = await pbFetch(`/api/collections/${encodeURIComponent(collection)}`, {
    method: "PATCH",
    token,
    body: { [ruleName]: rule },
  });
  if (data) appendLog("cmd", `updated ${collection}.${ruleName}=${ruleRaw}`);
}

async function getSuperuserToken() {
  const identity =
    process.env.PB_SUPERUSER_EMAIL ||
    process.env.PB_ADMIN_EMAIL ||
    loadBackendEnv().PB_SUPERUSER_EMAIL ||
    loadBackendEnv().PB_ADMIN_EMAIL;
  const password =
    process.env.PB_SUPERUSER_PASSWORD ||
    process.env.PB_ADMIN_PASSWORD ||
    loadBackendEnv().PB_SUPERUSER_PASSWORD ||
    loadBackendEnv().PB_ADMIN_PASSWORD;
  if (!identity || !password) {
    appendLog(
      "cmd",
      "Set PB_SUPERUSER_EMAIL/PB_SUPERUSER_PASSWORD in your environment or backend/.env to use admin API edit commands.",
      "warn",
    );
    return null;
  }
  const data = await pbFetch("/api/collections/_superusers/auth-with-password", {
    method: "POST",
    body: { identity, password },
    quietAuth: true,
  });
  return data?.token || null;
}

async function pbFetch(route, { method = "GET", token, body, quietAuth = false } = {}) {
  try {
    const response = await fetch(`${PB_URL}${route}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      appendLog(
        "cmd",
        `PocketBase API ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
        quietAuth ? "warn" : "error",
      );
      return null;
    }
    return data;
  } catch (err) {
    appendLog("cmd", `PocketBase API error: ${err.message}`, "error");
    return null;
  }
}

async function refreshStats() {
  state.lastStatsAt = Date.now();
  await Promise.all(
    Object.values(state.services).map(async (service) => {
      service.http = await probeHttp(service.url);
      if (service.child?.pid) {
        service.pidStats = await getPidStats(service.child.pid);
      } else {
        service.pidStats = null;
      }
    }),
  );
  queueRender();
}

async function probeHttp(url) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 900);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return `${response.status} ${Date.now() - start}ms`;
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

async function getPidStats(pid) {
  if (!pid) return null;
  try {
    if (process.platform === "win32") {
      const command = `Get-Process -Id ${Number(pid)} | Select-Object Id,CPU,WorkingSet64,StartTime | ConvertTo-Json -Compress`;
      const { stdout } = await execFileSafe("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        command,
      ]);
      const parsed = JSON.parse(stdout || "{}");
      return {
        cpu: parsed.CPU == null ? null : `${Number(parsed.CPU).toFixed(1)}s`,
        memory: parsed.WorkingSet64 ? formatBytes(Number(parsed.WorkingSet64)) : null,
      };
    }
    const { stdout } = await execFileSafe("ps", ["-p", String(pid), "-o", "%cpu=,rss=,etime="]);
    const parts = stdout.trim().split(/\s+/);
    if (parts.length < 3) return null;
    return {
      cpu: `${Number(parts[0]).toFixed(1)}%`,
      memory: formatBytes(Number(parts[1]) * 1024),
      etime: parts.slice(2).join(" "),
    };
  } catch {
    return null;
  }
}

function execFileSafe(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, stdout: stdout || "", stderr: stderr || error.message });
      } else {
        resolve({ ok: true, stdout: stdout || "", stderr: stderr || "" });
      }
    });
  });
}

function appendLog(source, line, level = "info") {
  const text = String(line).replace(/\r/g, "");
  for (const part of text.split("\n")) {
    if (!part) continue;
    state.logs.push({
      source,
      level,
      text: part,
      time: new Date(),
    });
  }
  if (state.logs.length > MAX_LOGS) {
    state.logs.splice(0, state.logs.length - MAX_LOGS);
  }
  queueRender();
}

function setMessage(message) {
  state.message = message;
  appendLog("tui", message);
}

function queueRender() {
  if (state.renderQueued) return;
  state.renderQueued = true;
  setTimeout(() => {
    state.renderQueued = false;
    render();
  }, 16);
}

function render() {
  const width = Math.max(80, process.stdout.columns || 100);
  const height = Math.max(24, process.stdout.rows || 32);
  const lines = [];

  lines.push(
    line(
      `${colors.bold}Converge Dev Console${colors.reset} ${colors.dim}${new Date().toLocaleTimeString()}${colors.reset}`,
      width,
    ),
  );
  lines.push(
    line(
      "s start  x stop  r restart  b PB  v Vite  1 all  2 PB  3 Vite  4 cmd  : command  ? help  q quit",
      width,
      colors.dim,
    ),
  );
  lines.push(rule(width));

  lines.push(serviceLine(state.services.pb, width));
  lines.push(serviceLine(state.services.vite, width));
  lines.push(
    line(
      `System  load ${os.loadavg().map((v) => v.toFixed(2)).join(" ")}  memory ${formatBytes(os.totalmem() - os.freemem())}/${formatBytes(os.totalmem())}  platform ${process.platform}`,
      width,
      colors.gray,
    ),
  );
  lines.push(rule(width));

  const logHeight = height - lines.length - 3;
  const shown = filteredLogs();
  const start = Math.max(0, shown.length - logHeight - state.viewOffset);
  const end = Math.max(start, shown.length - state.viewOffset);
  for (const entry of shown.slice(start, end)) {
    lines.push(formatLog(entry, width));
  }
  while (lines.length < height - 2) lines.push(" ".repeat(width));

  lines.push(rule(width));
  if (state.commandMode) {
    lines.push(line(`:${state.command}${colors.inverse} ${colors.reset}`, width, colors.cyan));
  } else {
    lines.push(line(state.message, width, colors.dim));
  }

  process.stdout.write(`\x1b[H${lines.slice(0, height).join("\n")}`);
}

function serviceLine(service, width) {
  const statusColor =
    service.status === "running"
      ? colors.green
      : service.status === "starting"
        ? colors.yellow
        : service.status === "error" || service.status === "exited"
          ? colors.red
          : colors.gray;
  const pid = service.child?.pid || "-";
  const stats = service.pidStats || {};
  const text = `${service.label.padEnd(10)} ${statusColor}${service.status.padEnd(9)}${colors.reset} pid ${String(pid).padEnd(7)} http ${String(service.http).padEnd(10)} uptime ${formatDuration(uptimeMs(service)).padEnd(9)} mem ${String(stats.memory || "-").padEnd(9)} cpu ${String(stats.cpu || "-").padEnd(7)} starts ${service.starts} restarts ${service.restarts}`;
  return line(text, width);
}

function filteredLogs() {
  if (state.filter === "all") return state.logs;
  if (state.filter === "cmd") {
    return state.logs.filter((entry) => entry.source === "cmd" || entry.source === "tui");
  }
  return state.logs.filter((entry) => entry.source === state.filter);
}

function formatLog(entry, width) {
  const time = entry.time.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const sourceColor =
    entry.source === "pb"
      ? colors.green
      : entry.source === "vite"
        ? colors.cyan
        : entry.source === "cmd"
          ? colors.magenta
          : colors.gray;
  const levelColor =
    entry.level === "error"
      ? colors.red
      : entry.level === "warn"
        ? colors.yellow
        : entry.level === "cmd"
          ? colors.magenta
          : colors.reset;
  return line(
    `${colors.gray}${time}${colors.reset} ${sourceColor}${entry.source.padEnd(4)}${colors.reset} ${levelColor}${entry.text}${colors.reset}`,
    width,
  );
}

function line(value, width, color = "") {
  const raw = stripAnsi(String(value));
  const padded =
    raw.length > width
      ? truncateAnsi(String(value), width)
      : `${String(value)}${" ".repeat(width - raw.length)}`;
  return color ? `${color}${padded}${colors.reset}` : padded;
}

function rule(width) {
  return `${colors.gray}${"─".repeat(width)}${colors.reset}`;
}

function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
}

function truncateAnsi(value, width) {
  let out = "";
  let visible = 0;
  for (let i = 0; i < value.length && visible < width - 1; i += 1) {
    if (value[i] === "\x1b") {
      const match = value.slice(i).match(/^\x1b\[[0-9;?]*[A-Za-z]/);
      if (match) {
        out += match[0];
        i += match[0].length - 1;
        continue;
      }
    }
    out += value[i];
    visible += 1;
  }
  return `${out}…${colors.reset}`;
}

function uptimeMs(service) {
  if (!service.startedAt || !service.child) return 0;
  return Date.now() - service.startedAt;
}

function formatDuration(ms) {
  if (!ms) return "0s";
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h${m}m`;
  if (m) return `${m}m${s}s`;
  return `${s}s`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)}${units[index]}`;
}

function splitArgs(input) {
  const result = [];
  let current = "";
  let quote = null;
  let escape = false;
  for (const char of input) {
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        result.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) result.push(current);
  return result;
}

async function shutdown(exitCode = 0) {
  if (state.quitting) return;
  state.quitting = true;
  state.message = "Stopping services...";
  render();
  await stopAll();
  setTimeout(() => {
    process.stdout.write("\x1b[?25h\x1b[?1049l");
    process.exit(exitCode);
  }, 350);
}

main();
