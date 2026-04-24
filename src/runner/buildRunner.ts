import { logger } from '../utils/logger';
import { runCommandSequential, CommandResult } from '../utils/commandRunner';

export interface BuildResult {
  projectName: string;
  commands: { command: string; result: CommandResult }[];
  overallSuccess: boolean;
  installSuccess: boolean;
  buildSuccess: boolean;
  testSuccess: boolean;
  totalDurationMs: number;
  errors: string[];
}

export async function runBuild(
  projectName: string,
  projectPath: string,
  buildCommands: string[]
): Promise<BuildResult> {
  logger.step(projectName, 'Build runner');

  const commands = await runCommandSequential(buildCommands, projectPath);
  const totalDurationMs = commands.reduce((sum, c) => sum + c.result.durationMs, 0);
  const errors: string[] = [];

  for (const { command, result } of commands) {
    if (!result.success) {
      errors.push(`"${command}" failed (exit ${result.exitCode}): ${result.stderr.substring(0, 500)}`);
    }
  }

  const installCmd = commands.find((c) => c.command.includes('install'));
  const buildCmd = commands.find((c) => c.command.includes('build'));
  const testCmd = commands.find((c) => c.command.includes('test'));

  const result: BuildResult = {
    projectName,
    commands,
    overallSuccess: errors.length === 0,
    installSuccess: installCmd?.result.success ?? true,
    buildSuccess: buildCmd?.result.success ?? true,
    testSuccess: testCmd?.result.success ?? true,
    totalDurationMs,
    errors,
  };

  const label = result.overallSuccess ? 'PASS' : 'FAIL';
  logger.info(`${projectName} build: ${label} (${totalDurationMs}ms)`);
  return result;
}
