interface ProgressState {
  step: number;
  total: number;
  message: string;
}

interface Props {
  projectCount: number;
  isStarting: boolean;
  progress: ProgressState | null;
  onStart: () => void;
  onStop: () => void;
  hasRunningServices: boolean;
}

const STEPS = [
  'Checking project config',
  'Detecting project types',
  'Installing dependencies',
  'Starting services',
  'All systems ready',
];

function StepRow({ label, state }: { label: string; state: 'done' | 'active' | 'pending' }) {
  const color = state === 'done' ? '#16a34a' : state === 'active' ? '#2563eb' : '#94a3b8';
  const icon  = state === 'done' ? '✓' : state === 'active' ? '⟳' : '○';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <span style={{ fontSize: 16, color, width: 20, textAlign: 'center',
        animation: state === 'active' ? 'qa-spin 1s linear infinite' : undefined }}>{icon}</span>
      <span style={{ fontSize: 13, color: state === 'pending' ? '#94a3b8' : '#1e293b', fontWeight: state === 'active' ? 600 : 400 }}>
        {label}
      </span>
      {state === 'done' && <span style={{ fontSize: 11, color: '#16a34a', marginLeft: 'auto' }}>done</span>}
      {state === 'active' && <span style={{ fontSize: 11, color: '#2563eb', marginLeft: 'auto' }}>running…</span>}
    </div>
  );
}

export function StartPanel({ projectCount, isStarting, progress, onStart, onStop, hasRunningServices }: Props) {
  const progressPct = progress && progress.total > 0
    ? Math.round((progress.step / progress.total) * 100)
    : 0;

  // Determine step states based on progress
  function stepState(idx: number): 'done' | 'active' | 'pending' {
    if (!isStarting && !hasRunningServices) return 'pending';
    if (!progress) return idx === 0 ? 'active' : 'pending';
    const activeStep = Math.floor((progress.step / Math.max(progress.total, 1)) * STEPS.length);
    if (idx < activeStep) return 'done';
    if (idx === activeStep) return 'active';
    return 'pending';
  }

  if (hasRunningServices && !isStarting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 32 }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>All Systems Running</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Select a project from the sidebar to run QA or open its UI.
        </div>
        <button
          onClick={onStop}
          style={{ marginTop: 8, padding: '8px 24px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          ■ Stop All Services
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 32, padding: 40 }}>

      {/* Icon + title */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
          QA Control Center
        </div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          {projectCount} project{projectCount !== 1 ? 's' : ''} configured and ready
        </div>
      </div>

      {/* START button */}
      {!isStarting && (
        <button
          onClick={onStart}
          style={{
            padding: '16px 48px',
            fontSize: 16,
            fontWeight: 800,
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
            color: '#fff',
            boxShadow: '0 4px 24px rgba(37,99,235,0.35)',
            letterSpacing: '0.03em',
            transition: 'all 0.15s',
          }}
        >
          ▶  START ALL SYSTEMS
        </button>
      )}

      {/* Progress */}
      {isStarting && (
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Progress bar */}
          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #2563eb, #4f46e5)',
              width: `${progressPct}%`,
              borderRadius: 2,
              transition: 'width 0.4s ease',
            }} />
          </div>

          {/* Steps */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
            {STEPS.map((label, i) => (
              <StepRow key={label} label={label} state={stepState(i)} />
            ))}
          </div>

          {/* Live message */}
          {progress?.message && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                {progress.message}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      {!isStarting && (
        <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', maxWidth: 340 }}>
          Clicking Start will install dependencies and launch all configured project services automatically.
        </div>
      )}
    </div>
  );
}
