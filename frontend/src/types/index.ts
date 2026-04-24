export type CheckStatus = 'pass' | 'fail' | 'warning' | 'skip';
export type RunStatus = 'pass' | 'fail' | 'warning' | 'running';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueType =
  | 'broken_link'
  | 'console_error'
  | 'seo_missing'
  | 'performance_slow'
  | 'build_error';

export interface QAIssue {
  type: IssueType;
  url?: string;
  message: string;
  severity: IssueSeverity;
}

export interface QASummary {
  build: CheckStatus;
  links: CheckStatus;
  seo: CheckStatus;
  performance: CheckStatus;
}

export interface QAMetrics {
  buildTimeMs?: number;
  buildDetectedType?: string;
  buildSkipReason?: string;
  loadTimeMs?: number;
  linksChecked?: number;
  brokenLinksCount?: number;
}

export interface QAResult {
  projectId: string;
  projectName: string;
  runId: string;
  status: RunStatus;
  summary: QASummary;
  issues: QAIssue[];
  metrics: QAMetrics;
  timestamp: string;
  completedAt?: string;
}

export interface ProjectCommands {
  install?: string;
  build?: string;
  start?: string;
  test?: string;
}

export interface ProjectBuildConfig {
  enabled?: boolean;
}

export interface ServiceCommand {
  name: string;
  cwd: string;
  command: string;
  url?: string;
}

export interface Project {
  id: string;
  name: string;
  repo?: string;
  github?: string;
  localPath?: string;
  type: string;
  enabled?: boolean;
  commands?: ProjectCommands;
  build?: ProjectBuildConfig;
  services?: ServiceCommand[];
  url?: string;
  publicUrl?: string;
}

// ─── System management types ──────────────────────────────────────────────────

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

export interface LogEntry {
  runId: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export type WSMessage =
  | { type: 'connected'; message: string }
  | { type: 'log'; runId: string; level: LogEntry['level']; message: string; timestamp: string }
  | { type: 'result'; runId: string; projectId: string; data: QAResult }
  | { type: 'system_status'; services: ManagedService[] }
  | { type: 'system_progress'; step: number; total: number; message: string };
