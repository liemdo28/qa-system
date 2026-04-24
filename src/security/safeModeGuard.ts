import { logger } from '../utils/logger';

export interface SafeModeLimits {
  maxUsers: number;
  maxRequestsPerMinute: number;
  testDurationSeconds: number;
  allowDestructive: boolean;
  allowProductionStress: boolean;
}

const SAFE_LIMITS: SafeModeLimits = {
  maxUsers: 10,
  maxRequestsPerMinute: 50,
  testDurationSeconds: 60,
  allowDestructive: false,
  allowProductionStress: false,
};

const FULL_LIMITS: SafeModeLimits = {
  maxUsers: parseInt(process.env.QA_MAX_USERS || '100', 10),
  maxRequestsPerMinute: parseInt(process.env.QA_MAX_REQUESTS_PER_MINUTE || '300', 10),
  testDurationSeconds: parseInt(process.env.QA_TEST_DURATION_SECONDS || '300', 10),
  allowDestructive: false,
  allowProductionStress: true,
};

export function isSafeMode(): boolean {
  return process.env.QA_SAFE_MODE !== 'false';
}

export function getLimits(): SafeModeLimits {
  if (isSafeMode()) {
    logger.warn('Safe mode is ENABLED — stress limits are reduced');
    return SAFE_LIMITS;
  }
  return FULL_LIMITS;
}

export function isProductionUrl(url: string): boolean {
  const productionIndicators = [
    'bakudanramen.com',
    'rawsushibar.com',
    'dashboard.bakudan',
  ];
  return productionIndicators.some((indicator) => url.includes(indicator));
}

export function guardDestructiveAction(action: string): void {
  if (isSafeMode()) {
    throw new Error(
      `[SafeMode] Blocked destructive action: "${action}". Set QA_SAFE_MODE=false to allow.`
    );
  }
  logger.warn(`[SafeMode OFF] Executing destructive action: ${action}`);
}

export function guardProductionStress(url: string): void {
  if (isProductionUrl(url) && isSafeMode()) {
    throw new Error(
      `[SafeMode] Blocked stress test on production URL: ${url}. Set QA_SAFE_MODE=false to allow.`
    );
  }
  if (isProductionUrl(url)) {
    logger.warn(`Running stress test on production URL: ${url}`);
  }
}
