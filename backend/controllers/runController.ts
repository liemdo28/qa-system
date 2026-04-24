import { Router, Request, Response } from 'express';
import * as path from 'path';
import { runQA, isRunning } from '../qa-engine/runner';
import { Project } from '../qa-engine/types';

const router = Router();

interface ProjectsConfig {
  projects: Project[];
}

function loadProjects(): Project[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const config: ProjectsConfig = require(path.join(__dirname, '../../config/projects.json'));
  return config.projects;
}

router.post('/:projectId', async (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);

  // Validate projectId — only allow alphanumeric and hyphens
  if (!/^[a-zA-Z0-9\-_]+$/.test(projectId)) {
    res.status(400).json({ error: 'Invalid project ID format' });
    return;
  }

  const projects = loadProjects();
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    res.status(404).json({ error: `Project "${projectId}" not found` });
    return;
  }

  if (isRunning(projectId)) {
    res.status(409).json({ error: 'QA run already in progress for this project', running: true });
    return;
  }

  try {
    const runId = await runQA(project);
    res.json({ runId, projectId, message: 'QA run started' });
  } catch (e) {
    res.status(500).json({ error: `Failed to start QA run: ${String(e)}` });
  }
});

export default router;
