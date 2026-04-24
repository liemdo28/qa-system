const MASK = '********';

const SENSITIVE_KEYS = [
  'password', 'passwd', 'secret', 'token', 'key', 'api_key', 'apikey',
  'refresh_token', 'access_token', 'client_secret', 'private_key',
  'auth', 'credential', 'jwt', 'bearer', 'stripe', 'twilio', 'sendgrid',
  'smtp', 'database_url', 'db_password', 'mongo', 'redis', 'firebase',
  'google', 'facebook', 'twitter', 'github', 'slack', 'toast', 'yelp',
];

const ENV_VALUE_PATTERN = /^([A-Z][A-Z0-9_]*)=(.+)$/gm;

export function maskEnvLine(line: string): string {
  return line.replace(ENV_VALUE_PATTERN, (_match, key: string, value: string) => {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((k) => lowerKey.includes(k));
    return isSensitive ? `${key}=${MASK}` : `${key}=${value}`;
  });
}

export function maskText(text: string): string {
  let result = text;

  // Mask env-style KEY=value lines
  result = result.replace(ENV_VALUE_PATTERN, (_match, key: string, value: string) => {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((k) => lowerKey.includes(k));
    return isSensitive ? `${key}=${MASK}` : `${key}=${value}`;
  });

  // Mask JSON-style "key": "value" pairs
  result = result.replace(
    /"([^"]*(?:password|secret|token|key|auth|credential)[^"]*)":\s*"([^"]*)"/gi,
    (_m, k: string, _v: string) => `"${k}": "${MASK}"`
  );

  // Mask bearer tokens in headers
  result = result.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, `Bearer ${MASK}`);

  return result;
}

export function maskObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((k) => lowerKey.includes(k));
    if (isSensitive) {
      result[key] = MASK;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = maskObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
