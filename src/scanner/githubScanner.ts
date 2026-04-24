import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs-extra';
import { logger } from '../utils/logger';

export interface GitScanResult {
  hasGitDir: boolean;
  currentBranch: string;
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitDate: string;
  uncommittedChanges: number;
  untrackedFiles: string[];
  aheadCount: number;
  behindCount: number;
  remoteUrl: string;
  isClean: boolean;
  warnings: string[];
}

export async function scanGitRepo(projectPath: string): Promise<GitScanResult> {
  const result: GitScanResult = {
    hasGitDir: false,
    currentBranch: '',
    lastCommitHash: '',
    lastCommitMessage: '',
    lastCommitDate: '',
    uncommittedChanges: 0,
    untrackedFiles: [],
    aheadCount: 0,
    behindCount: 0,
    remoteUrl: '',
    isClean: true,
    warnings: [],
  };

  if (!fs.pathExistsSync(projectPath)) {
    result.warnings.push('Project path not found');
    return result;
  }

  if (!fs.pathExistsSync(`${projectPath}/.git`)) {
    result.warnings.push('No .git directory found');
    return result;
  }

  result.hasGitDir = true;
  const git: SimpleGit = simpleGit(projectPath);

  try {
    const status = await git.status();
    result.currentBranch = status.current || 'unknown';
    result.uncommittedChanges = status.files.length;
    result.untrackedFiles = status.not_added || [];
    result.aheadCount = status.ahead;
    result.behindCount = status.behind;
    result.isClean = status.isClean();

    if (!result.isClean) {
      result.warnings.push(`${result.uncommittedChanges} uncommitted change(s)`);
    }
    if (result.aheadCount > 0) {
      result.warnings.push(`${result.aheadCount} commit(s) ahead of remote — not pushed`);
    }
    if (result.behindCount > 0) {
      result.warnings.push(`${result.behindCount} commit(s) behind remote — needs pull`);
    }
  } catch (e) {
    result.warnings.push(`Git status failed: ${String(e)}`);
  }

  try {
    const log = await git.log({ maxCount: 1 });
    const latest = log.latest;
    if (latest) {
      result.lastCommitHash = latest.hash.substring(0, 8);
      result.lastCommitMessage = latest.message;
      result.lastCommitDate = latest.date;
    }
  } catch {
    result.warnings.push('Could not read git log');
  }

  try {
    const remotes = await git.getRemotes(true);
    const origin = remotes.find((r) => r.name === 'origin');
    result.remoteUrl = origin?.refs?.fetch || '';
  } catch {
    result.warnings.push('Could not read remote URL');
  }

  logger.success(`Git scan: ${result.currentBranch} @ ${result.lastCommitHash}`);
  return result;
}
