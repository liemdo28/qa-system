import * as path from 'path';
import * as fs from 'fs-extra';
import { Page } from 'playwright';
import { logger } from '../utils/logger';

export async function takeScreenshot(
  page: Page,
  outputDir: string,
  name: string
): Promise<string> {
  fs.ensureDirSync(outputDir);
  const safeName = name.replace(/[^a-z0-9\-_]/gi, '_').toLowerCase();
  const filePath = path.join(outputDir, `${safeName}.png`);

  try {
    await page.screenshot({ path: filePath, fullPage: true });
    logger.debug(`Screenshot: ${filePath}`);
    return filePath;
  } catch (e) {
    logger.warn(`Screenshot failed for ${name}: ${String(e)}`);
    return '';
  }
}

export async function screenshotAllViewports(
  page: Page,
  outputDir: string,
  name: string
): Promise<{ desktop: string; mobile: string }> {
  await page.setViewportSize({ width: 1280, height: 900 });
  const desktop = await takeScreenshot(page, outputDir, `${name}_desktop`);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await takeScreenshot(page, outputDir, `${name}_mobile`);

  await page.setViewportSize({ width: 1280, height: 900 });
  return { desktop, mobile };
}
