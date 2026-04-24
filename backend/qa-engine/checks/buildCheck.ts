import { execSync } from 'child_process';
import * as fs from 'fs';
import { CheckStatus, QAIssue, Project } from '../types';

export interface BuildCheckResult {
  status: CheckStatus;
  buildTimeMs: number;
  installSuccess: boolean;
  buildSuccess: boolean;
  issues: QAIssue[];
}

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

  const localPath = project.localPath;
  if (!localPath || !fs.existsSync(localPath)) {
    emit('warn', 'No local path — skipping build check');
    return { status: 'skip', buildTimeMs: 0, installSuccess: false, buildSuccess: false, issues };
  }

  // Determine install and build commands
  const installCmd = project.commands?.install ?? (project.buildCommands?.[0] ?? 'npm install');
  const buildCmd = project.commands?.build ?? (project.buildCommands?.[1] ?? null);

  emit('info', `Installing dependencies: ${installCmd}`);
  const installResult = runCmd(installCmd, localPath);
  const installSuccess = installResult.success;

  if (!installSuccess) {
    emit('error', `Install failed: ${installResult.output.substring(0, 300)}`);
    issues.push({
      type: 'build_error',
      message: `npm install failed: ${installResult.output.substring(0, 200)}`,
      severity: 'critical',
    });
  } else {
    emit('success', 'Install complete');
  }

  let buildSuccess = true;
  if (buildCmd && installSuccess) {
    emit('info', `Building: ${buildCmd}`);
    const buildResult = runCmd(buildCmd, localPath, 180000);
    buildSuccess = buildResult.success;

    if (!buildSuccess) {
      emit('error', `Build failed: ${buildResult.output.substring(0, 300)}`);
      issues.push({
        type: 'build_error',
        message: `Build failed: ${buildResult.output.substring(0, 200)}`,
        severity: 'critical',
      });
    } else {
      emit('success', `Build complete (${Date.now() - start}ms)`);
    }
  }

  const buildTimeMs = Date.now() - start;
  let status: CheckStatus = 'pass';
  if (!installSuccess || !buildSuccess) status = 'fail';

  return { status, buildTimeMs, installSuccess, buildSuccess, issues };
}
