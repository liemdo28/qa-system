import * as fs from 'fs-extra';
import * as path from 'path';
import { findFiles } from '../utils/fileUtils';
import { logger } from '../utils/logger';

export interface SecretFinding {
  file: string;
  line: number;
  pattern: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  maskedValue: string;
}

const SECRET_PATTERNS: { name: string; regex: RegExp; severity: SecretFinding['severity'] }[] = [
  { name: 'AWS Key', regex: /AKIA[0-9A-Z]{16}/g, severity: 'CRITICAL' },
  { name: 'GitHub Token', regex: /ghp_[A-Za-z0-9]{36}/g, severity: 'CRITICAL' },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z\-_]{35}/g, severity: 'CRITICAL' },
  { name: 'Stripe Secret', regex: /sk_live_[0-9a-zA-Z]{24,}/g, severity: 'CRITICAL' },
  { name: 'Private Key Block', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: 'CRITICAL' },
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/]*/g, severity: 'HIGH' },
  { name: 'Password in Code', regex: /password\s*[:=]\s*['"][^'"]{6,}['"]/gi, severity: 'HIGH' },
  { name: 'Secret in Code', regex: /secret\s*[:=]\s*['"][^'"]{6,}['"]/gi, severity: 'HIGH' },
  { name: 'DB Connection String', regex: /mongodb(\+srv)?:\/\/[^'">\s]+/g, severity: 'CRITICAL' },
  { name: 'DB Password', regex: /DB_PASS(WORD)?\s*=\s*\S+/gi, severity: 'HIGH' },
  { name: 'OAuth Token', regex: /ya29\.[A-Za-z0-9\-_]+/g, severity: 'CRITICAL' },
  { name: 'Hardcoded Admin Password', regex: /admin_?password\s*[:=]\s*['"][^'"]{4,}['"]/gi, severity: 'HIGH' },
  { name: 'Env File Committed', regex: /^\.env$/, severity: 'CRITICAL' },
];

const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', 'qa-reports', '.next'];
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.yml', '.yaml', '.sh'];

export async function scanSecrets(projectPath: string): Promise<SecretFinding[]> {
  const findings: SecretFinding[] = [];

  if (!fs.pathExistsSync(projectPath)) {
    logger.warn(`Secret scan skipped — path not found: ${projectPath}`);
    return findings;
  }

  // Check for committed .env files
  const envFiles = await findFiles('.env', projectPath);
  for (const envFile of envFiles) {
    const rel = path.relative(projectPath, envFile);
    if (!rel.includes('node_modules') && !rel.includes('.git')) {
      findings.push({
        file: rel,
        line: 0,
        pattern: 'Env File Committed',
        severity: 'CRITICAL',
        maskedValue: '.env file should not exist in repository',
      });
    }
  }

  const patterns = SCAN_EXTENSIONS.map((ext) => `**/*${ext}`);
  let files: string[] = [];
  try {
    files = await findFiles(`{${patterns.join(',')}}`, projectPath);
  } catch {
    logger.warn(`Could not glob files in: ${projectPath}`);
    return findings;
  }

  for (const file of files) {
    const rel = path.relative(projectPath, file);
    if (SKIP_DIRS.some((dir) => rel.includes(dir))) continue;

    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (const { name, regex, severity } of SECRET_PATTERNS) {
      if (name === 'Env File Committed') continue;
      regex.lastIndex = 0;

      lines.forEach((line, idx) => {
        regex.lastIndex = 0;
        const match = regex.exec(line);
        if (match) {
          findings.push({
            file: rel,
            line: idx + 1,
            pattern: name,
            severity,
            maskedValue: line.trim().replace(match[0], '********'),
          });
        }
      });
    }
  }

  logger.info(`Secret scan: ${findings.length} finding(s) in ${projectPath}`);
  return findings;
}
