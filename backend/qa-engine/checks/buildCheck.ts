import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { CheckStatus, QAIssue, Project } from '../types';

export interface BuildCheckResult {
  status: CheckStatus;
  buildTimeMs: number;
  installSuccess: boolean;
  buildSuccess: boolean;
  detectedType?: string;
  skipReason?: string;
  issues: QAIssue[];
}

export type ProjectBuildType = 'node' | 'php' | 'python' | 'static' | 'unknown';

export function detectBuildType(localPath: string): ProjectBuildType {
  if (fs.existsSync(path.join(localPath, 'package.json')))    return 'node';
  if (fs.existsSync(path.join(localPath, 'composer.json')))   return 'php';
  if (fs.existsSync(path.join(localPath, 'requirements.txt')) ||
      fs.existsSync(path.join(localPath, 'pyproject.toml')))  return 'python';
  if (fs.existsSync(path.join(localPath, 'index.html')))      return 'static';
  return 'unknown';
}

const SKIP_REASON: Record<string, string> = {
  php:     'PHP/Laravel project (composer.json) — no Node build required',
  python:  'Python project (requirements.txt/pyproject.toml) — no Node build required',
  static:  'Static site (index.html, no package.json) — no Node build required',
  unknown: 'No package.json found — skipping Node build',
};

function runCmd(cmd: string, cwd: string, timeoutMs = 120000): { success: boolean; output: string } {
  try {
    const stdout = execSync(cmd, { cwd, timeout: timeoutMs, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: stdout || '' };
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    return { success: false, output: err.stderr || err.message || '' };
  }
}

export async function runBuildCheck(
  project: Project,
  emit: (level: string, msg: string) => void
): Promise<BuildCheckResult> {
  const issues: QAIssue[] = [];
  const start = Date.now();

  // Explicit opt-out via config
  if (project.build?.enabled === false) {
    const reason = 'Build disabled in project config';
    emit('info', `Skipped — ${reason}`);
    return { status: 'skip', buildTimeMs: 0, installSuccess: false, buildSuccess: false, skipReason: reason, issues };
  }

  const localPath = project.localPath;
  if (!localPath || !fs.existsSync(localPath)) {
    const reason = 'Local path not configured or does not exist';
    emit('warn', `Skipped — ${reason}`);
    return { status: 'skip', buildTimeMs: 0, installSuccess: false, buildSuccess: false, skipReason: reason, issues };
  }

  // Auto-detect project type from filesystem
  const detectedType = detectBuildType(localPath);

  if (detectedType !== 'node') {
    const reason = SKIP_REASON[detectedType] ?? 'No Node build required';
    emit('info', `Skipped — ${reason}`);
    return {
      status: 'skip',
      buildTimeMs: 0,
      installSuccess: false,
      buildSuccess: false,
      detectedType,
      skipReason: reason,
      issues,
    };
  }

  // Node project — run install then build
  const installCmd = project.commands?.install ?? 'npm install';
  const buildCmd   = project.commands?.build   ?? null;

  emit('info', `Detected: Node.js project`);
  emit('info', `Installing dependencies: ${installCmd}`);
  const installResult = runCmd(installCmd, localPath);

  if (!installResult.success) {
    emit('error', `Install failed: ${installResult.output.substring(0, 300)}`);
    issues.push({
      type: 'build_error',
      message: `npm install failed: ${installResult.output.substring(0, 200)}`,
      severity: 'critical',
    });
    return {
      status: 'fail',
      buildTimeMs: Date.now() - start,
      installSuccess: false,
      buildSuccess: false,
      detectedType,
      issues,
    };
  }

  emit('success', 'Install complete');

  if (!buildCmd) {
    return { status: 'pass', buildTimeMs: Date.now() - start, installSuccess: true, buildSuccess: true, detectedType, issues };
  }

  emit('info', `Building: ${buildCmd}`);
  const buildResult = runCmd(buildCmd, localPath, 180000);

  if (!buildResult.success) {
    emit('error', `Build failed: ${buildResult.output.substring(0, 300)}`);
    issues.push({
      type: 'build_error',
      message: `Build failed: ${buildResult.output.substring(0, 200)}`,
      severity: 'critical',
    });
    return {
      status: 'fail',
      buildTimeMs: Date.now() - start,
      installSuccess: true,
      buildSuccess: false,
      detectedType,
      issues,
    };
  }

  const buildTimeMs = Date.now() - start;
  emit('success', `Build complete (${buildTimeMs}ms)`);
  return { status: 'pass', buildTimeMs, installSuccess: true, buildSuccess: true, detectedType, issues };
}
