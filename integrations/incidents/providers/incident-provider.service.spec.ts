import { expect, test } from '@playwright/test';
import type { IncidentProvider } from './incident-provider';
import { processIncident } from './incident-provider.service';
import { makeProviderTestCandidate, makeProviderTestConfig } from './provider-test-helpers';

test.describe('incident provider service', () => {
  test('none provider skips without external calls', async () => {
    const provider = makeProvider('none');
    const result = await processIncident(provider, makeProviderTestCandidate(), makeProviderTestConfig('none'));

    expect(result).toMatchObject({ provider: 'none', status: 'SKIPPED', message: 'INCIDENT_PROVIDER=none' });
    expect(provider.calls.create).toBe(0);
  });

  test('duplicate returns existing incident and processes evidence fail-soft', async () => {
    const provider = makeProvider('jira', { duplicate: true });
    const result = await processIncident(provider, makeProviderTestCandidate(), makeProviderTestConfig('jira'));

    expect(result).toMatchObject({ provider: 'jira', status: 'DUPLICATE', incidentId: 'QA-123' });
    expect(result.attachments?.[0]).toMatchObject({ type: 'screenshot', status: 'LINKED' });
    expect(provider.calls.create).toBe(0);
  });

  test('create returns created incident', async () => {
    const provider = makeProvider('trello');
    const result = await processIncident(provider, makeProviderTestCandidate(), makeProviderTestConfig('trello'));

    expect(result).toMatchObject({ provider: 'trello', status: 'CREATED', incidentId: 'card-1' });
    expect(provider.calls.create).toBe(1);
  });

  test('create error fails closed', async () => {
    const provider = makeProvider('jira', { createError: true });
    const result = await processIncident(provider, makeProviderTestCandidate(), makeProviderTestConfig('jira'));

    expect(result.status).toBe('ERROR');
    expect(result.message).toContain('auth failed');
  });
});

function makeProvider(
  name: 'jira' | 'trello' | 'none',
  options: { duplicate?: boolean; createError?: boolean } = {},
): IncidentProvider & { calls: { create: number } } {
  const calls = { create: 0 };

  return {
    name,
    calls,
    async findDuplicate() {
      return options.duplicate
        ? { duplicate: true, incident: { provider: name, incidentId: name === 'jira' ? 'QA-123' : 'card-123' } }
        : { duplicate: false };
    },
    async createIncident() {
      calls.create += 1;
      if (options.createError) {
        throw new Error('auth failed');
      }
      return { provider: name, incidentId: name === 'jira' ? 'QA-1' : 'card-1' };
    },
    async processEvidence() {
      return [{ type: 'screenshot', status: 'LINKED', fileName: 'screenshot.png' }];
    },
  };
}
