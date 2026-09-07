const SECRET_PATTERN = /\b(password|secret|token|authorization|cookie)(\s*[:=]\s*)([^\s,;]+)/gi;
const BEARER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;

export function sanitizeSensitiveText(value: string): string {
  return value
    .replace(SECRET_PATTERN, '$1$2[REDACTED]')
    .replace(BEARER_PATTERN, '$1 [REDACTED]');
}

export function safeArtifactSegment(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return sanitized || 'unknown';
}
