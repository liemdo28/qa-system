import { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
  isRunning: boolean;
}

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  info:    '#94a3b8',
  success: '#4ade80',
  warn:    '#fbbf24',
  error:   '#f87171',
};

const LEVEL_PREFIX: Record<LogEntry['level'], string> = {
  info:    '  ',
  success: '✓ ',
  warn:    '⚠ ',
  error:   '✗ ',
};

export function LogStream({ logs, isRunning }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Live Logs</span>
        {isRunning && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, color: '#2563eb', fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', animation: 'qa-pulse 1.4s ease-in-out infinite' }} />
            STREAMING
          </span>
        )}
        {!isRunning && logs.length > 0 && (
          <span style={{ fontSize: 10, color: '#64748b' }}>{logs.length} lines</span>
        )}
      </div>

      <div style={{
        background: '#0f172a',
        borderRadius: 10,
        padding: '14px 16px',
        height: 260,
        overflowY: 'auto',
        fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
        fontSize: 11,
        lineHeight: 1.7,
        border: '1px solid #1e293b',
      }}>
        {logs.length === 0 && (
          <div style={{ color: '#475569', fontStyle: 'italic' }}>
            {isRunning ? 'Connecting to log stream…' : 'No logs yet. Click Run QA to start.'}
          </div>
        )}
        {logs.map((log, i) => {
          const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          return (
            <div key={i} style={{ display: 'flex', gap: 10 }}>
              <span style={{ color: '#334155', flexShrink: 0 }}>{time}</span>
              <span style={{ color: LEVEL_COLOR[log.level], wordBreak: 'break-word' }}>
                {LEVEL_PREFIX[log.level]}{log.message}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
