import { Router, Request, Response } from 'express';
import * as path from 'path';
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

router.get('/', (_req: Request, res: Response) => {
  try {
    const projects = loadProjects();
    res.json({ projects });
  } catch (e) {
    res.status(500).json({ error: `Failed to load projects: ${String(e)}` });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const projects = loadProjects();
    const project = projects.find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
