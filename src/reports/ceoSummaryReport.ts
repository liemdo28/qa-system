import * as path from 'path';
import { writeText } from '../utils/fileUtils';
import { maskText } from '../security/credentialMasker';
import { logger } from '../utils/logger';
import { QARunData } from './jsonReport';

function statusEmoji(status: string): string {
  if (status === 'PASS' || status === 'HEALTHY') return 'PASS';
  if (status === 'WARNING') return 'WARNING';
  return 'FAIL';
}

export function writeCeoSummaryReport(runDir: string, data: QARunData): string {
  const filePath = path.join(runDir, 'ceo-summary.md');

  const projectRows = data.projects.map((p) => {
    const source = p.source as { healthLabel?: string; healthScore?: number; issues?: string[] } | undefined;
    const build = p.build as { overallSuccess?: boolean; errors?: string[] } | undefined;
    const ui = p.ui as { issues?: unknown[] } | undefined;
    const stress = p.stress as { errorRate?: number; avgResponseMs?: number } | undefined;
    const roles = p.roles as Array<{ loginSuccess?: boolean; permissionIssues?: string[] }> | undefined;

    const sourceStatus = source?.healthLabel ?? 'SKIP';
    const buildStatus = build?.overallSuccess === undefined ? 'SKIP' : build.overallSuccess ? 'PASS' : 'FAIL';
    const uiIssues = (ui?.issues?.length ?? 0);
    const stressError = stress?.errorRate ?? 0;
    const loginFails = roles ? roles.filter((r) => r.loginSuccess === false).length : 0;

    let overallStatus = 'PASS';
    if (buildStatus === 'FAIL' || sourceStatus === 'CRITICAL' || uiIssues > 5 || stressError > 20) {
      overallStatus = 'FAIL';
    } else if (uiIssues > 0 || sourceStatus === 'WARNING' || loginFails > 0 || stressError > 5) {
      overallStatus = 'WARNING';
    }

    return { name: p.name, overallStatus, sourceStatus, buildStatus, uiIssues, stressError, loginFails, source, build, ui, stress, roles };
  });

  const totalPass = projectRows.filter((p) => p.overallStatus === 'PASS').length;
  const totalWarn = projectRows.filter((p) => p.overallStatus === 'WARNING').length;
  const totalFail = projectRows.filter((p) => p.overallStatus === 'FAIL').length;

  let overallStatus = 'PASS';
  if (totalFail > 0) overallStatus = 'FAIL';
  else if (totalWarn > 0) overallStatus = 'WARNING';

  const criticalIssues: string[] = [];
  const uiProblems: string[] = [];
  const operationRisks: string[] = [];

  for (const p of projectRows) {
    if (p.buildStatus === 'FAIL') {
      const errs = (p.build as { errors?: string[] })?.errors ?? [];
      criticalIssues.push(`**${p.name}** — Build failed: ${errs[0] ?? 'unknown error'}`);
      operationRisks.push(`${p.name} cannot be deployed until build is fixed`);
    }
    if (p.sourceStatus === 'CRITICAL') {
      const secretIssues = (p.source as { secrets?: { pattern: string }[] })?.secrets ?? [];
      if (secretIssues.length > 0) {
        criticalIssues.push(`**${p.name}** — ${secretIssues.length} secret(s) found in source code`);
        operationRisks.push(`${p.name} may have security exposure from committed credentials`);
      }
    }
    if (p.uiIssues > 0) {
      uiProblems.push(`**${p.name}** — ${p.uiIssues} UI issue(s) detected`);
    }
    if (p.stressError > 10) {
      operationRisks.push(`${p.name} stress test: ${p.stressError}% error rate under load`);
    }
    if (p.loginFails > 0) {
      operationRisks.push(`${p.name}: ${p.loginFails} role(s) cannot login`);
    }
  }

  const lines: string[] = [
    `# CEO QA Summary`,
    ``,
    `**Run Date:** ${data.startedAt}`,
    `**Environment:** ${data.environment}`,
    `**Safe Mode:** ${data.safeMode ? 'ENABLED' : 'DISABLED'}`,
    ``,
    `---`,
    ``,
    `## Overall Status`,
    ``,
    `**${overallStatus}** — ${totalPass} project(s) passing, ${totalWarn} warning(s), ${totalFail} failing`,
    ``,
    `---`,
    ``,
    `## Projects Tested`,
    ``,
    `| Project | Status | Source | Build | UI Issues | Stress Error Rate |`,
    `|---------|--------|--------|-------|-----------|-------------------|`,
    ...projectRows.map(
      (p) =>
        `| ${p.name} | ${statusEmoji(p.overallStatus)} | ${p.sourceStatus} | ${p.buildStatus} | ${p.uiIssues} | ${p.stressError}% |`
    ),
    ``,
    `---`,
    ``,
    `## Critical Issues`,
    ``,
    criticalIssues.length
      ? criticalIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')
      : '_No critical issues detected._',
    ``,
    `---`,
    ``,
    `## UI/UX Problems`,
    ``,
    uiProblems.length
      ? uiProblems.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : '_No UI problems detected._',
    ``,
    `---`,
    ``,
    `## Operation / Revenue Risk`,
    ``,
    operationRisks.length
      ? operationRisks.map((r) => `- ${r}`).join('\n')
      : '_No operation risks detected._',
    ``,
    `---`,
    ``,
    `## CEO Decision Required`,
    ``,
    totalFail > 0
      ? `- **URGENT:** ${totalFail} project(s) are failing. Assign to dev team immediately.`
      : '',
    totalWarn > 0
      ? `- **REVIEW:** ${totalWarn} project(s) have warnings. Review within 48 hours.`
      : '',
    criticalIssues.length > 0
      ? `- **SECURITY:** Secret findings require immediate remediation.`
      : '',
    totalFail === 0 && totalWarn === 0
      ? `- All systems healthy. No action required.`
      : '',
    ``,
    `---`,
    ``,
    `_Report generated by Internal QA System. Full technical detail in dev-report.md_`,
  ];

  const content = maskText(lines.filter((l) => l !== '').join('\n') + '\n');
  writeText(filePath, content);
  logger.success(`CEO report: ${filePath}`);
  return filePath;
}
