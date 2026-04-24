import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { wsEmitter } from './services/wsEmitter';
import projectsRouter from './controllers/projectsController';
import runRouter from './controllers/runController';
import resultsRouter from './controllers/resultsController';
import systemRouter from './controllers/systemController';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(cors({ origin: true })); // allow all localhost origins for internal tool
app.use(express.json());

app.use('/api/projects', projectsRouter);
app.use('/api/run', runRouter);
app.use('/api/results', resultsRouter);
app.use('/api/system', systemRouter);

app.get('/api', (_req, res) => {
  res.json({
    name: 'QA Control Center API',
    status: 'running',
    uptime: Math.round(process.uptime()),
    routes: {
      projects: 'GET /api/projects',
      run:      'POST /api/run/:projectId',
      results:  'GET /api/results/:projectId',
      health:   'GET /api/health',
    },
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'connected', message: 'QA Control Center connected' }));
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

wsEmitter.on('broadcast', (message: unknown) => {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n  QA Control Center API  →  http://localhost:${PORT}/api`);
  console.log(`  WebSocket              →  ws://localhost:${PORT}`);
  console.log(`  Projects               →  http://localhost:${PORT}/api/projects\n`);
});
