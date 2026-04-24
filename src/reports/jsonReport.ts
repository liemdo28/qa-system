import * as path from 'path';
import { writeJson } from '../utils/fileUtils';
import { maskObject } from '../security/credentialMasker';
import { logger } from '../utils/logger';

export interface QARunData {
  runId: string;
  startedAt: string;
  completedAt: string;
  environment: string;
  safeMode: boolean;
  projects: ProjectQAData[];
}

export interface ProjectQAData {
  name: string;
  localPath: string;
  github: string;
  type: string;
  source?: unknown;
  build?: unknown;
  ui?: unknown;
  api?: unknown;
  stress?: unknown;
  roles?: unknown;
}

export function writeJsonReport(runDir: string, data: QARunData): string {
  const filePath = path.join(runDir, 'raw-results.json');
  const masked = maskObject(data as unknown as Record<string, unknown>);
  writeJson(filePath, masked);
  logger.success(`JSON report: ${filePath}`);
  return filePath;
}
