import { Project, QAResult, ManagedService } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  project: Project;
  result?: QAResult;
  isRunning: boolean;
  isSelected: boolean;
  services: ManagedService[];
  onSelect: () => void;
  onRun: () => void;
  onViewLogs: (service: ManagedService) => void;
  onStopService: (serviceId: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  web: 'Web',
  static: 'Static',
  'php-static': 'PHP/Static',
  dashboard: 'Dashboard',
  'internal-tool': 'Internal',
  'operation-system': 'Ops',
  website: 'Website',
  auto: 'Auto',
  php: 'PHP',
  python: 'Python',
};

const SVC_COLOR: Record<string, string> = {
  running:         '#16a34a',
  already_running: '#0891b2',
  starting:        '#2563eb',
  failed:          '#dc2626',
  stopped:         '#64748b',
};

const SVC_LABEL: Record<string, string> = {
  running:         '● Running',
  already_running: '● Already Up',
  starting:        '⟳ Starting',
  failed:          '✗ Failed',
  stopped:         '○ Stopped',
};

function SmallBtn({ children, onClick, color = '#94a3b8', bg = 'rgba(148,163,184,0.1)', href }: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  color?: string;
  bg?: string;
  href?: string;
}) {
  const style: React.CSSProperties = {
    fontSize: 10, padding: '2px 8px', borderRadius: 4,
    background: bg, color, fontWeight: 600,
    border: 'none', cursor: 'pointer', textDecoration: 'none',
    whiteSpace: 'nowrap', lineHeight: '18px', display: 'inline-block',
  };
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" style={style} onClick={(e) => e.stopPropagation()}>{children}</a>;
  }
  return <button style={style} onClick={onClick}>{children}</button>;
}

export function ProjectCard({ project, result, isRunning, isSelected, services, onSelect, onRun, onViewLogs, onStopService }: Props) {
  const qaStatus = isRunning ? 'running' : (result?.status ?? 'never');
  const lastRun = result?.completedAt
    ? new Date(result.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const isLiveSite = project.url?.startsWith('https://');

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px 14px',
        cursor: 'pointer',
        borderRadius: 10,
        marginBottom: 8,
        background: isSelected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
        border: isSelected ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.07)',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
    >
      {/* Row 1: type badge + name + Run QA button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#94a3b8',
              background: 'rgba(255,255,255,0.07)', padding: '1px 6px',
              borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {TYPE_LABELS[project.type] ?? project.type}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3, marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {project.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge status={qaStatus} size="sm" pulse={isRunning} />
            {lastRun && !isRunning && <span style={{ fontSize: 10, color: '#64748b' }}>{lastRun}</span>}
            {isRunning && <span style={{ fontSize: 10, color: '#3b82f6' }}>running…</span>}
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onRun(); }}
          disabled={isRunning}
          style={{
            padding: '5px 12px', borderRadius: 8, border: 'none',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: 11, fontWeight: 700,
            background: isRunning ? 'rgba(59,130,246,0.2)' : '#3b82f6',
            color: isRunning ? '#93c5fd' : '#fff',
            transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {isRunning ? '⟳' : '▶ QA'}
        </button>
      </div>

      {/* Row 2: localPath + live site link */}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {project.localPath && (
          <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
            {project.localPath.replace(/^.*[/\\]/, '…/')}
          </span>
        )}
        {isLiveSite && (
          <SmallBtn href={project.url} color="#6366f1" bg="rgba(99,102,241,0.1)">
            ↗ Live Site
          </SmallBtn>
        )}
      </div>

      {/* Service status rows */}
      {services.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {services.map((svc) => (
            <div key={svc.id} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: SVC_COLOR[svc.status] ?? '#94a3b8',
                  flex: 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {SVC_LABEL[svc.status] ?? svc.status} — {svc.serviceName}
                </span>
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  {svc.url && (svc.status === 'running' || svc.status === 'already_running') && (
                    <SmallBtn href={svc.url} color="#4ade80" bg="rgba(22,163,74,0.15)">
                      ↗ Local UI
                    </SmallBtn>
                  )}
                  <SmallBtn
                    onClick={(e) => { e.stopPropagation(); onViewLogs(svc); }}
                    color="#94a3b8" bg="rgba(148,163,184,0.1)"
                  >
                    Logs
                  </SmallBtn>
                  {svc.status !== 'stopped' && (
                    <SmallBtn
                      onClick={(e) => { e.stopPropagation(); onStopService(svc.id); }}
                      color="#f87171" bg="rgba(220,38,38,0.1)"
                    >
                      ■
                    </SmallBtn>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
