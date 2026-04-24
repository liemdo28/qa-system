import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execSync } from 'child_process';
import {
  startService, stopAll, stopService,
  getAllServices, getServiceLogs, StartCommand,
} from '../services/processManager';
import { broadcast } from '../services/wsEmitter';
import { WSMessage } from '../qa-engine/types';

const router = Router();

interface ProjectConfig {
  id: string;
  name: string;
  enabled?: boolean;
  localPath?: string;
  repo?: string;
  commands?: { install?: string };
  startCommands?: StartCommand[];
}

function loadProjects(): ProjectConfig[] {
  const cfg = fs.readJsonSync(path.join(__dirname, '../../config/projects.json')) as { projects: ProjectConfig[] };
  return cfg.projects;
}

function emitProgress(step: number, total: number, message: string): void {
  broadcast({ type: 'system_progress', step, total, message } as WSMessage);
}

function emitStatus(): void {
  broadcast({ type: 'system_status', services: getAllServices() } as WSMessage);
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
      const total = projects.length;

      // Step 1 — install deps for projects missing node_modules
      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        emitProgress(i, total, `Checking ${p.name}…`);

        if (p.localPath && fs.pathExistsSync(p.localPath)) {
          const hasPkg = fs.pathExistsSync(path.join(p.localPath, 'package.json'));
          const hasNm  = fs.pathExistsSync(path.join(p.localPath, 'node_modules'));

          if (hasPkg && !hasNm) {
            emitProgress(i, total, `Installing ${p.name} dependencies…`);
            try {
              const cmd = p.commands?.install ?? 'npm install';
              execSync(cmd, { cwd: p.localPath, timeout: 180000, stdio: 'ignore' });
              emitProgress(i, total, `${p.name} — dependencies installed`);
            } catch {
              emitProgress(i, total, `[warn] ${p.name} install failed — continuing`);
            }
          }
        }
      }

      // Step 2 — start all services
      emitProgress(total, total, 'Starting all services…');
      const onChange = (): void => emitStatus();

      for (const p of projects) {
        if (!p.startCommands?.length) continue;
        for (let i = 0; i < p.startCommands.length; i++) {
          startService(p.id, p.name, p.startCommands[i], i, onChange);
          emitProgress(total, total, `Started: ${p.name} — ${p.startCommands[i].name}`);
        }
      }

      emitProgress(total, total, 'All systems ready!');
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
  const running  = services.filter((s) => s.status === 'running').length;
  const failed   = services.filter((s) => s.status === 'failed').length;
  const stopped  = services.filter((s) => s.status === 'stopped').length;

  let status = 'idle';
  if (services.length > 0) {
    if (failed > 0 && running === 0) status = 'failed';
    else if (running === services.length - stopped) status = 'running';
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
