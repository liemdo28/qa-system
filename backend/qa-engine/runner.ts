import { v4 as uuidv4 } from 'uuid';
import { broadcast } from '../services/wsEmitter';
import { saveResult } from '../services/resultStore';
import { getAllServices } from '../services/processManager';
import { runBuildCheck } from './checks/buildCheck';
import { runLinkCheck } from './checks/linkCheck';
import { runBrowserCheck } from './checks/browserCheck';
import { Project, QAResult, RunStatus, CheckStatus } from './types';

const activeRuns = new Set<string>();

export function isRunning(projectId: string): boolean {
  return activeRuns.has(projectId);
}

function makeEmit(runId: string) {
  return (level: string, message: string): void => {
    broadcast({
      type: 'log',
      runId,
      level: level as 'info' | 'success' | 'warn' | 'error',
      message,
      timestamp: new Date().toISOString(),
    });
  };
}

function overallStatus(summary: { build: CheckStatus; links: CheckStatus; seo: CheckStatus; performance: CheckStatus }): RunStatus {
  const values = Object.values(summary);
  if (values.includes('fail')) return 'fail';
  if (values.includes('warning')) return 'warning';
  if (values.every((v) => v === 'skip')) return 'warning';
  return 'pass';
}

interface QATarget {
  url: string;
  source: 'local' | 'live';
}

function resolveQAUrl(project: Project): QATarget | null {
  const entry = project.qa?.entry ?? '/';
  const entryPath = entry === '/' ? '' : (entry.startsWith('/') ? entry : `/${entry}`);

  // Prefer a running local service for this project
  const services = getAllServices();
  const running = services.find(
    (s) => s.projectId === project.id &&
           (s.status === 'running' || s.status === 'already_running') &&
           s.url
  );

  if (running?.url) {
    return { url: `${running.url.replace(/\/$/, '')}${entryPath}`, source: 'local' };
  }

  // Fallback: live URL from config
  const liveBase = project.url ?? project.publicUrl ?? project.adminUrl;
  if (!liveBase) return null;
  return { url: `${liveBase.replace(/\/$/, '')}${entryPath}`, source: 'live' };
}

export async function runQA(project: Project): Promise<string> {
  const runId = uuidv4();
  activeRuns.add(project.id);

  void (async () => {
    const emit = makeEmit(runId);
    const startedAt = new Date().toISOString();

    emit('info', `Starting QA for "${project.name}" (${project.type})`);
    emit('info', `Run ID: ${runId}`);

    const issues: QAResult['issues'] = [];
    const summary = {
      build: 'skip' as CheckStatus,
      links: 'skip' as CheckStatus,
      seo:   'skip' as CheckStatus,
      performance: 'skip' as CheckStatus,
    };
    const metrics: QAResult['metrics'] = {};

    // 1. Build check
    try {
      emit('info', '── BUILD CHECK ──');
      const build = await runBuildCheck(project, emit);
      summary.build = build.status;
      metrics.buildTimeMs = build.buildTimeMs;
      if (build.detectedType) metrics.buildDetectedType = build.detectedType;
      if (build.skipReason)   metrics.buildSkipReason   = build.skipReason;
      issues.push(...build.issues);
    } catch (e) {
      emit('error', `Build check crashed: ${String(e)}`);
      summary.build = 'fail';
    }

    // Resolve target URL (local service first, then live fallback)
    const target = resolveQAUrl(project);

    if (!target) {
      emit('warn', 'No URL configured — skipping link, SEO, and performance checks');
    } else {
      metrics.qaUrl       = target.url;
      metrics.qaUrlSource = target.source;
      emit('info', `Testing [${target.source.toUpperCase()}] ${target.url}`);
      if (project.qa?.entry && project.qa.entry !== '/') {
        emit('info', `Entry path: ${project.qa.entry}`);
      }
    }

    // 2. Link check
    if (target) {
      try {
        emit('info', '── LINK CHECK ──');
        const links = await runLinkCheck(target.url, emit);
        summary.links = links.status;
        metrics.linksChecked     = links.linksChecked;
        metrics.brokenLinksCount = links.brokenLinksCount;
        issues.push(...links.issues);
      } catch (e) {
        emit('error', `Link check crashed: ${String(e)}`);
        summary.links = 'fail';
      }
    }

    // 3. Browser check (SEO + performance + console errors)
    if (target) {
      try {
        emit('info', '── BROWSER CHECK (SEO + PERFORMANCE) ──');
        const browser = await runBrowserCheck(target.url, emit);
        summary.seo         = browser.seo.status;
        summary.performance = browser.performance.status;
        metrics.loadTimeMs  = browser.performance.loadTimeMs;
        if (browser.seo.skipReason) metrics.seoSkipReason = browser.seo.skipReason;
        issues.push(...browser.seo.issues);
        issues.push(...browser.performance.issues);
        issues.push(...browser.consoleErrors);
      } catch (e) {
        emit('error', `Browser check crashed: ${String(e)}`);
        summary.seo         = 'fail';
        summary.performance = 'fail';
      }
    }

    const status = overallStatus(summary);
    const completedAt = new Date().toISOString();

    const result: QAResult = {
      projectId: project.id,
      projectName: project.name,
      runId,
      status,
      summary,
      issues,
      metrics,
      timestamp: startedAt,
      completedAt,
    };

    saveResult(result);
    activeRuns.delete(project.id);

    emit(
      status === 'pass' ? 'success' : status === 'warning' ? 'warn' : 'error',
      `── QA COMPLETE: ${status.toUpperCase()} — ${issues.length} issue(s) found ──`
    );

    broadcast({ type: 'result', runId, projectId: project.id, data: result });
  })();

  return runId;
}
