import * as path from 'path';
import { Page, BrowserContext } from 'playwright';
import { createContext, newPage, navigateTo, attachNetworkLogger } from '../browser/playwright';
import { takeScreenshot, screenshotAllViewports } from '../browser/screenshot';
import { saveContextVideo } from '../browser/video';
import { logger } from '../utils/logger';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface UIIssue {
  project: string;
  pageUrl: string;
  role: string;
  step: string;
  expected: string;
  actual: string;
  screenshotPath: string;
  videoPath: string;
  consoleErrors: string[];
  networkErrors: string[];
  severity: Severity;
  suggestedFix: string;
}

export interface UIRunResult {
  projectName: string;
  url: string;
  role: string;
  pagesChecked: number;
  issues: UIIssue[];
  screenshotPaths: string[];
  videoPath: string;
  durationMs: number;
}

interface CheckContext {
  page: Page;
  url: string;
  project: string;
  role: string;
  screenshotDir: string;
  networkErrors: ReturnType<typeof attachNetworkLogger>;
  issues: UIIssue[];
  screenshots: string[];
}

async function checkVisible(
  ctx: CheckContext,
  selector: string,
  label: string,
  severity: Severity = 'MEDIUM'
): Promise<boolean> {
  try {
    const el = await ctx.page.$(selector);
    if (!el || !(await el.isVisible())) {
      const shot = await takeScreenshot(ctx.page, ctx.screenshotDir, `${label}_missing`);
      ctx.issues.push({
        project: ctx.project,
        pageUrl: ctx.url,
        role: ctx.role,
        step: `Check visibility: ${label}`,
        expected: `${label} is visible`,
        actual: `${label} not found or hidden`,
        screenshotPath: shot,
        videoPath: '',
        consoleErrors: [...ctx.networkErrors.consoleErrors],
        networkErrors: [...ctx.networkErrors.failedRequests],
        severity,
        suggestedFix: `Ensure selector "${selector}" exists and is visible on ${ctx.url}`,
      });
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function checkPageLoad(ctx: CheckContext): Promise<void> {
  const loaded = await navigateTo(ctx.page, ctx.url);
  if (!loaded) {
    ctx.issues.push({
      project: ctx.project,
      pageUrl: ctx.url,
      role: ctx.role,
      step: 'Page load',
      expected: 'Page loads successfully (HTTP 200)',
      actual: 'Page failed to load or returned error status',
      screenshotPath: '',
      videoPath: '',
      consoleErrors: [...ctx.networkErrors.consoleErrors],
      networkErrors: [...ctx.networkErrors.failedRequests],
      severity: 'CRITICAL',
      suggestedFix: 'Check server is running and URL is correct',
    });
  }

  const shots = await screenshotAllViewports(ctx.page, ctx.screenshotDir, 'homepage');
  ctx.screenshots.push(shots.desktop, shots.mobile);
}

async function checkNavigation(ctx: CheckContext): Promise<void> {
  const navSelectors = [
    { sel: 'nav', label: 'Navigation bar' },
    { sel: 'header', label: 'Header' },
    { sel: '[role="navigation"]', label: 'ARIA navigation' },
    { sel: 'footer', label: 'Footer' },
  ];
  for (const { sel, label } of navSelectors) {
    await checkVisible(ctx, sel, label, 'LOW');
  }
  const shot = await takeScreenshot(ctx.page, ctx.screenshotDir, 'navigation');
  ctx.screenshots.push(shot);
}

async function checkButtons(ctx: CheckContext): Promise<void> {
  try {
    const buttons = await ctx.page.$$('button:visible, [role="button"]:visible, a[href]:visible');
    if (buttons.length === 0) {
      ctx.issues.push({
        project: ctx.project,
        pageUrl: ctx.url,
        role: ctx.role,
        step: 'Button check',
        expected: 'At least one interactive button on page',
        actual: 'No visible buttons found',
        screenshotPath: '',
        videoPath: '',
        consoleErrors: [],
        networkErrors: [],
        severity: 'LOW',
        suggestedFix: 'Verify page rendered correctly — expected interactive elements',
      });
    }
    logger.debug(`Found ${buttons.length} buttons on ${ctx.url}`);
  } catch (e) {
    logger.warn(`Button check failed: ${String(e)}`);
  }
}

async function checkForms(ctx: CheckContext): Promise<void> {
  try {
    const forms = await ctx.page.$$('form:visible');
    if (forms.length > 0) {
      const shot = await takeScreenshot(ctx.page, ctx.screenshotDir, 'forms');
      ctx.screenshots.push(shot);
    }
  } catch (e) {
    logger.warn(`Form check failed: ${String(e)}`);
  }
}

async function checkMobileLayout(ctx: CheckContext): Promise<void> {
  await ctx.page.setViewportSize({ width: 390, height: 844 });
  try {
    const overflowScript = `
      Array.from(document.querySelectorAll('*')).some(el => {
        return el.scrollWidth > document.body.clientWidth;
      })
    `;
    const hasOverflow = await ctx.page.evaluate(overflowScript);
    if (hasOverflow) {
      const shot = await takeScreenshot(ctx.page, ctx.screenshotDir, 'mobile_overflow');
      ctx.screenshots.push(shot);
      ctx.issues.push({
        project: ctx.project,
        pageUrl: ctx.url,
        role: ctx.role,
        step: 'Mobile layout check',
        expected: 'No horizontal overflow on mobile (390px)',
        actual: 'Horizontal overflow detected — content wider than viewport',
        screenshotPath: shot,
        videoPath: '',
        consoleErrors: [],
        networkErrors: [],
        severity: 'MEDIUM',
        suggestedFix: 'Add responsive CSS: overflow-x:hidden or fix wide elements',
      });
    }
  } catch (e) {
    logger.warn(`Mobile layout check failed: ${String(e)}`);
  }
  await ctx.page.setViewportSize({ width: 1280, height: 900 });
}

export async function runUITest(
  projectName: string,
  url: string,
  role: string,
  screenshotDir: string,
  videoDir: string
): Promise<UIRunResult> {
  logger.step(projectName, `UI test as ${role} on ${url}`);
  const start = Date.now();
  const issues: UIIssue[] = [];
  const screenshots: string[] = [];

  const videoEnabled = process.env.QA_VIDEO_RECORDING_ENABLED !== 'false';
  const context = await createContext({ recordVideo: videoEnabled ? videoDir : undefined });
  const page = await newPage(context);
  const networkErrors = attachNetworkLogger(page);

  const ctx: CheckContext = {
    page,
    url,
    project: projectName,
    role,
    screenshotDir,
    networkErrors,
    issues,
    screenshots,
  };

  try {
    await checkPageLoad(ctx);
    await checkNavigation(ctx);
    await checkButtons(ctx);
    await checkForms(ctx);
    await checkMobileLayout(ctx);
  } catch (e) {
    logger.error(`UI test error for ${projectName}: ${String(e)}`);
  }

  let videoPath = '';
  if (videoEnabled) {
    videoPath = await saveContextVideo(context, videoDir, `${projectName}_${role}`);
  } else {
    await context.close();
  }

  const durationMs = Date.now() - start;
  logger.info(`UI test done: ${projectName} (${role}) — ${issues.length} issue(s) in ${durationMs}ms`);

  return {
    projectName,
    url,
    role,
    pagesChecked: 1,
    issues,
    screenshotPaths: screenshots.filter(Boolean),
    videoPath,
    durationMs,
  };
}
