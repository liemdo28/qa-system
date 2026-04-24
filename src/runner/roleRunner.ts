import * as path from 'path';
import { createContext, newPage, navigateTo, attachNetworkLogger } from '../browser/playwright';
import { takeScreenshot } from '../browser/screenshot';
import { saveContextVideo } from '../browser/video';
import { logger } from '../utils/logger';
import { UIIssue } from './uiRunner';

export interface RoleConfig {
  name: string;
  envEmail: string;
  envPassword: string;
  goal: string;
}

export interface RoleTestResult {
  role: string;
  url: string;
  loginAttempted: boolean;
  loginSuccess: boolean;
  dashboardAccessible: boolean;
  permissionIssues: string[];
  issues: UIIssue[];
  screenshotPaths: string[];
  videoPath: string;
  durationMs: number;
}

async function attemptLogin(
  page: ReturnType<typeof newPage> extends Promise<infer T> ? T : never,
  url: string,
  email: string,
  password: string,
  project: string,
  role: string,
  screenshotDir: string,
  networkErrors: ReturnType<typeof attachNetworkLogger>,
  issues: UIIssue[]
): Promise<boolean> {
  await navigateTo(page, url);

  const emailSel = 'input[type="email"], input[name="email"], input[name="username"], input[placeholder*="email" i]';
  const passSel = 'input[type="password"]';
  const submitSel = 'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in")';

  try {
    await page.waitForSelector(emailSel, { timeout: 8000 });
    await page.fill(emailSel, email);
    await page.fill(passSel, password);
    await page.click(submitSel);
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    const loginFailed = currentUrl === url || currentUrl.includes('login') || currentUrl.includes('error');

    const shot = await takeScreenshot(page, screenshotDir, `${role}_login_result`);
    if (loginFailed) {
      issues.push({
        project,
        pageUrl: url,
        role,
        step: 'Login',
        expected: 'Successful login and redirect to dashboard',
        actual: `Still on login page or error page: ${currentUrl}`,
        screenshotPath: shot,
        videoPath: '',
        consoleErrors: [...networkErrors.consoleErrors],
        networkErrors: [...networkErrors.failedRequests],
        severity: 'HIGH',
        suggestedFix: 'Verify login credentials and form selectors match actual login form',
      });
      return false;
    }
    return true;
  } catch (e) {
    const shot = await takeScreenshot(page, screenshotDir, `${role}_login_error`);
    issues.push({
      project,
      pageUrl: url,
      role,
      step: 'Login form interaction',
      expected: 'Login form is found and fillable',
      actual: `Could not interact with login form: ${String(e)}`,
      screenshotPath: shot,
      videoPath: '',
      consoleErrors: [...networkErrors.consoleErrors],
      networkErrors: [...networkErrors.failedRequests],
      severity: 'CRITICAL',
      suggestedFix: 'Login page selector may have changed. Update emailSel/passSel/submitSel.',
    });
    return false;
  }
}

export async function runRoleTest(
  projectName: string,
  url: string,
  role: RoleConfig,
  screenshotDir: string,
  videoDir: string
): Promise<RoleTestResult> {
  logger.step(projectName, `Role test: ${role.name}`);
  const start = Date.now();
  const issues: UIIssue[] = [];
  const screenshots: string[] = [];
  const permissionIssues: string[] = [];

  const email = process.env[role.envEmail] || '';
  const password = process.env[role.envPassword] || '';

  if (!email || !password) {
    logger.warn(`No credentials for role ${role.name} — skipping login test`);
    return {
      role: role.name, url,
      loginAttempted: false, loginSuccess: false, dashboardAccessible: false,
      permissionIssues: [`Credentials not set: ${role.envEmail} / ${role.envPassword}`],
      issues, screenshotPaths: screenshots, videoPath: '',
      durationMs: Date.now() - start,
    };
  }

  const videoEnabled = process.env.QA_VIDEO_RECORDING_ENABLED !== 'false';
  const context = await createContext({ recordVideo: videoEnabled ? videoDir : undefined });
  const page = await newPage(context);
  const networkErrors = attachNetworkLogger(page);

  const loginSuccess = await attemptLogin(
    page, url, email, password, projectName, role.name, screenshotDir, networkErrors, issues
  );

  let dashboardAccessible = false;
  if (loginSuccess) {
    const shot = await takeScreenshot(page, screenshotDir, `${role.name}_dashboard`);
    screenshots.push(shot);
    dashboardAccessible = true;

    // Check for forbidden/unauthorized indicators
    const pageText = await page.innerText('body').catch(() => '');
    if (/403|forbidden|unauthorized|access denied/i.test(pageText)) {
      permissionIssues.push(`${role.name} sees permission error on dashboard`);
    }
  }

  let videoPath = '';
  if (videoEnabled) {
    videoPath = await saveContextVideo(context, videoDir, `${projectName}_${role.name}`);
  } else {
    await context.close();
  }

  const durationMs = Date.now() - start;
  logger.info(`Role ${role.name}: login=${loginSuccess}, dashboard=${dashboardAccessible}, issues=${issues.length}`);

  return {
    role: role.name, url,
    loginAttempted: true, loginSuccess, dashboardAccessible,
    permissionIssues, issues,
    screenshotPaths: screenshots.filter(Boolean),
    videoPath, durationMs,
  };
}
