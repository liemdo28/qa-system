import { useState, useEffect } from 'react';
import { Project } from './types';
import { api } from './api/client';
import { Dashboard } from './pages/Dashboard';

type ConnStatus = 'connecting' | 'connected' | 'error';

function Header({ projectCount, connStatus }: { projectCount: number; connStatus: ConnStatus }) {
  const dotColor = connStatus === 'connected' ? '#22c55e' : connStatus === 'error' ? '#ef4444' : '#f59e0b';
  const dotLabel = connStatus === 'connected' ? 'API Connected' : connStatus === 'error' ? 'API Offline' : 'Connecting…';

  return (
    <header style={{
      height: 56,
      background: '#020617',
      borderBottom: '1px solid #1e293b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 900, color: '#fff',
        }}>
          QA
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
            QA Control Center
          </div>
          <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.05em' }}>
            {projectCount} project{projectCount !== 1 ? 's' : ''} configured
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: dotColor,
          animation: connStatus === 'connecting' ? 'qa-pulse 1.4s ease-in-out infinite' : undefined,
        }} />
        <span style={{ fontSize: 11, color: '#64748b' }}>{dotLabel}</span>
      </div>
    </header>
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.getProjects()
      .then(({ projects: p }) => {
        setProjects(p);
        setConnStatus('connected');
      })
      .catch((e: Error) => {
        setLoadError(`Cannot connect to QA backend: ${e.message}`);
        setConnStatus('error');
      });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header projectCount={projects.length} connStatus={connStatus} />

      {loadError ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: '#f8fafc',
        }}>
          <div style={{ fontSize: 40 }}>🔌</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>Backend Offline</div>
          <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', maxWidth: 360 }}>
            {loadError}
          </div>
          <div style={{ padding: '12px 20px', background: '#1e293b', borderRadius: 8, fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
            npm run start:backend
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}
          >
            Retry
          </button>
        </div>
      ) : connStatus === 'connecting' ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Connecting to QA backend…</div>
        </div>
      ) : (
        <Dashboard projects={projects} />
      )}
    </div>
  );
}
