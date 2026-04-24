import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execSync } from 'child_process';
import {
  startService, stopAll, stopService,
  getAllServices, getServiceLogs, ServiceCommand,
} from '../services/processManager';
import { broadcast } from '../services/wsEmitter';
import { WSMessage } from '../qa-engine/types';
import { detectBuildType } from '../qa-engine/checks/buildCheck';

const router = Router();

interface BuildConfig {
  enabled?: boolean;
}

interface ProjectConfig {
  id: string;
  name: string;
  enabled?: boolean;
  localPath?: string;
  repo?: string;
  type?: string;
  commands?: { install?: string };
  build?: BuildConfig;
  services?: ServiceCommand[];
}

function loadProjects(): ProjectConfig[] {
  const cfg = fs.readJsonSync(
    path.join(__dirname, '../../config/projects.json')
  ) as { projects: ProjectConfig[] };
  return cfg.projects;
}

function emitProgress(step: number, total: number, message: string): void {
  broadcast({ type: 'system_progress', step, total, message } as WSMessage);
}

function emitStatus(): void {
  broadcast({ type: 'system_status', services: getAllServices() } as WSMessage);
}

function shouldInstall(p: ProjectConfig): boolean {
  if (p.build?.enabled === false) return false;
  if (!p.localPath) return false;
  if (!fs.pathExistsSync(p.localPath)) return false;
  if (!fs.pathExistsSync(path.join(p.localPath, 'package.json'))) return false;
  return true;
}

let isStarting = false;

// POST /api/system/start
router.post('/start', (req: Request, res: Response) => {
  if (isStarting) {
    res.status(409).json({ status: 'already_starting', services: getAllServices() });
    return;
  }
  isStarting = true;

  const projects = loadProjects().filter((p) => p.enabled !== false);
  res.json({ status: 'starting', projectCount: projects.length });

  void (async () => {
    try {
      const TOTAL_STEPS = 5;

      // Step 1 — validate paths
      emitProgress(1, TOTAL_STEPS, 'Checking project config…');
      const validProjects: ProjectConfig[] = [];
      for (const p of projects) {
        if (!p.localPath) {
          emitProgress(1, TOTAL_STEPS, `[warn] ${p.name} — no localPath configured`);
          continue;
        }
        if (!fs.pathExistsSync(p.localPath)) {
          emitProgress(1, TOTAL_STEPS, `[warn] ${p.name} — localPath not found: ${p.localPath}`);
          continue;
        }
        validProjects.push(p);
      }

      // Step 2 — detect types
      emitProgress(2, TOTAL_STEPS, 'Detecting project types…');
      for (const p of validProjects) {
        if (!p.localPath) continue;
        const detected = detectBuildType(p.localPath);
        const effective = p.build?.enabled === false ? 'skip-build' : detected;
        emitProgress(2, TOTAL_STEPS, `${p.name} → ${effective}`);
      }

      // Step 3 — install dependencies
      emitProgress(3, TOTAL_STEPS, 'Installing dependencies where needed…');
      for (const p of validProjects) {
        if (!shouldInstall(p)) {
          const reason = p.build?.enabled === false
            ? 'build disabled'
            : !fs.pathExistsSync(path.join(p.localPath ?? '', 'package.json'))
            ? 'no package.json'
            : 'localPath missing';
          emitProgress(3, TOTAL_STEPS, `${p.name} — skipping install (${reason})`);
          continue;
        }

        const nmPath = path.join(p.localPath!, 'node_modules');
        if (fs.pathExistsSync(nmPath)) {
          emitProgress(3, TOTAL_STEPS, `${p.name} — dependencies already installed`);
          continue;
        }

        const installCmd = p.commands?.install ?? 'npm install';
        emitProgress(3, TOTAL_STEPS, `${p.name} — installing (${installCmd})…`);
        try {
          execSync(installCmd, { cwd: p.localPath!, timeout: 180000, stdio: 'ignore' });
          emitProgress(3, TOTAL_STEPS, `${p.name} — install complete`);
        } catch {
          emitProgress(3, TOTAL_STEPS, `[warn] ${p.name} — install failed, continuing`);
        }
      }

      // Step 4 — start services
      emitProgress(4, TOTAL_STEPS, 'Starting services…');
      const onChange = (): void => emitStatus();

      for (const p of validProjects) {
        if (!p.services?.length) {
          emitProgress(4, TOTAL_STEPS, `${p.name} — no services configured`);
          continue;
        }
        for (let i = 0; i < p.services.length; i++) {
          const svc = p.services[i];
          emitProgress(4, TOTAL_STEPS, `Starting: ${p.name} — ${svc.name}`);
          startService(p.id, p.name, svc, i, onChange);
        }
      }

      emitStatus();

      // Step 5 — done
      emitProgress(TOTAL_STEPS, TOTAL_STEPS, 'All systems ready!');
      emitStatus();

    } finally {
      isStarting = false;
    }
  })();
});

// POST /api/system/stop
router.post('/stop', (_req: Request, res: Response) => {
  stopAll(() => emitStatus());
  res.json({ status: 'stopped' });
});

// POST /api/system/stop/:serviceId
router.post('/stop/:serviceId', (req: Request, res: Response) => {
  const serviceId = decodeURIComponent(String(req.params['serviceId']));
  stopService(serviceId, () => emitStatus());
  res.json({ status: 'stopped', serviceId });
});

// GET /api/system/status
router.get('/status', (_req: Request, res: Response) => {
  const services = getAllServices();
  const running  = services.filter((s) => s.status === 'running' || s.status === 'already_running').length;
  const failed   = services.filter((s) => s.status === 'failed').length;
  const stopped  = services.filter((s) => s.status === 'stopped').length;

  let status = 'idle';
  if (services.length > 0) {
    if (failed > 0 && running === 0) status = 'failed';
    else if (running > 0) status = running === services.length - stopped ? 'running' : 'partial';
    else status = 'partial';
  }

  res.json({ status, running, failed, total: services.length, services });
});

// GET /api/system/logs/:serviceId
router.get('/logs/:serviceId', (req: Request, res: Response) => {
  const serviceId = decodeURIComponent(String(req.params['serviceId']));
  const logs = getServiceLogs(serviceId);
  res.json({ serviceId, logs });
});

export default router;
