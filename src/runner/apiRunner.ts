import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { logger } from '../utils/logger';

export interface ApiCheckResult {
  endpoint: string;
  method: string;
  statusCode: number | null;
  reachable: boolean;
  requiresAuth: boolean;
  responseTimeMs: number;
  error: string | null;
}

export interface ApiRunResult {
  projectName: string;
  baseUrl: string;
  checks: ApiCheckResult[];
  passCount: number;
  failCount: number;
}

const COMMON_ENDPOINTS = [
  { path: '/', method: 'GET' },
  { path: '/api', method: 'GET' },
  { path: '/api/health', method: 'GET' },
  { path: '/api/status', method: 'GET' },
  { path: '/api/v1', method: 'GET' },
  { path: '/health', method: 'GET' },
];

function httpGet(urlStr: string, timeoutMs = 10000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      reject(new Error(`Invalid URL: ${urlStr}`));
      return;
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, headers: { 'User-Agent': 'QA-System/1.0' } },
      (res) => {
        let body = '';
        res.on('data', (d: Buffer) => { body += d.toString(); });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
  });
}

async function checkEndpoint(baseUrl: string, endpoint: { path: string; method: string }): Promise<ApiCheckResult> {
  const url = baseUrl.replace(/\/$/, '') + endpoint.path;
  const start = Date.now();

  try {
    const { status } = await httpGet(url);
    const responseTimeMs = Date.now() - start;
    return {
      endpoint: url,
      method: endpoint.method,
      statusCode: status,
      reachable: true,
      requiresAuth: status === 401 || status === 403,
      responseTimeMs,
      error: null,
    };
  } catch (e) {
    return {
      endpoint: url,
      method: endpoint.method,
      statusCode: null,
      reachable: false,
      requiresAuth: false,
      responseTimeMs: Date.now() - start,
      error: String(e),
    };
  }
}

export async function runApiTest(projectName: string, baseUrl: string): Promise<ApiRunResult> {
  logger.step(projectName, `API test on ${baseUrl}`);
  const checks = await Promise.all(COMMON_ENDPOINTS.map((ep) => checkEndpoint(baseUrl, ep)));

  const passCount = checks.filter((c) => c.reachable && (c.statusCode ?? 0) < 500).length;
  const failCount = checks.filter((c) => !c.reachable || (c.statusCode ?? 0) >= 500).length;

  logger.info(`${projectName} API: ${passCount} pass / ${failCount} fail`);
  return { projectName, baseUrl, checks, passCount, failCount };
}
