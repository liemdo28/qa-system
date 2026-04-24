import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug' | 'step';

let logFilePath: string | null = null;

export function setLogFile(filePath: string): void {
  logFilePath = filePath;
  fs.ensureDirSync(path.dirname(filePath));
}

function writeToFile(message: string): void {
  if (logFilePath) {
    fs.appendFileSync(logFilePath, message + '\n', 'utf-8');
  }
}

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export const logger = {
  info(msg: string): void {
    const line = `[${timestamp()}] INFO  ${msg}`;
    console.log(chalk.cyan(line));
    writeToFile(line);
  },

  success(msg: string): void {
    const line = `[${timestamp()}] OK    ${msg}`;
    console.log(chalk.green(line));
    writeToFile(line);
  },

  warn(msg: string): void {
    const line = `[${timestamp()}] WARN  ${msg}`;
    console.log(chalk.yellow(line));
    writeToFile(line);
  },

  error(msg: string): void {
    const line = `[${timestamp()}] ERROR ${msg}`;
    console.log(chalk.red(line));
    writeToFile(line);
  },

  debug(msg: string): void {
    if (process.env.QA_DEBUG === 'true') {
      const line = `[${timestamp()}] DEBUG ${msg}`;
      console.log(chalk.gray(line));
      writeToFile(line);
    }
  },

  step(project: string, step: string): void {
    const line = `[${timestamp()}] STEP  [${project}] ${step}`;
    console.log(chalk.magenta(line));
    writeToFile(line);
  },

  divider(label?: string): void {
    const line = label
      ? `\n${'─'.repeat(20)} ${label} ${'─'.repeat(20)}`
      : `\n${'─'.repeat(60)}`;
    console.log(chalk.gray(line));
    writeToFile(line);
  },
};
