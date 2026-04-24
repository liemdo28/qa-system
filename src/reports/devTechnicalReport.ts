import * as path from 'path';
import { writeText } from '../utils/fileUtils';
import { maskText } from '../security/credentialMasker';
import { logger } from '../utils/logger';
import { QARunData } from './jsonReport';
import { UIIssue } from '../runner/uiRunner';
import { SecretFinding } from '../scanner/secretScanner';

function severityRank(s: string): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }[s] ?? 5;
}

export function writeDevTechnicalReport(runDir: string, data: QARunData): string {
  const filePath = path.join(runDir, 'dev-report.md');
  const lines: string[] = [];

  lines.push(`# Dev QA Technical Report`);
  lines.push(``);
  lines.push(`**Run ID:** ${data.runId}`);
  lines.push(`**Date:** ${data.startedAt}`);
  lines.push(`**Completed:** ${data.completedAt}`);
  lines.push(`**Environment:** ${data.environment}`);
  lines.push(`**Safe Mode:** ${data.safeMode}`);
  lines.push(``);
  lines.push(`---`);

  for (const project of data.projects) {
    const source = project.source as {
      healthLabel?: string; healthScore?: number; issues?: string[];
      git?: { currentBranch?: string; lastCommitHash?: string; lastCommitMessage?: string; lastCommitDate?: string };
      local?: { detectedFramework?: string; hasBuildOutput?: boolean };
      secrets?: SecretFinding[];
    } | undefined;

    const build = project.build as {
      overallSuccess?: boolean; installSuccess?: boolean; buildSuccess?: boolean; testSuccess?: boolean;
      totalDurationMs?: number; errors?: string[];
      commands?: Array<{ command: string; result: { success: boolean; exitCode: number; stderr: string; durationMs: number } }>;
    } | undefined;

    const ui = project.ui as { issues?: UIIssue[]; pagesChecked?: number; durationMs?: number } | undefined;
    const api = project.api as { checks?: Array<{ endpoint: string; statusCode: number | null; reachable: boolean; responseTimeMs: number; error: string | null }>; passCount?: number; failCount?: number } | undefined;
    const stress = project.stress as { totalRequests?: number; successCount?: number; failCount?: number; avgResponseMs?: number; maxResponseMs?: number; errorRate?: number; requestsPerSecond?: number; durationMs?: number; safeMode?: boolean } | undefined;
    const roles = project.roles as Array<{ role: string; loginAttempted: boolean; loginSuccess: boolean; dashboardAccessible: boolean; permissionIssues: string[]; issues: UIIssue[] }> | undefined;

    lines.push(`\n## Project: ${project.name}`);
    lines.push(``);
    lines.push(`- **Type:** ${project.type}`);
    lines.push(`- **Local Path:** \`${project.localPath}\``);
    lines.push(`- **GitHub:** ${project.github}`);

    if (source?.git) {
      lines.push(`- **Branch:** ${source.git.currentBranch}`);
      lines.push(`- **Commit:** ${source.git.lastCommitHash} — ${source.git.lastCommitMessage}`);
      lines.push(`- **Commit Date:** ${source.git.lastCommitDate}`);
    }
    if (source?.local) {
      lines.push(`- **Framework:** ${source.local.detectedFramework}`);
      lines.push(`- **Has Build Output:** ${source.local.hasBuildOutput}`);
    }

    lines.push(``);
    lines.push(`### Source Health`);
    lines.push(``);
    lines.push(`**Score:** ${source?.healthScore ?? 'N/A'}/100 — **${source?.healthLabel ?? 'SKIP'}**`);
    if (source?.issues?.length) {
      lines.push(`\n**Issues:**`);
      for (const issue of source.issues) {
        lines.push(`- ${issue}`);
      }
    }

    if (source?.secrets?.length) {
      lines.push(``);
      lines.push(`### Security Findings`);
      lines.push(``);
      const sorted = [...source.secrets].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
      for (const s of sorted) {
        lines.push(`- **[${s.severity}]** ${s.pattern}`);
        lines.push(`  - File: \`${s.file}\` line ${s.line}`);
        lines.push(`  - Value: \`${s.maskedValue}\``);
      }
    }

    if (build) {
      lines.push(``);
      lines.push(`### Build Result`);
      lines.push(``);
      lines.push(`| Step | Status | Duration |`);
      lines.push(`|------|--------|----------|`);
      lines.push(`| Install | ${build.installSuccess ? 'PASS' : 'FAIL'} | - |`);
      lines.push(`| Build | ${build.buildSuccess ? 'PASS' : 'FAIL'} | ${build.totalDurationMs}ms |`);
      lines.push(`| Test | ${build.testSuccess ? 'PASS' : 'FAIL'} | - |`);

      if (build.errors?.length) {
        lines.push(`\n**Build Errors:**`);
        for (const err of build.errors) {
          lines.push(`\`\`\`\n${err}\n\`\`\``);
        }
      }
    }

    if (ui?.issues?.length) {
      lines.push(``);
      lines.push(`### UI Issues (${ui.issues.length})`);
      lines.push(``);
      const sorted = [...ui.issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
      sorted.forEach((issue, i) => {
        lines.push(`#### Issue ${i + 1}: ${issue.step}`);
        lines.push(`- **Page:** ${issue.pageUrl}`);
        lines.push(`- **Role:** ${issue.role}`);
        lines.push(`- **Severity:** ${issue.severity}`);
        lines.push(`- **Expected:** ${issue.expected}`);
        lines.push(`- **Actual:** ${issue.actual}`);
        if (issue.screenshotPath) lines.push(`- **Screenshot:** \`${issue.screenshotPath}\``);
        if (issue.videoPath) lines.push(`- **Video:** \`${issue.videoPath}\``);
        if (issue.consoleErrors.length) lines.push(`- **Console Errors:** ${issue.consoleErrors.slice(0, 3).join('; ')}`);
        if (issue.networkErrors.length) lines.push(`- **Network Errors:** ${issue.networkErrors.slice(0, 3).join('; ')}`);
        lines.push(`- **Suggested Fix:** ${issue.suggestedFix}`);
        lines.push(``);
      });
    }

    if (api) {
      lines.push(``);
      lines.push(`### API Results`);
      lines.push(``);
      lines.push(`| Endpoint | Status | Reachable | Response Time |`);
      lines.push(`|----------|--------|-----------|---------------|`);
      for (const check of api.checks ?? []) {
        lines.push(`| ${check.endpoint} | ${check.statusCode ?? 'ERR'} | ${check.reachable} | ${check.responseTimeMs}ms |`);
      }
    }

    if (stress) {
      lines.push(``);
      lines.push(`### Stress Test Results`);
      lines.push(``);
      lines.push(`| Metric | Value |`);
      lines.push(`|--------|-------|`);
      lines.push(`| Total Requests | ${stress.totalRequests} |`);
      lines.push(`| Success | ${stress.successCount} |`);
      lines.push(`| Failed | ${stress.failCount} |`);
      lines.push(`| Avg Response | ${stress.avgResponseMs}ms |`);
      lines.push(`| Max Response | ${stress.maxResponseMs}ms |`);
      lines.push(`| Error Rate | ${stress.errorRate}% |`);
      lines.push(`| Req/Sec | ${stress.requestsPerSecond} |`);
      lines.push(`| Safe Mode | ${stress.safeMode} |`);
    }

    if (roles?.length) {
      lines.push(``);
      lines.push(`### Role Tests`);
      lines.push(``);
      lines.push(`| Role | Login | Dashboard | Permission Issues |`);
      lines.push(`|------|-------|-----------|-------------------|`);
      for (const r of roles) {
        lines.push(`| ${r.role} | ${r.loginAttempted ? (r.loginSuccess ? 'PASS' : 'FAIL') : 'SKIP'} | ${r.dashboardAccessible ? 'YES' : 'NO'} | ${r.permissionIssues.length} |`);
      }
      for (const r of roles) {
        if (r.issues.length > 0) {
          lines.push(`\n**${r.role} issues:**`);
          for (const issue of r.issues) {
            lines.push(`- [${issue.severity}] ${issue.step}: ${issue.actual}`);
          }
        }
      }
    }

    lines.push(``);
    lines.push(`---`);
  }

  // Fix priority
  lines.push(``);
  lines.push(`## Recommended Fix Order`);
  lines.push(``);
  let fixNum = 1;
  for (const project of data.projects) {
    const secrets = (project.source as { secrets?: SecretFinding[] } | undefined)?.secrets ?? [];
    if (secrets.some((s) => s.severity === 'CRITICAL')) {
      lines.push(`${fixNum++}. **CRITICAL — ${project.name}:** Remove committed secrets immediately`);
    }
  }
  for (const project of data.projects) {
    const build = project.build as { overallSuccess?: boolean } | undefined;
    if (build?.overallSuccess === false) {
      lines.push(`${fixNum++}. **HIGH — ${project.name}:** Fix build failure before next deploy`);
    }
  }
  for (const project of data.projects) {
    const ui = project.ui as { issues?: UIIssue[] } | undefined;
    const criticalUi = ui?.issues?.filter((i) => i.severity === 'CRITICAL') ?? [];
    if (criticalUi.length > 0) {
      lines.push(`${fixNum++}. **HIGH — ${project.name}:** Fix ${criticalUi.length} critical UI issue(s)`);
    }
  }
  if (fixNum === 1) {
    lines.push(`_No urgent fixes required._`);
  }

  lines.push(``);
  lines.push(`_Report generated by Internal QA System_`);

  const content = maskText(lines.join('\n') + '\n');
  writeText(filePath, content);
  logger.success(`Dev report: ${filePath}`);
  return filePath;
}
