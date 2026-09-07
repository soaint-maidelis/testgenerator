export type IncidentLogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogDetails = Record<string, unknown>;

export function isIncidentDebugEnabled(): boolean {
  return process.env.DEBUG_INCIDENTS === 'true';
}

export function debug(header: string, details: LogDetails = {}): void {
  if (!isIncidentDebugEnabled()) {
    return;
  }

  writeLog('debug', header, details);
}

export function info(header: string, details: LogDetails = {}): void {
  writeLog('info', header, details);
}

export function warn(header: string, details: LogDetails = {}): void {
  writeLog('warn', header, details);
}

export function error(header: string, details: LogDetails = {}): void {
  writeLog('error', header, details);
}

export function sanitizeIncidentLogValue(value: unknown): string {
  const text = formatLogValue(value);

  return text
    .replace(/\b(AZURE_DEVOPS_PAT|PAT|password|secret|access_token|refresh_token|oauth_token)(\s*[:=]\s*)([^\s&]+)/gi, '$1$2[REDACTED]')
    .replace(/\b(Authorization)(\s*[:=]\s*)([^\r\n]+)/gi, '$1$2[REDACTED]')
    .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(/([?&](?:sig|token|access_token|refresh_token|api-version)=)[^&\s]+/gi, '$1[REDACTED]');
}

function writeLog(level: IncidentLogLevel, header: string, details: LogDetails): void {
  const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  writer(sanitizeIncidentLogValue(header));

  for (const [key, value] of Object.entries(details)) {
    writer(`${key}=${sanitizeIncidentLogValue(value)}`);
  }
}

function formatLogValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatLogValue).join(' > ');
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}
