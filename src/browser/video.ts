import * as path from 'path';
import * as fs from 'fs-extra';
import { BrowserContext } from 'playwright';
import { logger } from '../utils/logger';

export async function saveContextVideo(
  context: BrowserContext,
  outputDir: string,
  name: string
): Promise<string> {
  fs.ensureDirSync(outputDir);
  try {
    const pages = context.pages();
    if (pages.length === 0) return '';

    const page = pages[pages.length - 1];
    const video = page.video();
    if (!video) return '';

    const safeName = name.replace(/[^a-z0-9\-_]/gi, '_').toLowerCase();
    const destPath = path.join(outputDir, `${safeName}.webm`);

    await context.close();
    const videoPath = await video.path();
    if (videoPath) {
      fs.moveSync(videoPath, destPath, { overwrite: true });
      logger.debug(`Video saved: ${destPath}`);
      return destPath;
    }
    return '';
  } catch (e) {
    logger.warn(`Video save failed: ${String(e)}`);
    try { await context.close(); } catch { /* ignore */ }
    return '';
  }
}
