import * as path from 'path';
import { logger } from '../utils/logger';
import { scanLocalProject, LocalScanResult } from './localProjectScanner';
import { scanGitRepo, GitScanResult } from './githubScanner';
import { scanSecrets, SecretFinding } from './secretScanner';

export interface SourceHealthResult {
  projectName: string;
  projectPath: string;
  local: LocalScanResult;
  git: GitScanResult;
  secrets: SecretFinding[];
  healthScore: number;
  healthLabel: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  issues: string[];
}

export async function runSourceHealthScan(
  projectName: string,
  projectPath: string
): Promise<SourceHealthResult> {
  logger.step(projectName, 'Source health scan');

  const [local, git, secrets] = await Promise.all([
    scanLocalProject(projectPath),
    scanGitRepo(projectPath),
    scanSecrets(projectPath),
  ]);

  const issues: string[] = [
    ...local.warnings,
    ...git.warnings,
    ...secrets.map((s) => `[${s.severity}] ${s.pattern} in ${s.file}:${s.line}`),
  ];

  let score = 100;
  if (!local.exists) score -= 50;
  if (!local.hasPackageJson) score -= 10;
  if (!local.hasNodeModules) score -= 5;
  if (!local.hasBuildOutput) score -= 5;
  if (local.hasEnvFile) score -= 15;
  if (!git.hasGitDir) score -= 10;
  if (!git.isClean) score -= 5;
  if (git.aheadCount > 0) score -= 5;
  for (const s of secrets) {
    if (s.severity === 'CRITICAL') score -= 20;
    else if (s.severity === 'HIGH') score -= 10;
    else score -= 5;
  }
  score = Math.max(0, score);

  let healthLabel: SourceHealthResult['healthLabel'] = 'HEALTHY';
  if (score < 80) healthLabel = 'WARNING';
  if (score < 50) healthLabel = 'CRITICAL';

  logger.info(`${projectName} source health: ${healthLabel} (${score}/100)`);
  return { projectName, projectPath, local, git, secrets, healthScore: score, healthLabel, issues };
}
