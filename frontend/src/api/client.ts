import { Project, QAResult } from '../types';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getProjects(): Promise<{ projects: Project[] }> {
    return get('/projects');
  },

  getResults(): Promise<{ results: Record<string, QAResult> }> {
    return get('/results');
  },

  getResult(projectId: string): Promise<{ result: QAResult }> {
    return get(`/results/${projectId}`);
  },

  runQA(projectId: string): Promise<{ runId: string; projectId: string }> {
    return post(`/run/${projectId}`);
  },
};
