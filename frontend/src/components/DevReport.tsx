import { useState } from 'react';
import { QAResult, QAIssue } from '../types';
import { api } from '../api/client';

interface Props {
  result: QAResult;
  projectId: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#d97706',
  low:      '#6b7280',
};

const SEVERITY_BG: Record<string, string> = {
  critical: '#fef2f2',
  high:     '#fff7ed',
  medium:   '#fffbeb',
  low:      '#f9fafb',
};

const STATUS_COLOR: Record<string, string> = {
  pass:    '#16a34a',
  fail:    '#dc2626',
  warning: '#d97706',
  skip:    '#6b7280',
};

const STATUS_ICON: Record<string, string> = {
  pass: '✅', fail: '❌', warning: '⚠️', skip: '⏭️',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
      color: SEVERITY_COLOR[severity] ?? '#6b7280',
      background: SEVERITY_BG[severity] ?? '#f9fafb',
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {severity}
    </span>
  );
}

function IssueCard({ issue, index }: { issue: QAIssue; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div style={{
      border: `1px solid ${SEVERITY_BG[issue.severity] === '#fef2f2' ? '#fecaca' : '#e2e8f0'}`,
      borderLeft: `3px solid ${SEVERITY_COLOR[issue.severity] ?? '#6b7280'}`,
      borderRadius: 6, marginBottom: 8, overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          cursor: 'pointer', background: '#fff', userSelect: 'none',
        }}
      >
        <SeverityBadge severity={issue.severity} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', flex: 1, lineHeight: 1.4 }}>
          {issue.message}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
          {issue.url && (
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              URL: {issue.url}
            </div>
          )}

          {issue.whyItMatters && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                Why it matters
              </div>
              <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6 }}>{issue.whyItMatters}</div>
            </div>
          )}

          {issue.suggestedFix && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                Suggested fix
              </div>
              <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6 }}>{issue.suggestedFix}</div>
            </div>
          )}

          {issue.exampleFix && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                Example
              </div>
              <pre style={{
                margin: 0, fontSize: 10, background: '#0f172a', color: '#e2e8f0',
                padding: '8px 10px', borderRadius: 4, overflowX: 'auto', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {issue.exampleFix}
              </pre>
            </div>
          )}

          {issue.filesToCheck && issue.filesToCheck.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Files to check
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {issue.filesToCheck.map((f) => (
                  <span key={f} style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 3,
                    background: '#f1f5f9', color: '#475569', fontFamily: 'monospace',
                  }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildMarkdown(result: QAResult): string {
  const m   = result.metrics;
  const url = m.qaUrl ?? 'N/A';
  const src = m.qaUrlSource?.toUpperCase() ?? 'LIVE';
  const ts  = new Date(result.completedAt ?? result.timestamp).toLocaleString();
  const lines: string[] = [];

  lines.push('# QA Developer Report', '');
  lines.push(`**Project:** ${result.projectName}`);
  lines.push(`**Status:** ${result.status.toUpperCase()}`);
  lines.push(`**Run ID:** ${result.runId}`);
  lines.push(`**Tested URL:** ${url}`);
  lines.push(`**Target Type:** ${src}`);
  lines.push(`**Time:** ${ts}`, '');

  if (result.summary.seo === 'skip' && m.seoSkipReason) {
    lines.push('## ⚠️ Important Finding', '');
    lines.push('QA detected a **login page redirect**. SEO checks were skipped.', '');
    lines.push(`> ${m.seoSkipReason}`, '');
  }

  lines.push('## Summary', '');
  const sum = result.summary;
  const icons: Record<string, string> = { pass: '✅', fail: '❌', warning: '⚠️', skip: '⏭️' };
  lines.push(`- **Build:** ${icons[sum.build]} ${sum.build === 'skip' ? `Skipped${m.buildSkipReason ? ` — ${m.buildSkipReason}` : ''}` : sum.build.toUpperCase()}`);
  lines.push(`- **Links:** ${icons[sum.links]} ${sum.links.toUpperCase()}${m.linksChecked != null ? ` — ${m.brokenLinksCount ?? 0} broken / ${m.linksChecked} checked` : ''}`);
  lines.push(`- **SEO:** ${icons[sum.seo]} ${sum.seo === 'skip' ? 'Skipped — auth required' : `${sum.seo.toUpperCase()} — ${result.issues.filter((i) => i.type === 'seo_missing').length} issue(s)`}`);
  lines.push(`- **Performance:** ${icons[sum.performance]} ${sum.performance.toUpperCase()}${m.loadTimeMs ? ` — ${m.loadTimeMs}ms` : ''}`, '');

  const actionable = result.issues.filter((i) => !(i.type === 'console_error' && i.severity === 'medium'));
  if (actionable.length > 0) {
    lines.push('## Issues', '');
    actionable.forEach((issue, i) => {
      lines.push(`### ${i + 1}. ${issue.message}`, '');
      lines.push(`**Severity:** ${issue.severity.toUpperCase()}`);
      if (issue.url) lines.push(`**URL:** ${issue.url}`);
      lines.push('');
      if (issue.whyItMatters) { lines.push('**Why it matters:**'); lines.push(issue.whyItMatters, ''); }
      if (issue.suggestedFix) { lines.push('**Suggested fix:**'); lines.push(issue.suggestedFix, ''); }
      if (issue.exampleFix) { lines.push('**Example:**'); lines.push('```html', issue.exampleFix, '```', ''); }
      if (issue.filesToCheck?.length) {
        lines.push('**Files to check:**');
        issue.filesToCheck.forEach((f) => lines.push(`- \`${f}\``));
        lines.push('');
      }
    });
  }

  lines.push('## Recommended Developer Actions', '');
  lines.push(`1. Confirm whether QA should test LOCAL or LIVE (currently: **${src}**).`);
  if (result.summary.seo === 'skip') lines.push('2. Set `qa.entry` in `config/projects.json` to a public (non-login) URL.');
  lines.push(`${result.summary.seo === 'skip' ? '3' : '2'}. Fix CRITICAL and HIGH severity issues first.`);
  lines.push(`${result.summary.seo === 'skip' ? '4' : '3'}. Re-run QA after each fix.`);
  lines.push('', '---', `*Generated by QA Control Center — ${ts}*`);

  return lines.join('\n');
}

export function DevReport({ result, projectId }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const md = buildMarkdown(result);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMd = () => api.downloadReport(projectId, 'md');
  const handleDownloadJson = () => api.downloadReport(projectId, 'json');

  const m   = result.metrics;
  const url = m.qaUrl ?? 'N/A';
  const src = m.qaUrlSource ?? 'live';
  const seoSkipped = result.summary.seo === 'skip';
  const actionableIssues = result.issues.filter(
    (i) => !(i.type === 'console_error' && i.severity === 'medium')
  );

  return (
    <aside style={{
      width: 360, flexShrink: 0,
      background: '#fff',
      borderLeft: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
          🛠 Developer Fix Report
        </div>
        <div style={{ fontSize: 10, color: '#64748b' }}>
          {result.projectName} · {new Date(result.completedAt ?? result.timestamp).toLocaleTimeString()}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {/* Test target */}
        <div style={{
          padding: '8px 12px', borderRadius: 6, marginBottom: 12,
          background: src === 'local' ? '#f0fdf4' : '#f5f3ff',
          border: `1px solid ${src === 'local' ? '#bbf7d0' : '#ddd6fe'}`,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: src === 'local' ? '#16a34a' : '#6d28d9', marginBottom: 2 }}>
            Testing: [{src.toUpperCase()}]
          </div>
          <div style={{ fontSize: 10, color: '#374151', fontFamily: 'monospace', wordBreak: 'break-all' }}>{url}</div>
          {src === 'live' && (
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
              Local service not running — using live URL
            </div>
          )}
        </div>

        {/* Auth warning */}
        {seoSkipped && (
          <div style={{
            padding: '8px 12px', borderRadius: 6, marginBottom: 12,
            background: '#fffbeb', border: '1px solid #fde68a',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', marginBottom: 2 }}>
              ⚠️ Login Page Detected
            </div>
            <div style={{ fontSize: 10, color: '#78350f', lineHeight: 1.5 }}>
              QA was redirected to a login page. SEO check was skipped.<br />
              Set <code style={{ background: '#fef3c7', padding: '0 3px', borderRadius: 2 }}>qa.entry</code> in config to test a public URL.
            </div>
          </div>
        )}

        {/* Summary */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Summary
          </div>
          {(Object.entries(result.summary) as [string, string][]).map(([key, status]) => {
            let label = status.toUpperCase();
            if (key === 'build' && status === 'skip') label = `SKIP — ${m.buildSkipReason ?? 'no build required'}`;
            if (key === 'seo'   && status === 'skip') label = 'SKIP — auth required';
            if (key === 'links' && m.linksChecked != null) label += ` (${m.brokenLinksCount ?? 0}/${m.linksChecked})`;
            if (key === 'performance' && m.loadTimeMs) label += ` (${m.loadTimeMs}ms)`;

            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 11, color: '#374151', textTransform: 'capitalize' }}>{key}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[status] ?? '#6b7280' }}>
                  {STATUS_ICON[status] ?? ''} {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Issues */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Issues ({actionableIssues.length})
          </div>
          {actionableIssues.length === 0 ? (
            <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
              No actionable issues found.
            </div>
          ) : (
            actionableIssues.map((issue, i) => (
              <IssueCard key={i} issue={issue} index={i} />
            ))
          )}
        </div>

        {/* Priority actions */}
        <div style={{ background: '#f8fafc', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Priority Actions
          </div>
          <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#374151', lineHeight: 1.8 }}>
            <li>Confirm QA target: <strong>{src.toUpperCase()}</strong> → {url}</li>
            {seoSkipped && <li>Set <code>qa.entry</code> to a public page</li>}
            <li>Fix CRITICAL / HIGH issues first</li>
            <li>Re-run QA after each fix to verify</li>
          </ol>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={() => void handleCopy()}
          style={{
            padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: copied ? '#16a34a' : '#2563eb', color: '#fff',
            fontSize: 11, fontWeight: 700, transition: 'background 0.2s',
          }}
        >
          {copied ? '✓ Copied!' : '📋 Copy Dev Report'}
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleDownloadMd}
            style={{
              flex: 1, padding: '6px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid #cbd5e1', background: '#fff', color: '#374151',
              fontSize: 10, fontWeight: 600,
            }}
          >
            ↓ .MD
          </button>
          <button
            onClick={handleDownloadJson}
            style={{
              flex: 1, padding: '6px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid #cbd5e1', background: '#fff', color: '#374151',
              fontSize: 10, fontWeight: 600,
            }}
          >
            ↓ .JSON
          </button>
        </div>
      </div>
    </aside>
  );
}
