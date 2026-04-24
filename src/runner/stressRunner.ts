import { URL } from 'url';
import * as https from 'https';
import * as http from 'http';
import { logger } from '../utils/logger';
import { getLimits, guardProductionStress } from '../security/safeModeGuard';

export interface StressResult {
  projectName: string;
  url: string;
  totalRequests: number;
  successCount: number;
  failCount: number;
  avgResponseMs: number;
  maxResponseMs: number;
  minResponseMs: number;
  requestsPerSecond: number;
  errorRate: number;
  safeMode: boolean;
  durationMs: number;
}

function makeRequest(urlStr: string): Promise<{ statusCode: number; durationMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      resolve({ statusCode: 0, durationMs: Date.now() - start });
      return;
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      { hostname: parsed.hostname, port: parsed.port || undefined, path: parsed.pathname, headers: { 'User-Agent': 'QA-StressTest/1.0' } },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, durationMs: Date.now() - start }));
      }
    );
    req.setTimeout(15000, () => { req.destroy(); resolve({ statusCode: 0, durationMs: Date.now() - start }); });
    req.on('error', () => resolve({ statusCode: 0, durationMs: Date.now() - start }));
  });
}

export async function runStressTest(
  projectName: string,
  url: string
): Promise<StressResult> {
  logger.step(projectName, `Stress test on ${url}`);

  const limits = getLimits();
  const safeMode = process.env.QA_SAFE_MODE !== 'false';

  try {
    guardProductionStress(url);
  } catch (e) {
    logger.warn(`${String(e)}`);
    return {
      projectName, url, totalRequests: 0, successCount: 0, failCount: 0,
      avgResponseMs: 0, maxResponseMs: 0, minResponseMs: 0, requestsPerSecond: 0,
      errorRate: 0, safeMode, durationMs: 0,
    };
  }

  const concurrency = Math.min(limits.maxUsers, 10);
  const durationMs = Math.min(limits.testDurationSeconds * 1000, 30000);
  const delayMs = Math.floor(60000 / limits.maxRequestsPerMinute);

  logger.info(`Stress: ${concurrency} concurrent users, ${durationMs / 1000}s, delay ${delayMs}ms`);

  const results: { statusCode: number; durationMs: number }[] = [];
  const start = Date.now();

  const workers = Array.from({ length: concurrency }, async () => {
    while (Date.now() - start < durationMs) {
      const r = await makeRequest(url);
      results.push(r);
      if (delayMs > 0) await new Promise((res) => setTimeout(res, delayMs));
    }
  });

  await Promise.all(workers);

  const elapsed = Date.now() - start;
  const successCount = results.filter((r) => r.statusCode >= 200 && r.statusCode < 400).length;
  const failCount = results.length - successCount;
  const durations = results.map((r) => r.durationMs);
  const avgResponseMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const maxResponseMs = durations.length ? Math.max(...durations) : 0;
  const minResponseMs = durations.length ? Math.min(...durations) : 0;
  const requestsPerSecond = Math.round((results.length / elapsed) * 1000);
  const errorRate = results.length ? Math.round((failCount / results.length) * 100) : 0;

  logger.info(`Stress done: ${results.length} req, ${successCount} ok, ${failCount} fail, avg ${avgResponseMs}ms`);

  return {
    projectName, url,
    totalRequests: results.length,
    successCount, failCount,
    avgResponseMs, maxResponseMs, minResponseMs,
    requestsPerSecond, errorRate, safeMode,
    durationMs: elapsed,
  };
}
