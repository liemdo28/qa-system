import { chromium } from 'playwright';
import { CheckStatus, QAIssue } from '../types';

export interface SeoCheckResult {
  status: CheckStatus;
  issues: QAIssue[];
  hasTitle: boolean;
  hasDescription: boolean;
  hasOgTitle: boolean;
  skipReason?: string;
}

export interface PerformanceCheckResult {
  status: CheckStatus;
  loadTimeMs: number;
  issues: QAIssue[];
}

export interface BrowserCheckResult {
  seo: SeoCheckResult;
  performance: PerformanceCheckResult;
  consoleErrors: QAIssue[];
}

const PERF_WARN_MS = 3000;
const PERF_FAIL_MS = 8000;

const AUTH_URL_PATTERN   = /\/(login|signin|sign-in|auth|sso|oauth|password|session)/i;
const AUTH_TITLE_PATTERN = /^(sign\s*in|log\s*in|login|authentication|welcome\s*back)/i;

function isAuthPage(url: string, title: string): boolean {
  return AUTH_URL_PATTERN.test(url) || AUTH_TITLE_PATTERN.test(title.trim());
}

export async function runBrowserCheck(
  url: string,
  emit: (level: string, msg: string) => void
): Promise<BrowserCheckResult> {
  const seoIssues: QAIssue[]   = [];
  const perfIssues: QAIssue[]  = [];
  const consoleErrors: QAIssue[] = [];

  emit('info', 'Launching browser for SEO + performance check');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        type: 'console_error',
        message: msg.text().substring(0, 300),
        severity: 'medium',
      });
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push({
      type: 'console_error',
      message: `JS error: ${err.message.substring(0, 300)}`,
      severity: 'high',
    });
  });

  const start = Date.now();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  } catch (e) {
    emit('error', `Browser navigation failed: ${String(e)}`);
    await browser.close();
    return {
      seo: {
        status: 'fail',
        issues: [{ type: 'broken_link', url, message: `Navigation failed: ${String(e)}`, severity: 'critical' }],
        hasTitle: false, hasDescription: false, hasOgTitle: false,
      },
      performance: { status: 'fail', loadTimeMs: 0, issues: [] },
      consoleErrors,
    };
  }
  const loadTimeMs = Date.now() - start;

  const finalUrl = page.url();
  const title    = await page.title().catch(() => '');

  // ── Login / auth redirect detection ────────────────────────────────────────
  if (isAuthPage(finalUrl, title)) {
    const skipReason = `AUTH_REQUIRED — redirected to: ${finalUrl}`;
    emit('warn', `[WARN] Redirected to login page: ${finalUrl}`);
    emit('info', '[SKIP] SEO check skipped — authentication required');

    // Performance still valid (we did load the redirect page)
    let perfStatus: CheckStatus = 'pass';
    if (loadTimeMs > PERF_FAIL_MS) {
      perfStatus = 'fail';
      perfIssues.push({ type: 'performance_slow', message: `Load time ${loadTimeMs}ms exceeds ${PERF_FAIL_MS}ms threshold`, severity: 'high' });
    } else if (loadTimeMs > PERF_WARN_MS) {
      perfStatus = 'warning';
      perfIssues.push({ type: 'performance_slow', message: `Load time ${loadTimeMs}ms is above ${PERF_WARN_MS}ms target`, severity: 'medium' });
    }

    await browser.close();
    return {
      seo: { status: 'skip', issues: [], hasTitle: false, hasDescription: false, hasOgTitle: false, skipReason },
      performance: { status: perfStatus, loadTimeMs, issues: perfIssues },
      consoleErrors,
    };
  }

  // ── SEO checks ─────────────────────────────────────────────────────────────
  const metaDesc  = await page.$eval('meta[name="description"]',    (el) => el.getAttribute('content') ?? '').catch(() => '');
  const ogTitle   = await page.$eval('meta[property="og:title"]',   (el) => el.getAttribute('content') ?? '').catch(() => '');
  const ogDesc    = await page.$eval('meta[property="og:description"]', (el) => el.getAttribute('content') ?? '').catch(() => '');
  const canonical = await page.$eval('link[rel="canonical"]',       (el) => el.getAttribute('href') ?? '').catch(() => '');

  if (!title) {
    seoIssues.push({ type: 'seo_missing', message: 'Missing <title> tag', severity: 'high' });
  }
  if (!metaDesc) {
    seoIssues.push({ type: 'seo_missing', message: 'Missing meta[name="description"]', severity: 'medium' });
  }
  if (!ogTitle) {
    seoIssues.push({ type: 'seo_missing', message: 'Missing og:title meta tag', severity: 'low' });
  }
  if (!ogDesc) {
    seoIssues.push({ type: 'seo_missing', message: 'Missing og:description meta tag', severity: 'low' });
  }
  if (!canonical) {
    seoIssues.push({ type: 'seo_missing', message: 'Missing canonical link tag', severity: 'low' });
  }

  // Only HIGH severity issues fail SEO; LOW/MEDIUM → warning
  let seoStatus: CheckStatus = 'pass';
  if (seoIssues.some((i) => i.severity === 'high' || i.severity === 'critical')) {
    seoStatus = 'fail';
  } else if (seoIssues.length > 0) {
    seoStatus = 'warning';
  }

  emit(seoStatus === 'pass' ? 'success' : 'warn',
    `SEO: ${seoIssues.length} issue(s) | Title: "${title.substring(0, 50)}"`);

  // ── Performance ────────────────────────────────────────────────────────────
  let perfStatus: CheckStatus = 'pass';
  if (loadTimeMs > PERF_FAIL_MS) {
    perfStatus = 'fail';
    perfIssues.push({ type: 'performance_slow', message: `Load time ${loadTimeMs}ms exceeds ${PERF_FAIL_MS}ms threshold`, severity: 'high' });
  } else if (loadTimeMs > PERF_WARN_MS) {
    perfStatus = 'warning';
    perfIssues.push({ type: 'performance_slow', message: `Load time ${loadTimeMs}ms is above ${PERF_WARN_MS}ms target`, severity: 'medium' });
  }

  emit(perfStatus === 'pass' ? 'success' : 'warn', `Performance: ${loadTimeMs}ms load time`);

  if (consoleErrors.length > 0) {
    emit('warn', `Console errors: ${consoleErrors.length} found`);
  }

  await browser.close();

  return {
    seo: { status: seoStatus, issues: seoIssues, hasTitle: !!title, hasDescription: !!metaDesc, hasOgTitle: !!ogTitle },
    performance: { status: perfStatus, loadTimeMs, issues: perfIssues },
    consoleErrors,
  };
}
