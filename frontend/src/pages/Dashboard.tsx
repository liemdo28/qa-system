import { useState, useCallback } from 'react';
import { Project, QAResult, LogEntry, WSMessage, ManagedService } from '../types';
import { api } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { ProjectCard } from '../components/ProjectCard';
import { StatusBadge } from '../components/StatusBadge';
import { ChecksGrid } from '../components/ChecksGrid';
import { IssueList } from '../components/IssueList';
import { LogStream } from '../components/LogStream';
import { StartPanel } from '../components/StartPanel';
import { LogModal } from '../components/LogModal';
import { DevReport } from '../components/DevReport';

interface Props {
  projects: Project[];
}

export function Dashboard({ projects }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, QAResult>>({});
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // System state
  const [systemServices, setSystemServices] = useState<ManagedService[]>([]);
  const [systemProgress, setSystemProgress] = useState<{ step: number; total: number; message: string } | null>(null);
  const [isSystemStarting, setIsSystemStarting] = useState(false);
  const [logModal, setLogModal] = useState<{ serviceId: string; title: string; logs: string[] } | null>(null);

  const handleWsMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'log') {
      if (msg.runId === activeRunId || activeRunId === null) {
        setActiveRunId(msg.runId);
        setLogs((prev) => [...prev, {
          runId: msg.runId,
          level: msg.level,
          message: msg.message,
          timestamp: msg.timestamp,
        }]);
      }
    } else if (msg.type === 'result') {
      setResults((prev) => ({ ...prev, [msg.projectId]: msg.data }));
      setRunning((prev) => { const s = new Set(prev); s.delete(msg.projectId); return s; });
    } else if (msg.type === 'system_status') {
      setSystemServices(msg.services);
      const anyStarting = msg.services.some((s) => s.status === 'starting');
      if (!anyStarting) {
        setIsSystemStarting(false);
        setSystemProgress(null);
      }
    } else if (msg.type === 'system_progress') {
      setSystemProgress({ step: msg.step, total: msg.total, message: msg.message });
    }
  }, [activeRunId]);

  useWebSocket(handleWsMessage);

  const handleRun = useCallback(async (projectId: string) => {
    setError(null);
    setLogs([]);
    setActiveRunId(null);
    setSelectedId(projectId);
    setRunning((prev) => new Set([...prev, projectId]));

    try {
      const { runId } = await api.runQA(projectId);
      setActiveRunId(runId);
    } catch (e) {
      setError(String(e));
      setRunning((prev) => { const s = new Set(prev); s.delete(projectId); return s; });
    }
  }, []);

  const handleSystemStart = useCallback(async () => {
    setIsSystemStarting(true);
    setSystemProgress({ step: 0, total: 4, message: 'Initializing…' });
    try {
      await api.system.start();
    } catch (e) {
      setError(String(e));
      setIsSystemStarting(false);
      setSystemProgress(null);
    }
  }, []);

  const handleSystemStop = useCallback(async () => {
    try {
      await api.system.stop();
      setSystemServices([]);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const handleStopService = useCallback(async (serviceId: string) => {
    try {
      await api.system.stopService(serviceId);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const handleViewLogs = useCallback(async (service: ManagedService) => {
    try {
      const { logs: lines } = await api.system.logs(service.id);
      setLogModal({ serviceId: service.id, title: service.serviceName, logs: lines });
    } catch {
      setLogModal({ serviceId: service.id, title: service.serviceName, logs: service.logLines });
    }
  }, []);

  const hasRunningServices = systemServices.some((s) => s.status === 'running' || s.status === 'starting');

  const selectedProject = projects.find((p) => p.id === selectedId);
  const selectedResult = selectedId ? results[selectedId] : undefined;
  const isSelectedRunning = selectedId ? running.has(selectedId) : false;

  const passCount = Object.values(results).filter((r) => r.status === 'pass').length;
  const failCount = Object.values(results).filter((r) => r.status === 'fail').length;
  const warnCount = Object.values(results).filter((r) => r.status === 'warning').length;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 300,
        background: '#0f172a',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Projects ({projects.length})
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {passCount > 0 && <StatusBadge status="pass" size="sm" />}
            {failCount > 0 && <StatusBadge status="fail" size="sm" />}
            {warnCount > 0 && <StatusBadge status="warning" size="sm" />}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {projects.map((project) => {
            const projectServices = systemServices.filter((s) => s.projectId === project.id);
            return (
              <ProjectCard
                key={project.id}
                project={project}
                result={results[project.id]}
                isRunning={running.has(project.id)}
                isSelected={selectedId === project.id}
                services={projectServices}
                onSelect={() => setSelectedId(project.id)}
                onRun={() => void handleRun(project.id)}
                onViewLogs={(svc) => void handleViewLogs(svc)}
                onStopService={(id) => void handleStopService(id)}
              />
            );
          })}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b' }}>
          <button
            onClick={() => {
              for (const p of projects) {
                if (!running.has(p.id)) void handleRun(p.id);
              }
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              border: 'none',
              background: 'rgba(59,130,246,0.15)',
              color: '#93c5fd',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            ▶ Run All Projects
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>
        {!selectedProject ? (
          <StartPanel
            projectCount={projects.length}
            isStarting={isSystemStarting}
            progress={systemProgress}
            hasRunningServices={hasRunningServices}
            onStart={() => void handleSystemStart()}
            onStop={() => void handleSystemStop()}
          />
        ) : (
          <div style={{ padding: 28, maxWidth: 860 }}>

            {/* Project header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                  {selectedProject.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusBadge
                    status={isSelectedRunning ? 'running' : (selectedResult?.status ?? 'never')}
                    pulse={isSelectedRunning}
                  />
                  {selectedResult?.completedAt && !isSelectedRunning && (
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      Last run {new Date(selectedResult.completedAt).toLocaleString()}
                    </span>
                  )}
                  {selectedResult?.metrics.qaUrl && !isSelectedRunning && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: selectedResult.metrics.qaUrlSource === 'local' ? 'rgba(22,163,74,0.12)' : 'rgba(99,102,241,0.12)',
                      color: selectedResult.metrics.qaUrlSource === 'local' ? '#16a34a' : '#6366f1',
                    }}>
                      Testing [{selectedResult.metrics.qaUrlSource?.toUpperCase() ?? 'LIVE'}] {selectedResult.metrics.qaUrl}
                    </span>
                  )}
                  {!selectedResult && selectedProject.url && (
                    <a
                      href={selectedProject.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none' }}
                    >
                      ↗ {selectedProject.url}
                    </a>
                  )}
                </div>
              </div>

              <button
                onClick={() => void handleRun(selectedProject.id)}
                disabled={isSelectedRunning}
                style={{
                  padding: '10px 24px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: isSelectedRunning ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  background: isSelectedRunning ? '#cbd5e1' : '#2563eb',
                  color: '#fff',
                  boxShadow: isSelectedRunning ? 'none' : '0 2px 8px rgba(37,99,235,0.3)',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSelectedRunning ? '⟳ Running…' : '▶ Run QA'}
              </button>
            </div>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, marginBottom: 20, border: '1px solid #fecaca' }}>
                ✗ {error}
              </div>
            )}

            {/* Checks grid */}
            {selectedResult && !isSelectedRunning && (
              <>
                <ChecksGrid result={selectedResult} />
                <div style={{ marginBottom: 24 }}>
                  <IssueList issues={selectedResult.issues} />
                </div>
              </>
            )}

            {!selectedResult && !isSelectedRunning && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24 }}>
                No QA results yet. Click <strong>Run QA</strong> to start.
              </div>
            )}

            {/* Log stream */}
            <LogStream logs={logs.filter((l) => l.runId === activeRunId)} isRunning={isSelectedRunning} />
          </div>
        )}
      </main>

      {/* ── Dev Report panel ── */}
      {selectedResult && selectedProject && !isSelectedRunning && (
        <DevReport result={selectedResult} projectId={selectedProject.id} />
      )}

      {/* ── Log Modal ── */}
      {logModal && (
        <LogModal
          title={logModal.title}
          logs={logModal.logs}
          onClose={() => setLogModal(null)}
        />
      )}
    </div>
  );
}
