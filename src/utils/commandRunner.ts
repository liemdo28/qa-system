import { execSync, spawn } from 'child_process';
import { logger } from './logger';

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export function runCommand(
  command: string,
  cwd: string,
  timeoutMs = 120000
): CommandResult {
  const start = Date.now();
  try {
    const stdout = execSync(command, {
      cwd,
      timeout: timeoutMs,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    return {
      success: true,
      stdout: stdout || '',
      stderr: '',
      exitCode: 0,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      status?: number;
    };
    return {
      success: false,
      stdout: e.stdout || '',
      stderr: e.stderr || e.message || '',
      exitCode: e.status ?? 1,
      durationMs: Date.now() - start,
    };
  }
}

export async function runCommandSequential(
  commands: string[],
  cwd: string
): Promise<{ command: string; result: CommandResult }[]> {
  const results: { command: string; result: CommandResult }[] = [];
  for (const cmd of commands) {
    logger.debug(`Running: ${cmd}`);
    const result = runCommand(cmd, cwd);
    results.push({ command: cmd, result });
    if (!result.success) {
      logger.warn(`Command failed: ${cmd}`);
      break;
    }
  }
  return results;
}

export function isPortInUse(port: number): boolean {
  try {
    execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}
