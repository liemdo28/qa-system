import { useState } from 'react';
import { QAIssue, IssueSeverity, IssueType } from '../types';

interface Props {
  issues: QAIssue[];
}

const SEVERITY_CONFIG: Record<IssueSeverity, { color: string; bg: string; label: string }> = {
  critical: { color: '#dc2626', bg: '#fee2e2', label: 'CRITICAL' },
  high:     { color: '#ea580c', bg: '#ffedd5', label: 'HIGH' },
  medium:   { color: '#d97706', bg: '#fef3c7', label: 'MEDIUM' },
  low:      { color: '#2563eb', bg: '#dbeafe', label: 'LOW' },
};

const TYPE_ICON: Record<IssueType, string> = {
  broken_link:      '🔗',
  console_error:    '⚠',
  seo_missing:      '🔍',
  performance_slow: '⚡',
  build_error:      '🔨',
};

function IssueRow({ issue }: { issue: QAIssue }) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY_CONFIG[issue.severity];
  const icon = TYPE_ICON[issue.type];

  return (
    <div style={{
      borderRadius: 8,
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      marginBottom: 6,
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: open ? '#f8fafc' : '#fff',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 7px',
          borderRadius: 4, color: sev.color, background: sev.bg,
          flexShrink: 0, letterSpacing: '0.04em',
        }}>
          {sev.label}
        </span>
        <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {issue.message}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '10px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: issue.url ? 6 : 0 }}>
            {issue.message}
          </div>
          {issue.url && (
            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              URL: {issue.url}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function IssueList({ issues }: Props) {
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const highCount = issues.filter((i) => i.severity === 'high').length;

  if (issues.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#16a34a', fontSize: 13, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
        ✓ No issues found
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
          Issues ({issues.length})
        </span>
        {criticalCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 8px', borderRadius: 4 }}>
            {criticalCount} critical
          </span>
        )}
        {highCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#ea580c', background: '#ffedd5', padding: '1px 8px', borderRadius: 4 }}>
            {highCount} high
          </span>
        )}
      </div>
      {issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
    </div>
  );
}
