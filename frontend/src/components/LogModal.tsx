import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  logs: string[];
  onClose: () => void;
}

export function LogModal({ title, logs, onClose }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(2,6,23,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0f172a',
          borderRadius: 12,
          border: '1px solid #1e293b',
          width: '100%',
          maxWidth: 720,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid #1e293b',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
            📋 Logs — {title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#475569' }}>{logs.length} lines</span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Log content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 18px',
          fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
          fontSize: 11,
          lineHeight: 1.7,
        }}>
          {logs.length === 0 ? (
            <span style={{ color: '#475569', fontStyle: 'italic' }}>No logs yet.</span>
          ) : (
            logs.map((line, i) => (
              <div key={i} style={{ color: line.startsWith('[error]') || line.startsWith('[crash]') ? '#f87171' : line.startsWith('[warn]') ? '#fbbf24' : '#94a3b8' }}>
                {line}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #1e293b', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
          >
            Close  [Esc]
          </button>
        </div>
      </div>
    </div>
  );
}
