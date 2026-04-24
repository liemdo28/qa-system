import { Project, QAResult } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  project: Project;
  result?: QAResult;
  isRunning: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onRun: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  web: 'Web',
  static: 'Static',
  dashboard: 'Dashboard',
  'internal-tool': 'Internal',
  'operation-system': 'Ops',
  website: 'Website',
};

export function ProjectCard({ project, result, isRunning, isSelected, onSelect, onRun }: Props) {
  const status = isRunning ? 'running' : (result?.status ?? 'never');
  const lastRun = result?.completedAt
    ? new Date(result.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '14px 16px',
        cursor: 'pointer',
        borderRadius: 10,
        marginBottom: 8,
        background: isSelected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
        border: isSelected ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.07)',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#94a3b8',
              background: 'rgba(255,255,255,0.07)', padding: '1px 6px',
              borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {TYPE_LABELS[project.type] ?? project.type}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {project.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge status={status} size="sm" pulse={isRunning} />
            {lastRun && !isRunning && (
              <span style={{ fontSize: 10, color: '#64748b' }}>{lastRun}</span>
            )}
            {isRunning && (
              <span style={{ fontSize: 10, color: '#3b82f6' }}>running…</span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onRun(); }}
          disabled={isRunning}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: 'none',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 700,
            background: isRunning ? 'rgba(59,130,246,0.2)' : '#3b82f6',
            color: isRunning ? '#93c5fd' : '#fff',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {isRunning ? '…' : '▶ Run'}
        </button>
      </div>
    </div>
  );
}
