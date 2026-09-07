import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import type { IncidentModel } from '../../src/core/incidents/incident.types';
import { AzureIncidentProvider } from '../../src/integrations/azure/azure-incident.provider';
import type { AzureClient } from '../../src/integrations/azure/azure-client';
import { loadAzureConfig } from '../../src/integrations/azure/azure-config';
import { JiraIncidentProvider } from '../../src/integrations/jira/jira-incident.provider';
import type { JiraClient } from '../../src/integrations/jira/jira-client';
import { loadJiraConfig } from '../../src/integrations/jira/jira-config';

const incident: IncidentModel = {
  applicationId: 'saucedemo',
  caseId: 'SD-INCIDENT-001',
  title: 'Controlled cart failure',
  classification: { classification: 'PRODUCT_DEFECT', reason: 'Controlled simulation' },
  error: 'Expected cart badge 1, received 0',
  occurredAt: '2026-01-01T00:00:00.000Z',
  simulated: true,
  evidence: [],
  context: { marker: 'SIMULATED_DEMO_FAILURE', browser: 'chromium' },
};

test('validates Azure DevOps configuration without exposing PAT values', () => {
  const config = loadAzureConfig({
    AZURE_DEVOPS_ORG: 'org',
    AZURE_DEVOPS_PROJECT: 'project',
    AZURE_DEVOPS_PAT: 'secret-pat',
  });
  assert.equal(config.workItemType, 'Bug');
  assert.throws(() => loadAzureConfig({ AZURE_DEVOPS_ORG: 'org' }), (error: Error) => {
    assert.match(error.message, /AZURE_DEVOPS_PROJECT/);
    assert.match(error.message, /AZURE_DEVOPS_PAT/);
    assert.doesNotMatch(error.message, /secret-pat/);
    return true;
  });
});

test('validates Jira configuration without exposing token values', () => {
  const config = loadJiraConfig({
    JIRA_BASE_URL: 'https://example.atlassian.net',
    JIRA_EMAIL: 'qa@example.test',
    JIRA_API_TOKEN: 'secret-token',
    JIRA_PROJECT_KEY: 'QA',
  });
  assert.equal(config.issueType, 'Bug');
  assert.throws(() => loadJiraConfig({ JIRA_BASE_URL: 'https://example.atlassian.net' }), (error: Error) => {
    assert.match(error.message, /JIRA_EMAIL/);
    assert.match(error.message, /JIRA_API_TOKEN/);
    assert.doesNotMatch(error.message, /secret-token/);
    return true;
  });
});

test('Azure provider creates a work item and uploads available evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tg-azure-'));
  const screenshot = join(directory, 'failure.png');
  await writeFile(screenshot, 'png');
  const uploads: string[] = [];
  const client = {
    createWorkItem: async () => ({ id: 123 }),
    uploadAttachment: async (_id: number, _filePath: string, fileName?: string) => {
      uploads.push(fileName ?? '');
      return { url: 'https://dev.azure.com/org/project/_apis/wit/attachments/1' };
    },
    workItemUrl: (id: number) => `https://dev.azure.com/org/project/_workitems/edit/${id}`,
  } as unknown as AzureClient;

  try {
    const artifact = await new AzureIncidentProvider(client).writePreview({ ...incident, evidence: [{ kind: 'screenshot', path: screenshot }] });
    assert.equal(artifact.workItemId, 123);
    assert.equal(artifact.path, 'https://dev.azure.com/org/project/_workitems/edit/123');
    assert.deepEqual(uploads, ['SD-INCIDENT-001-screenshot-failure.png']);
    assert.deepEqual(artifact.attachments.map((item) => item.status), ['LINKED']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Azure provider reuses an existing work item instead of creating a duplicate', async () => {
  let creates = 0;
  let uploads = 0;
  const client = {
    queryWorkItems: async () => [{ id: 456 }],
    createWorkItem: async () => {
      creates += 1;
      return { id: 123 };
    },
    uploadAttachment: async () => {
      uploads += 1;
      return { url: 'https://dev.azure.com/org/project/_apis/wit/attachments/1' };
    },
    workItemUrl: (id: number) => `https://dev.azure.com/org/project/_workitems/edit/${id}`,
  } as unknown as AzureClient;

  const artifact = await new AzureIncidentProvider(client).writePreview(incident);
  assert.equal(artifact.duplicate, true);
  assert.equal(artifact.workItemId, 456);
  assert.equal(artifact.path, 'https://dev.azure.com/org/project/_workitems/edit/456');
  assert.equal(creates, 0);
  assert.equal(uploads, 0);
});

test('Jira provider creates an issue and uploads available evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tg-jira-'));
  const video = join(directory, 'video.webm');
  await writeFile(video, 'webm');
  const uploads: string[] = [];
  const client = {
    createIssue: async () => ({ key: 'QA-1' }),
    uploadAttachment: async (_key: string, _filePath: string, fileName?: string) => {
      uploads.push(fileName ?? '');
      return [{ filename: fileName ?? '' }];
    },
    issueUrl: (key: string) => `https://example.atlassian.net/browse/${key}`,
  } as unknown as JiraClient;

  try {
    const artifact = await new JiraIncidentProvider(client).writePreview({ ...incident, evidence: [{ kind: 'video', path: video }] });
    assert.equal(artifact.issueKey, 'QA-1');
    assert.equal(artifact.path, 'https://example.atlassian.net/browse/QA-1');
    assert.deepEqual(uploads, ['SD-INCIDENT-001-video-video.webm']);
    assert.deepEqual(artifact.attachments.map((item) => item.status), ['LINKED']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Jira provider reuses an existing issue instead of creating a duplicate', async () => {
  let creates = 0;
  let uploads = 0;
  let jql = '';
  const client = {
    searchIssues: async (query: string) => {
      jql = query;
      return [{ key: 'QA-77' }];
    },
    createIssue: async () => {
      creates += 1;
      return { key: 'QA-1' };
    },
    uploadAttachment: async () => {
      uploads += 1;
      return [];
    },
    issueUrl: (key: string) => `https://example.atlassian.net/browse/${key}`,
  } as unknown as JiraClient;

  const artifact = await new JiraIncidentProvider(client, 'QA').writePreview(incident);
  assert.equal(artifact.duplicate, true);
  assert.equal(artifact.issueKey, 'QA-77');
  assert.equal(artifact.path, 'https://example.atlassian.net/browse/QA-77');
  assert.match(jql, /project = "QA"/);
  assert.match(jql, /SD-INCIDENT-001/);
  assert.equal(creates, 0);
  assert.equal(uploads, 0);
});
