import path from 'path';
import { debug } from './incident-logger';

export function debugIncident(scope: string, details: Record<string, unknown>): void {
  debug('[INCIDENT DEBUG]', { scope, ...details });
}

export function sourceFile(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}
