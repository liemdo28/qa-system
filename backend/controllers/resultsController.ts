import { Router, Request, Response } from 'express';
import { getLatestResult, getHistory, getAllLatest } from '../services/resultStore';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const all = getAllLatest();
  res.json({ results: all });
});

router.get('/:projectId', (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  if (!/^[a-zA-Z0-9\-_]+$/.test(projectId)) {
    res.status(400).json({ error: 'Invalid project ID' });
    return;
  }
  const result = getLatestResult(projectId);
  if (!result) {
    res.status(404).json({ error: 'No results found for this project' });
    return;
  }
  res.json({ result });
});

router.get('/:projectId/history', (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  if (!/^[a-zA-Z0-9\-_]+$/.test(projectId)) {
    res.status(400).json({ error: 'Invalid project ID' });
    return;
  }
  const history = getHistory(projectId);
  res.json({ history });
});

export default router;
