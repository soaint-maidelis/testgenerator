import { expect, test } from '@playwright/test';
import { debug, error, info, sanitizeIncidentLogValue } from './incident-logger';

test.describe('incident logger', () => {
  test('DEBUG_INCIDENTS=false means debug does not print', () => {
    const logs = captureConsole('log', () => {
      process.env.DEBUG_INCIDENTS = 'false';
      debug('[INCIDENT DEBUG]', { secret: 'visible' });
    });

    expect(logs).toEqual([]);
  });

  test('DEBUG_INCIDENTS=true means debug prints', () => {
    const logs = captureConsole('log', () => {
      process.env.DEBUG_INCIDENTS = 'true';
      debug('[INCIDENT DEBUG]', { scope: 'test' });
    });

    expect(logs).toContain('[INCIDENT DEBUG]');
    expect(logs).toContain('scope=test');
  });

  test('info always prints', () => {
    const logs = captureConsole('log', () => {
      process.env.DEBUG_INCIDENTS = 'false';
      info('[INCIDENT]', { caseId: 'CASE-001' });
    });

    expect(logs).toContain('[INCIDENT]');
    expect(logs).toContain('caseId=CASE-001');
  });

  test('error always prints', () => {
    const logs = captureConsole('error', () => {
      process.env.DEBUG_INCIDENTS = 'false';
      error('[AZURE ERROR]', { operation: 'queryWiql', message: 'failed' });
    });

    expect(logs).toContain('[AZURE ERROR]');
    expect(logs).toContain('operation=queryWiql');
  });

  test('logger sanitizes known secrets', () => {
    const logs = captureConsole('error', () => {
      process.env.DEBUG_INCIDENTS = 'false';
      error('[AZURE ERROR]', {
        message: 'Authorization: Basic abcdef AZURE_DEVOPS_PAT=super-secret access_token=oauth-secret',
      });
    }).join('\n');

    expect(logs).not.toContain('super-secret');
    expect(logs).not.toContain('oauth-secret');
    expect(logs).not.toContain('abcdef');
    expect(sanitizeIncidentLogValue('Bearer abc.def.ghi')).toBe('Bearer [REDACTED]');
  });
});

function captureConsole(method: 'log' | 'error', callback: () => void): string[] {
  const previousDebug = process.env.DEBUG_INCIDENTS;
  const original = console[method];
  const logs: string[] = [];
  console[method] = (value?: unknown) => {
    logs.push(String(value));
  };

  try {
    callback();
  } finally {
    console[method] = original;
    if (previousDebug === undefined) {
      delete process.env.DEBUG_INCIDENTS;
    } else {
      process.env.DEBUG_INCIDENTS = previousDebug;
    }
  }

  return logs;
}
