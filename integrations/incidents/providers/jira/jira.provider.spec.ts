import { expect, test } from '@playwright/test';
import { buildIncidentSignature } from '../../incident-signature';
import { makeProviderTestCandidate, makeProviderTestConfig } from '../provider-test-helpers';
import { findJiraDuplicateBySignature } from './jira.dedup';
import { mapIncidentToJiraIssue } from './jira.mapper';
import { JiraProvider } from './jira.provider';
import type { JiraClient } from './jira.client';
import { JiraRequestError } from './jira.types';
import { extractTextFromAdf, linesToAdf } from './jira-adf';

test.describe('jira provider scaffold', () => {
  test('mapper builds issue with signature and labels', () => {
    const candidate = makeProviderTestCandidate();
    const issue = mapIncidentToJiraIssue(candidate, {
      baseUrl: 'https://jira.example.test',
      projectKey: 'QA',
      email: 'qa@example.test',
      apiToken: 'token',
      issueType: 'Bug',
      requestTimeoutMs: 15_000,
    });

    expect(issue.fields.project.key).toBe('QA');
    expect(issue.fields.issuetype.name).toBe('Bug');
    expect(issue.fields.description.type).toBe('doc');
    expect(issue.fields.description.version).toBe(1);
    expect(extractTextFromAdf(issue.fields.description)).toContain(buildIncidentSignature(candidate));
    expect(issue.fields.labels).toContain('QA-AUTO');
  });

  test('dedup matches exact QA signature and rejects mismatch', () => {
    const candidate = makeProviderTestCandidate();
    const duplicate = findJiraDuplicateBySignature(candidate, [
      { key: 'QA-1', fields: { description: `QA-AUTO-SIGNATURE:\nWRONG|SIGNATURE|X` } },
      { key: 'QA-2', fields: { description: `QA-AUTO-SIGNATURE:\n${buildIncidentSignature(candidate)}` } },
    ]);

    expect(duplicate?.key).toBe('QA-2');
  });

  test('dedup matches exact QA signature inside ADF description', () => {
    const candidate = makeProviderTestCandidate();
    const duplicate = findJiraDuplicateBySignature(candidate, [
      { key: 'QA-1', fields: { description: linesToAdf(['QA-AUTO-SIGNATURE:', 'CASE-001|OTHER|VIEW']) } },
      { key: 'QA-2', fields: { description: linesToAdf(['QA-AUTO-SIGNATURE:', buildIncidentSignature(candidate)]) } },
    ]);

    expect(duplicate?.key).toBe('QA-2');
  });

  test('dedup rejects different QA signature inside ADF description', () => {
    const candidate = makeProviderTestCandidate();
    const duplicate = findJiraDuplicateBySignature(candidate, [
      { key: 'QA-1', fields: { description: linesToAdf(['QA-AUTO-SIGNATURE:', 'CASE-001|OTHER|VIEW']) } },
    ]);

    expect(duplicate).toBeUndefined();
  });

  test('provider create maps mocked issue', async () => {
    const provider = new JiraProvider(makeProviderTestConfig('jira'), makeJiraClient({ createKey: 'QA-123' }));

    const created = await provider.createIncident(makeProviderTestCandidate());
    expect(created).toMatchObject({ provider: 'jira', incidentId: 'QA-123', incidentUrl: 'https://jira.example.test/browse/QA-123' });
  });

  test('validate only performs validation and dedup without create', async () => {
    const client = makeJiraClient();
    const provider = new JiraProvider(makeProviderTestConfig('jira'), client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('jira') });

    expect(result).toMatchObject({ provider: 'jira', status: 'VALIDATED', message: 'JIRA_VALIDATE_ONLY=true' });
    expect(client.calls.create).toBe(0);
  });

  test('dedup exact returns DUPLICATE', async () => {
    const candidate = makeProviderTestCandidate();
    const client = makeJiraClient({
      issues: [{ key: 'QA-777', fields: { description: `QA-AUTO-SIGNATURE:\n${buildIncidentSignature(candidate)}` } }],
    });
    const provider = new JiraProvider(makeProviderTestConfig('jira'), client);

    const result = await provider.processIncident({ candidate, config: makeProviderTestConfig('jira') });

    expect(result).toMatchObject({ provider: 'jira', status: 'DUPLICATE', incidentId: 'QA-777' });
    expect(client.calls.create).toBe(0);
  });

  test('same case id different signature is not duplicate and validates only', async () => {
    const client = makeJiraClient({
      issues: [{ key: 'QA-777', fields: { description: 'QA-AUTO-SIGNATURE:\nE37-AM-01.01.1|OTHER|VIEW' } }],
    });
    const provider = new JiraProvider(makeProviderTestConfig('jira'), client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('jira') });

    expect(result.status).toBe('VALIDATED');
    expect(client.calls.create).toBe(0);
  });

  test('dedup error fails closed and does not create', async () => {
    const client = makeJiraClient({ searchError: new Error('JQL failed') });
    const provider = new JiraProvider({ ...makeProviderTestConfig('jira'), jiraValidateOnly: false }, client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('jira') });

    expect(result).toMatchObject({ provider: 'jira', status: 'ERROR', message: 'JQL failed' });
    expect(client.calls.create).toBe(0);
  });

  test('dedup 410 fails closed and does not create', async () => {
    const client = makeJiraClient({ searchError: new JiraRequestError('Jira HTTP 410: La API solicitada se ha eliminado.', 410, 'searchIssues') });
    const provider = new JiraProvider({ ...makeProviderTestConfig('jira'), jiraValidateOnly: false }, client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('jira') });

    expect(result).toMatchObject({ provider: 'jira', status: 'ERROR', message: 'Jira HTTP 410: La API solicitada se ha eliminado.' });
    expect(client.calls.create).toBe(0);
  });

  test('dedup 500 fails closed and does not create', async () => {
    const client = makeJiraClient({ searchError: new JiraRequestError('Jira HTTP 500: JQL failed', 500, 'searchIssues') });
    const provider = new JiraProvider({ ...makeProviderTestConfig('jira'), jiraValidateOnly: false }, client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('jira') });

    expect(result).toMatchObject({ provider: 'jira', status: 'ERROR', message: 'Jira HTTP 500: JQL failed' });
    expect(client.calls.create).toBe(0);
  });

  test('BUG_AUTO HIGH with create enabled creates issue', async () => {
    const client = makeJiraClient({ createKey: 'QA-999' });
    const provider = new JiraProvider({ ...makeProviderTestConfig('jira'), jiraValidateOnly: false }, client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('jira') });

    expect(result).toMatchObject({ provider: 'jira', status: 'CREATED', incidentId: 'QA-999' });
    expect(client.calls.create).toBe(1);
  });

  test('decision or confidence gate skips before Jira HTTP', async () => {
    const client = makeJiraClient();
    const provider = new JiraProvider({ ...makeProviderTestConfig('jira'), jiraValidateOnly: false }, client);
    const decisionCandidate = makeProviderTestCandidate();
    decisionCandidate.incidentDecision.decision = 'BUG_REVIEW';

    const decisionResult = await provider.processIncident({ candidate: decisionCandidate, config: makeProviderTestConfig('jira') });
    expect(decisionResult).toMatchObject({ status: 'SKIPPED', message: 'decision!=BUG_AUTO' });

    const confidenceCandidate = makeProviderTestCandidate();
    confidenceCandidate.incidentDecision.confidence = 'MEDIUM';
    const confidenceResult = await provider.processIncident({ candidate: confidenceCandidate, config: makeProviderTestConfig('jira') });
    expect(confidenceResult).toMatchObject({ status: 'SKIPPED', message: 'confidence!=HIGH' });
    expect(client.calls.validate).toBe(0);
  });
});

function makeJiraClient(options: {
  issues?: Awaited<ReturnType<JiraClient['searchIssues']>>;
  createKey?: string;
  searchError?: Error;
} = {}): JiraClient & { calls: { validate: number; search: number; create: number } } {
  const calls = { validate: 0, search: 0, create: 0 };
  return {
    calls,
    async validateConnection() {
      calls.validate += 1;
      return { status: 'VALID' };
    },
    async searchIssues() {
      calls.search += 1;
      if (options.searchError) {
        throw options.searchError;
      }
      return options.issues ?? [];
    },
    async getIssue(issueKey) {
      return { key: issueKey };
    },
    async createIssue() {
      calls.create += 1;
      return { key: options.createKey ?? 'QA-123' };
    },
    async getIssueAttachments() {
      return [];
    },
    async uploadAttachment(_issueKey, _filePath, fileName) {
      return [{ filename: fileName ?? 'evidence.bin' }];
    },
  };
}
