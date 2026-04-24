import * as fs from 'fs-extra';
import * as path from 'path';
import { QAResult } from './types';

function reportsDir(): string {
  const dir = path.join(process.cwd(), 'reports');
  fs.ensureDirSync(dir);
  return dir;
}

function severityLabel(s: string): string {
  return s.toUpperCase();
}

function statusEmoji(s: string): string {
  if (s === 'pass')    return '✅';
  if (s === 'fail')    return '❌';
  if (s === 'warning') return '⚠️';
  if (s === 'skip')    return '⏭️';
  return '—';
}

export function generateMarkdown(result: QAResult): string {
  const m   = result.metrics;
  const url = m.qaUrl ?? result.metrics.qaUrl ?? 'N/A';
  const src = m.qaUrlSource?.toUpperCase() ?? 'LIVE';
  const ts  = new Date(result.completedAt ?? result.timestamp).toLocaleString();

  const lines: string[] = [];

  lines.push('# QA Developer Report');
  lines.push('');
  lines.push(`**Project:** ${result.projectName}`);
  lines.push(`**Status:** ${result.status.toUpperCase()}`);
  lines.push(`**Run ID:** ${result.runId}`);
  lines.push(`**Tested URL:** ${url}`);
  lines.push(`**Target Type:** ${src}`);
  lines.push(`**Time:** ${ts}`);
  lines.push('');

  // Auth warning
  const authIssue = result.issues.find((i) => i.type === 'broken_link' && i.message.includes('login'));
  const seoSkipped = result.summary.seo === 'skip';
  if (seoSkipped || m.seoSkipReason) {
    lines.push('## ⚠️ Important Finding');
    lines.push('');
    lines.push('QA detected a **login page redirect**. SEO checks were skipped because the page requires authentication.');
    lines.push('');
    lines.push(`> Reason: ${m.seoSkipReason ?? 'Auth redirect detected'}`);
    lines.push('');
    lines.push('**Recommended action:** Configure `qa.entry` in `config/projects.json` to point to a public-facing page, or set up a local dev server without auth protection.');
    lines.push('');
  }

  // Summary
  lines.push('## Summary');
  lines.push('');

  const buildLabel = result.summary.build === 'skip'
    ? `Skipped${m.buildSkipReason ? ` — ${m.buildSkipReason}` : ''}`
    : result.summary.build.toUpperCase();
  lines.push(`- **Build:** ${statusEmoji(result.summary.build)} ${buildLabel}`);

  if (result.summary.links !== 'skip') {
    lines.push(`- **Links:** ${statusEmoji(result.summary.links)} ${result.summary.links.toUpperCase()} — ${m.brokenLinksCount ?? 0} broken / ${m.linksChecked ?? 0} checked`);
  } else {
    lines.push(`- **Links:** ${statusEmoji('skip')} Skipped`);
  }

  const seoLabel = seoSkipped
    ? 'Skipped — authentication required'
    : `${result.summary.seo.toUpperCase()} — ${result.issues.filter((i) => i.type === 'seo_missing').length} issue(s)`;
  lines.push(`- **SEO:** ${statusEmoji(result.summary.seo)} ${seoLabel}`);

  if (m.loadTimeMs) {
    lines.push(`- **Performance:** ${statusEmoji(result.summary.performance)} ${result.summary.performance.toUpperCase()} — ${m.loadTimeMs}ms load time`);
  } else {
    lines.push(`- **Performance:** ${statusEmoji(result.summary.performance)} ${result.summary.performance.toUpperCase()}`);
  }

  lines.push('');

  // Issues
  const actionable = result.issues.filter((i) => i.type !== 'console_error' || i.severity === 'high' || i.severity === 'critical');
  if (actionable.length === 0) {
    lines.push('## Issues');
    lines.push('');
    lines.push('No actionable issues found.');
    lines.push('');
  } else {
    lines.push('## Issues');
    lines.push('');
    actionable.forEach((issue, idx) => {
      lines.push(`### ${idx + 1}. ${issue.message}`);
      lines.push('');
      lines.push(`**Severity:** ${severityLabel(issue.severity)}`);
      if (issue.url) lines.push(`**URL:** ${issue.url}`);
      lines.push('');

      if (issue.whyItMatters) {
        lines.push('**Why it matters:**');
        lines.push(issue.whyItMatters);
        lines.push('');
      }

      if (issue.suggestedFix) {
        lines.push('**Suggested fix:**');
        lines.push(issue.suggestedFix);
        lines.push('');
      }

      if (issue.exampleFix) {
        lines.push('**Example:**');
        lines.push('```html');
        lines.push(issue.exampleFix);
        lines.push('```');
        lines.push('');
      }

      if (issue.filesToCheck?.length) {
        lines.push('**Files to check:**');
        issue.filesToCheck.forEach((f) => lines.push(`- \`${f}\``));
        lines.push('');
      }
    });
  }

  // Recommended actions
  lines.push('## Recommended Developer Actions');
  lines.push('');
  lines.push(`1. Confirm whether QA should test **${src === 'LOCAL' ? 'LOCAL' : 'LIVE'}** or the other target.`);
  if (seoSkipped) {
    lines.push('2. Configure `qa.entry` in `config/projects.json` to point to a public page (not the login page).');
  }
  lines.push(`${seoSkipped ? '3' : '2'}. Fix the highest-severity issues first (CRITICAL → HIGH → MEDIUM → LOW).`);
  lines.push(`${seoSkipped ? '4' : '3'}. Re-run QA after each fix to verify the issue is resolved.`);
  lines.push('');
  lines.push('---');
  lines.push(`*Generated by QA Control Center — ${ts}*`);

  return lines.join('\n');
}

export function saveReports(result: QAResult): void {
  const dir  = reportsDir();
  const base = `${result.projectId}-${result.runId}`;

  try {
    fs.writeFileSync(path.join(dir, `${base}.md`),   generateMarkdown(result), 'utf-8');
    fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify(result, null, 2), 'utf-8');
  } catch { /* non-fatal */ }
}

export function getLatestReportPath(projectId: string, ext: 'md' | 'json'): string | null {
  const dir = reportsDir();
  try {
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith(`${projectId}-`) && f.endsWith(`.${ext}`))
      .sort()
      .reverse();
    return files[0] ? path.join(dir, files[0]) : null;
  } catch {
    return null;
  }
}
