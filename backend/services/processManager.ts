import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface ServiceCommand {
  name: string;
  cwd: string;
  command: string;
  url?: string;
}

export type ServiceStatus = 'starting' | 'running' | 'failed' | 'stopped' | 'already_running';

export interface ManagedService {
  id: string;
  projectId: string;
  projectName: string;
  serviceName: string;
  command: string;
  url?: string;
  status: ServiceStatus;
  pid?: number;
  startedAt: string;
  logLines: string[];
  error?: string;
}

interface InternalService extends ManagedService {
  proc?: ChildProcess;
}

const registry = new Map<string, InternalService>();

// ── Helpers ──────────────────────────────────────────────────────────────────

export function makeServiceId(projectId: string, index: number): string {
  return `${projectId}::${index}`;
}

function getLogPath(projectId: string): string {
  const logsDir = path.join(process.cwd(), 'logs');
  fs.ensureDirSync(logsDir);
  return path.join(logsDir, `${projectId}.log`);
}

const SECRET_PATTERN = /(?:api[_-]?key|token|password|secret|pwd|pass|auth|bearer|authorization)\s*[=:]\s*\S+/gi;
const JWT_PATTERN    = /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g;

function maskSecrets(line: string): string {
  return line
    .replace(SECRET_PATTERN, (m) => m.replace(/([=:]\s*)\S+/, '$1[MASKED]'))
    .replace(JWT_PATTERN, 'eyJ[MASKED]');
}

function appendLog(svc: InternalService, raw: string): void {
  const line = maskSecrets(raw);
  svc.logLines.push(line);
  if (svc.logLines.length > 500) svc.logLines.shift();
  try {
    fs.appendFileSync(getLogPath(svc.projectId), `[${new Date().toISOString()}] ${line}\n`);
  } catch { /* ignore file write errors */ }
}

function extractPort(url?: string): number | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.port) return parseInt(parsed.port, 10);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return null;
  }
}

function isPortInUse(port: number): boolean {
  try {
    const cmd = process.platform === 'win32'
      ? `netstat -ano | findstr ":${port} "`
      : `lsof -ti:${port}`;
    const out = execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', timeout: 3000 });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function killPid(pid: number): void {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F /T 2>nul`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch { /* already dead */ }
}

function toPublic(svc: InternalService): ManagedService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { proc: _proc, ...rest } = svc;
  return rest;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startService(
  projectId: string,
  projectName: string,
  cmd: ServiceCommand,
  index: number,
  onChange: () => void
): ManagedService {
  const id = makeServiceId(projectId, index);

  // Return existing running/starting service
  const existing = registry.get(id);
  if (existing?.status === 'running' || existing?.status === 'starting') {
    return toPublic(existing);
  }

  const svc: InternalService = {
    id,
    projectId,
    projectName,
    serviceName: cmd.name,
    command: cmd.command,
    url: cmd.url,
    status: 'starting',
    startedAt: new Date().toISOString(),
    logLines: [],
  };
  registry.set(id, svc);

  // Check if port already occupied
  const port = extractPort(cmd.url);
  if (port && isPortInUse(port)) {
    svc.status = 'already_running';
    appendLog(svc, `[port] Port ${port} already in use — service may already be running`);
    appendLog(svc, `[url] ${cmd.url ?? ''}`);
    onChange();
    return toPublic(svc);
  }

  appendLog(svc, `[launcher] ${cmd.command} in ${cmd.cwd}`);

  try {
    const proc = spawn(cmd.command, [], {
      cwd: cmd.cwd,
      shell: true,
      windowsHide: false,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    svc.proc = proc;
    svc.pid  = proc.pid;

    const handleOutput = (data: Buffer): void => {
      const text = data.toString();
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) appendLog(svc, trimmed);
      }
      if (svc.status === 'starting') {
        svc.status = 'running';
        onChange();
      }
    };

    proc.stdout?.on('data', handleOutput);
    proc.stderr?.on('data', handleOutput);

    proc.on('error', (err) => {
      svc.status = 'failed';
      svc.error  = err.message;
      appendLog(svc, `[error] ${err.message}`);
      onChange();
    });

    proc.on('close', (code) => {
      if (svc.status !== 'stopped') {
        svc.status = code === 0 || code === null ? 'stopped' : 'failed';
        appendLog(svc, `[exit] code ${code ?? 'null'}`);
        onChange();
      }
    });

    // Assume running after 5s if no crash yet
    setTimeout(() => {
      if (svc.status === 'starting') {
        svc.status = 'running';
        onChange();
      }
    }, 5000);
  } catch (e) {
    svc.status = 'failed';
    svc.error  = String(e);
    appendLog(svc, `[crash] ${String(e)}`);
    onChange();
  }

  return toPublic(svc);
}

export function stopService(id: string, onChange: () => void): void {
  const svc = registry.get(id);
  if (!svc) return;
  if (svc.pid) killPid(svc.pid);
  svc.proc   = undefined;
  svc.status = 'stopped';
  appendLog(svc, '[launcher] stopped by user');
  onChange();
}

export function stopAll(onChange: () => void): void {
  for (const [id] of registry) stopService(id, onChange);
}

export function getAllServices(): ManagedService[] {
  return Array.from(registry.values()).map(toPublic);
}

export function getServiceLogs(id: string): string[] {
  return registry.get(id)?.logLines ?? [];
}
