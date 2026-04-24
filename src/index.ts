import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';

// Load credentials from .env.qa.local (never commit this file)
const envPath = path.resolve(__dirname, '../.env.qa.local');
if (fs.pathExistsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: path.resolve(__dirname, '../.env.example') });
  console.warn('[QA] .env.qa.local not found — using .env.example (no real credentials)');
}

import { logger, setLogFile } from './utils/logger';
import { getRunDir } from './utils/fileUtils';
import { closeBrowser } from './browser/playwright';
import { runSourceHealthScan } from './scanner/sourceHealthScanner';
import { runBuild } from './runner/buildRunner';
import { runUITest } from './runner/uiRunner';
import { runApiTest } from './runner/apiRunner';
import { runStressTest } from './runner/stressRunner';
import { runRoleTest, RoleConfig } from './runner/roleRunner';
import { writeCeoSummaryReport } from './reports/ceoSummaryReport';
import { writeDevTechnicalReport } from './reports/devTechnicalReport';
import { writeJsonReport, QARunData, ProjectQAData } from './reports/jsonReport';

import projectsConfig from '../config/projects.json';
import rolesConfig from '../config/roles.json';

interface ProjectConfig {
  name: string;
  localPath: string;
  github: string;
  type: string;
  publicUrl?: string;
  adminUrl?: string;
  buildCommands?: string[];
  testLevels: string[];
}

function parseArgs(): { projectFilter?: string; levels?: string[]; reportOnly: boolean } {
  const args = process.argv.slice(2);
  let projectFilter: string | undefined;
  let levels: string[] | undefined;
  let reportOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) projectFilter = args[++i];
    if (args[i] === '--levels' && args[i + 1]) levels = args[++i].split(',');
    if (args[i] === '--report-only') reportOnly = true;
  }
  return { projectFilter, levels, reportOnly };
}

function generateRunId(): string {
  return Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

async function runProjectQA(
  project: ProjectConfig,
  runDir: string,
  levelFilter: string[]
): Promise<ProjectQAData> {
  const data: ProjectQAData = {
    name: project.name,
    localPath: project.localPath,
    github: project.github,
    type: project.type,
  };

  const levels = levelFilter.length
    ? project.testLevels.filter((l) => levelFilter.includes(l))
    : project.testLevels;

  const screenshotDir = path.join(runDir, 'screenshots', project.name.replace(/\s/g, '_'));
  const videoDir = path.join(runDir, 'videos', project.name.replace(/\s/g, '_'));

  logger.divider(project.name);

  if (levels.includes('source')) {
    try {
      data.source = await runSourceHealthScan(project.name, project.localPath);
    } catch (e) {
      logger.error(`Source scan failed for ${project.name}: ${String(e)}`);
    }
  }

  if (levels.includes('build') && project.buildCommands?.length) {
    try {
      data.build = await runBuild(project.name, project.localPath, project.buildCommands);
    } catch (e) {
      logger.error(`Build runner failed for ${project.name}: ${String(e)}`);
    }
  }

  const testUrl = project.adminUrl || project.publicUrl;

  if (levels.includes('ui') && testUrl) {
    try {
      data.ui = await runUITest(project.name, testUrl, 'QA', screenshotDir, videoDir);
    } catch (e) {
      logger.error(`UI test failed for ${project.name}: ${String(e)}`);
    }
  }

  if (levels.includes('api') && testUrl) {
    try {
      data.api = await runApiTest(project.name, testUrl);
    } catch (e) {
      logger.error(`API test failed for ${project.name}: ${String(e)}`);
    }
  }

  if (levels.includes('stress') && testUrl && process.env.QA_STRESS_TEST_ENABLED !== 'false') {
    try {
      data.stress = await runStressTest(project.name, testUrl);
    } catch (e) {
      logger.error(`Stress test failed for ${project.name}: ${String(e)}`);
    }
  }

  if (levels.includes('role') && testUrl) {
    const roleResults = [];
    for (const role of rolesConfig.roles as RoleConfig[]) {
      try {
        const result = await runRoleTest(project.name, testUrl, role, screenshotDir, videoDir);
        roleResults.push(result);
      } catch (e) {
        logger.error(`Role test failed for ${role.name}: ${String(e)}`);
      }
    }
    data.roles = roleResults;
  }

  return data;
}

async function main(): Promise<void> {
  const { projectFilter, levels, reportOnly } = parseArgs();
  const runId = generateRunId();
  const startedAt = new Date().toISOString();

  const reportsBase = path.resolve(__dirname, '../qa-reports');
  const runDir = getRunDir(reportsBase);

  setLogFile(path.join(runDir, 'logs', 'qa.log'));

  logger.divider('QA SYSTEM START');
  logger.info(`Run ID: ${runId}`);
  logger.info(`Output: ${runDir}`);
  logger.info(`Safe Mode: ${process.env.QA_SAFE_MODE !== 'false'}`);

  let projects = projectsConfig.projects as ProjectConfig[];
  if (projectFilter) {
    projects = projects.filter((p) =>
      p.name.toLowerCase().includes(projectFilter.toLowerCase())
    );
    logger.info(`Filter: running only "${projectFilter}" (${projects.length} match)`);
  }

  const projectResults: ProjectQAData[] = [];

  if (!reportOnly) {
    for (const project of projects) {
      try {
        const result = await runProjectQA(project, runDir, levels ?? []);
        projectResults.push(result);
      } catch (e) {
        logger.error(`Fatal error for project ${project.name}: ${String(e)}`);
        projectResults.push({
          name: project.name,
          localPath: project.localPath,
          github: project.github,
          type: project.type,
        });
      }
    }
  }

  await closeBrowser();

  const completedAt = new Date().toISOString();
  const qaData: QARunData = {
    runId,
    startedAt,
    completedAt,
    environment: process.env.QA_ENV || 'local',
    safeMode: process.env.QA_SAFE_MODE !== 'false',
    projects: projectResults,
  };

  logger.divider('GENERATING REPORTS');
  const jsonPath = writeJsonReport(runDir, qaData);
  const ceoPath = writeCeoSummaryReport(runDir, qaData);
  const devPath = writeDevTechnicalReport(runDir, qaData);

  logger.divider('QA COMPLETE');
  logger.success(`Reports written to: ${runDir}`);
  logger.info(`  CEO Summary : ${ceoPath}`);
  logger.info(`  Dev Report  : ${devPath}`);
  logger.info(`  JSON Data   : ${jsonPath}`);
}

main().catch((e) => {
  console.error('QA System crashed:', e);
  process.exit(1);
});
