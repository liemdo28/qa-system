import { RunStatus, CheckStatus } from '../types';

type Status = RunStatus | CheckStatus | 'never' | 'connected' | 'disconnected' | 'already_running';

const CONFIG: Record<Status, { label: string; color: string; bg: string; dot: string }> = {
  pass:            { label: 'PASS',    color: '#16a34a', bg: '#dcfce7', dot: '#22c55e' },
  fail:            { label: 'FAIL',    color: '#dc2626', bg: '#fee2e2', dot: '#ef4444' },
  warning:         { label: 'WARN',    color: '#d97706', bg: '#fef3c7', dot: '#f59e0b' },
  running:         { label: 'RUNNING', color: '#2563eb', bg: '#dbeafe', dot: '#3b82f6' },
  skip:            { label: 'SKIP',    color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
  never:           { label: 'NEVER',   color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
  connected:       { label: 'LIVE',    color: '#16a34a', bg: '#dcfce7', dot: '#22c55e' },
  disconnected:    { label: 'OFF',     color: '#dc2626', bg: '#fee2e2', dot: '#ef4444' },
  already_running: { label: 'UP',      color: '#0891b2', bg: '#e0f2fe', dot: '#06b6d4' },
};

interface Props {
  status: Status;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export function StatusBadge({ status, size = 'md', pulse }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.skip;
  const isSmall = size === 'sm';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: isSmall ? 4 : 6,
      padding: isSmall ? '2px 8px' : '3px 10px',
      borderRadius: 999,
      fontSize: isSmall ? 10 : 11,
      fontWeight: 700,
      letterSpacing: '0.05em',
      color: cfg.color,
      background: cfg.bg,
      userSelect: 'none',
    }}>
      <span style={{
        width: isSmall ? 6 : 7,
        height: isSmall ? 6 : 7,
        borderRadius: '50%',
        background: cfg.dot,
        flexShrink: 0,
        animation: pulse ? 'qa-pulse 1.4s ease-in-out infinite' : undefined,
      }} />
      {cfg.label}
    </span>
  );
}
