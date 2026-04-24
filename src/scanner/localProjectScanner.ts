import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface LocalScanResult {
  exists: boolean;
  hasPackageJson: boolean;
  hasNodeModules: boolean;
  hasGitDir: boolean;
  hasEnvFile: boolean;
  hasEnvExample: boolean;
  hasBuildOutput: boolean;
  buildOutputDir: string | null;
  packageJsonValid: boolean;
  detectedFramework: string;
  entryPoints: string[];
  warnings: string[];
}

const FRAMEWORK_INDICATORS: { name: string; files: string[] }[] = [
  { name: 'Next.js', files: ['next.config.js', 'next.config.ts', 'next.config.mjs'] },
  { name: 'Vite', files: ['vite.config.js', 'vite.config.ts'] },
  { name: 'Create React App', files: ['src/App.tsx', 'src/App.jsx'] },
  { name: 'Vue', files: ['vue.config.js', 'src/main.vue'] },
  { name: 'Express', files: ['server.js', 'server.ts', 'app.js', 'app.ts'] },
  { name: 'Nuxt', files: ['nuxt.config.js', 'nuxt.config.ts'] },
];

const BUILD_DIRS = ['dist', 'build', '.next', 'out', 'public/build'];

export async function scanLocalProject(projectPath: string): Promise<LocalScanResult> {
  const result: LocalScanResult = {
    exists: false,
    hasPackageJson: false,
    hasNodeModules: false,
    hasGitDir: false,
    hasEnvFile: false,
    hasEnvExample: false,
    hasBuildOutput: false,
    buildOutputDir: null,
    packageJsonValid: false,
    detectedFramework: 'Unknown',
    entryPoints: [],
    warnings: [],
  };

  if (!fs.pathExistsSync(projectPath)) {
    result.warnings.push(`Project path does not exist: ${projectPath}`);
    return result;
  }

  result.exists = true;
  result.hasPackageJson = fs.pathExistsSync(path.join(projectPath, 'package.json'));
  result.hasNodeModules = fs.pathExistsSync(path.join(projectPath, 'node_modules'));
  result.hasGitDir = fs.pathExistsSync(path.join(projectPath, '.git'));
  result.hasEnvFile = fs.pathExistsSync(path.join(projectPath, '.env'));
  result.hasEnvExample = fs.pathExistsSync(path.join(projectPath, '.env.example'));

  if (result.hasEnvFile) {
    result.warnings.push('.env file found — may contain committed secrets');
  }
  if (!result.hasGitDir) {
    result.warnings.push('No .git directory — project may not be version controlled');
  }
  if (!result.hasNodeModules) {
    result.warnings.push('node_modules not found — run npm install first');
  }

  if (result.hasPackageJson) {
    try {
      const pkg = fs.readJsonSync(path.join(projectPath, 'package.json'));
      result.packageJsonValid = true;
      const scripts = pkg.scripts || {};
      if (scripts.start) result.entryPoints.push(`npm start → ${scripts.start}`);
      if (scripts.dev) result.entryPoints.push(`npm run dev → ${scripts.dev}`);
      if (scripts.build) result.entryPoints.push(`npm run build → ${scripts.build}`);
    } catch {
      result.warnings.push('package.json is not valid JSON');
    }
  }

  for (const { name, files } of FRAMEWORK_INDICATORS) {
    if (files.some((f) => fs.pathExistsSync(path.join(projectPath, f)))) {
      result.detectedFramework = name;
      break;
    }
  }

  for (const dir of BUILD_DIRS) {
    if (fs.pathExistsSync(path.join(projectPath, dir))) {
      result.hasBuildOutput = true;
      result.buildOutputDir = dir;
      break;
    }
  }

  logger.success(`Local scan: ${path.basename(projectPath)} [${result.detectedFramework}]`);
  return result;
}
