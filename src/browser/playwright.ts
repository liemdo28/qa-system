import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../utils/logger';

let browser: Browser | null = null;

export async function launchBrowser(headless = true): Promise<Browser> {
  if (browser) return browser;
  logger.info('Launching Chromium browser');
  browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    logger.info('Browser closed');
  }
}

export interface ContextOptions {
  recordVideo?: string;
  mobile?: boolean;
}

export async function createContext(options: ContextOptions = {}): Promise<BrowserContext> {
  const b = await launchBrowser();
  const contextOptions: Parameters<typeof b.newContext>[0] = {
    ignoreHTTPSErrors: true,
    viewport: options.mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
  };
  if (options.recordVideo) {
    contextOptions.recordVideo = { dir: options.recordVideo, size: { width: 1280, height: 900 } };
  }
  return b.newContext(contextOptions);
}

export async function newPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      logger.debug(`[Browser Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    logger.debug(`[Page Error] ${err.message}`);
  });

  return page;
}

export async function navigateTo(page: Page, url: string, timeout = 30000): Promise<boolean> {
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout });
    if (!response) return false;
    return response.ok() || response.status() < 400;
  } catch (e) {
    logger.warn(`Navigation failed: ${url} — ${String(e)}`);
    return false;
  }
}

export interface PageNetworkErrors {
  failedRequests: string[];
  consoleErrors: string[];
}

export function attachNetworkLogger(page: Page): PageNetworkErrors {
  const errors: PageNetworkErrors = { failedRequests: [], consoleErrors: [] };

  page.on('requestfailed', (req) => {
    errors.failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.consoleErrors.push(msg.text());
    }
  });

  return errors;
}
