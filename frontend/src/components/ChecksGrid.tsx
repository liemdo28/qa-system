import { QAResult, CheckStatus } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  result: QAResult;
}

const CHECK_META: { key: keyof QAResult['summary']; label: string; icon: string }[] = [
  { key: 'build',       label: 'Build',       icon: '🔨' },
  { key: 'links',       label: 'Links',       icon: '🔗' },
  { key: 'seo',         label: 'SEO',         icon: '🔍' },
  { key: 'performance', label: 'Performance', icon: '⚡' },
];

function metricLabel(key: string, result: QAResult): string {
  const m = result.metrics;
  if (key === 'build' && m.buildTimeMs) return `${(m.buildTimeMs / 1000).toFixed(1)}s`;
  if (key === 'links' && m.linksChecked) return `${m.brokenLinksCount ?? 0} broken / ${m.linksChecked} checked`;
  if (key === 'performance' && m.loadTimeMs) return `${m.loadTimeMs}ms load`;
  if (key === 'seo') {
    const seoIssues = result.issues.filter((i) => i.type === 'seo_missing').length;
    return seoIssues > 0 ? `${seoIssues} issue${seoIssues > 1 ? 's' : ''}` : 'All tags present';
  }
  return '';
}

export function ChecksGrid({ result }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12,
      marginBottom: 24,
    }}>
      {CHECK_META.map(({ key, label, icon }) => {
        const status = result.summary[key] as CheckStatus;
        const metric = metricLabel(key, result);
        const borderColor = status === 'pass' ? '#bbf7d0' : status === 'fail' ? '#fecaca' : status === 'warning' ? '#fde68a' : '#e2e8f0';
        const bg = status === 'pass' ? '#f0fdf4' : status === 'fail' ? '#fef2f2' : status === 'warning' ? '#fffbeb' : '#f8fafc';

        return (
          <div key={key} style={{
            padding: '14px 16px',
            borderRadius: 10,
            border: `1px solid ${borderColor}`,
            background: bg,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                {icon} {label}
              </span>
              <StatusBadge status={status} size="sm" />
            </div>
            {metric && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{metric}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
