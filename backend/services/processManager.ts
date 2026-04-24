import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface StartCommand {
  name: string;
  cwd: string;
  command: string;
  url?: string;
}

export type ServiceStatus = 'starting' | 'running' | 'failed' | 'stopped';

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

export function makeServiceId(projectId: string, index: number): string {
  return `${projectId}::${index}`;
}

function getLogPath(projectId: string): string {
  const logsDir = path.join(process.cwd(), 'logs');
  fs.ensureDirSync(logsDir);
  return path.join(logsDir, `${projectId}.log`);
}

function appendLog(svc: InternalService, line: string): void {
  svc.logLines.push(line);
  if (svc.logLines.length > 500) svc.logLines.shift();
  try {
    fs.appendFileSync(getLogPath(svc.projectId), `[${new Date().toISOString()}] ${line}\n`);
  } catch { /* ignore file write errors */ }
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

export function startService(
  projectId: string,
  projectName: string,
  cmd: StartCommand,
  index: number,
  onChange: () => void
): ManagedService {
  const id = makeServiceId(projectId, index);

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
  appendLog(svc, `[launcher] ${cmd.command} in ${cmd.cwd}`);

  try {
    const proc = spawn(cmd.command, [], {
      cwd: cmd.cwd,
      shell: true,
      windowsHide: false,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    svc.proc = proc;
    svc.pid = proc.pid;

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
    proc.stderr?.on('data', handleOutput); // Vite/webpack write to stderr too

    proc.on('error', (err) => {
      svc.status = 'failed';
      svc.error = err.message;
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

    // Assume running after 4s if no crash yet
    setTimeout(() => {
      if (svc.status === 'starting') {
        svc.status = 'running';
        onChange();
      }
    }, 4000);
  } catch (e) {
    svc.status = 'failed';
    svc.error = String(e);
    appendLog(svc, `[crash] ${String(e)}`);
    onChange();
  }

  return toPublic(svc);
}

export function stopService(id: string, onChange: () => void): void {
  const svc = registry.get(id);
  if (!svc) return;
  if (svc.pid) killPid(svc.pid);
  svc.proc = undefined;
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
