import { QAResult } from '../qa-engine/types';

const MAX_HISTORY = 20;
const store = new Map<string, QAResult[]>();

export function saveResult(result: QAResult): void {
  const history = store.get(result.projectId) ?? [];
  history.unshift(result);
  if (history.length > MAX_HISTORY) history.pop();
  store.set(result.projectId, history);
}

export function getLatestResult(projectId: string): QAResult | null {
  return store.get(projectId)?.[0] ?? null;
}

export function getHistory(projectId: string): QAResult[] {
  return store.get(projectId) ?? [];
}

export function getAllLatest(): Record<string, QAResult> {
  const result: Record<string, QAResult> = {};
  for (const [id, history] of store.entries()) {
    if (history[0]) result[id] = history[0];
  }
  return result;
}
