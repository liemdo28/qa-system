import { Router, Request, Response } from 'express';
import { getLatestResult, getHistory, getAllLatest } from '../services/resultStore';
import { generateMarkdown, getLatestReportPath } from '../qa-engine/reportGenerator';

const router = Router();

const ID_RE = /^[a-zA-Z0-9\-_]+$/;

function validateId(id: string): boolean {
  return ID_RE.test(id);
}

router.get('/', (_req: Request, res: Response) => {
  res.json({ results: getAllLatest() });
});

router.get('/:projectId', (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  if (!validateId(projectId)) { res.status(400).json({ error: 'Invalid project ID' }); return; }
  const result = getLatestResult(projectId);
  if (!result) { res.status(404).json({ error: 'No results found' }); return; }
  res.json({ result });
});

router.get('/:projectId/history', (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  if (!validateId(projectId)) { res.status(400).json({ error: 'Invalid project ID' }); return; }
  res.json({ history: getHistory(projectId) });
});

// GET /api/results/:projectId/report  → markdown string
router.get('/:projectId/report', (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  if (!validateId(projectId)) { res.status(400).json({ error: 'Invalid project ID' }); return; }
  const result = getLatestResult(projectId);
  if (!result) { res.status(404).json({ error: 'No results found' }); return; }
  res.type('text/plain').send(generateMarkdown(result));
});

// GET /api/results/:projectId/report.json → structured result with enriched issues
router.get('/:projectId/report.json', (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  if (!validateId(projectId)) { res.status(400).json({ error: 'Invalid project ID' }); return; }
  const result = getLatestResult(projectId);
  if (!result) { res.status(404).json({ error: 'No results found' }); return; }
  res.json({ report: result });
});

// GET /api/results/:projectId/report/download → download .md file
router.get('/:projectId/report/download', (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  if (!validateId(projectId)) { res.status(400).json({ error: 'Invalid project ID' }); return; }
  const result = getLatestResult(projectId);
  if (!result) { res.status(404).json({ error: 'No results found' }); return; }
  const md = generateMarkdown(result);
  const filename = `qa-report-${projectId}-${result.runId.substring(0, 8)}.md`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.type('text/markdown').send(md);
});

// GET /api/results/:projectId/report/download.json → download .json file
router.get('/:projectId/report/download.json', (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  if (!validateId(projectId)) { res.status(400).json({ error: 'Invalid project ID' }); return; }
  const result = getLatestResult(projectId);
  if (!result) { res.status(404).json({ error: 'No results found' }); return; }
  const filename = `qa-report-${projectId}-${result.runId.substring(0, 8)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(result);
});

export default router;
