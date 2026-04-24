import * as fs from 'fs-extra';
import * as path from 'path';
import fg from 'fast-glob';

export function ensureDir(dirPath: string): void {
  fs.ensureDirSync(dirPath);
}

export function writeJson(filePath: string, data: unknown): void {
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeJsonSync(filePath, data, { spaces: 2 });
}

export function readJson<T>(filePath: string): T {
  return fs.readJsonSync(filePath) as T;
}

export function writeText(filePath: string, content: string): void {
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function appendText(filePath: string, content: string): void {
  fs.ensureDirSync(path.dirname(filePath));
  fs.appendFileSync(filePath, content, 'utf-8');
}

export function pathExists(filePath: string): boolean {
  return fs.pathExistsSync(filePath);
}

export function copyFile(src: string, dest: string): void {
  fs.ensureDirSync(path.dirname(dest));
  fs.copySync(src, dest);
}

export async function findFiles(pattern: string, cwd: string): Promise<string[]> {
  return fg(pattern, { cwd, absolute: true, followSymbolicLinks: false });
}

export function getRunDir(baseDir: string): string {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .substring(0, 19);
  const runDir = path.join(baseDir, stamp);
  fs.ensureDirSync(path.join(runDir, 'screenshots'));
  fs.ensureDirSync(path.join(runDir, 'videos'));
  fs.ensureDirSync(path.join(runDir, 'logs'));
  return runDir;
}
