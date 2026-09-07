import assert from 'node:assert/strict';
import test from 'node:test';

import type { IncidentModel } from '../../src/core/incidents/incident.types';
import { mapIncidentToTrelloCard } from '../../src/integrations/trello/trello-card.mapper';
import { TrelloClient } from '../../src/integrations/trello/trello-client';
import { loadTrelloConfig } from '../../src/integrations/trello/trello-config';
import { TrelloIncidentProvider } from '../../src/integrations/trello/trello-incident.provider';

const environment = {
  TRELLO_API_KEY: 'local-key', TRELLO_API_TOKEN: 'local-token',
  TRELLO_BOARD_NAME: 'TestGenerator - Demo QA', TRELLO_LIST_NAME: 'Detected',
};
const incident: IncidentModel = {
  applicationId: 'saucedemo', caseId: 'SD-INCIDENT-001', title: 'Controlled cart failure',
  classification: { classification: 'PRODUCT_DEFECT', reason: 'Controlled simulation' },
  error: 'Expected cart badge 1, received 0', occurredAt: '2026-01-01T00:00:00.000Z', simulated: true,
  evidence: [{ kind: 'screenshot', path: 'test-results/failure.png' }, { kind: 'trace', path: 'test-results/trace.zip' }],
  context: { browser: 'chromium', expected: 'Cart badge is 1', actual: 'Cart badge is 0' },
};

test('validates complete and missing Trello configuration without exposing values', () => {
  assert.equal(loadTrelloConfig(environment).boardName, 'TestGenerator - Demo QA');
  assert.throws(() => loadTrelloConfig({ TRELLO_BOARD_NAME: 'Board' }), (error: Error) => {
    assert.match(error.message, /TRELLO_API_KEY/);
    assert.match(error.message, /TRELLO_API_TOKEN/);
    assert.doesNotMatch(error.message, /local-key|local-token/);
    return true;
  });
});

test('maps an incident to the required sanitized Trello payload', () => {
  const payload = mapIncidentToTrelloCard(incident, 'demo');
  assert.equal(payload.name, '[SIMULATED_DEMO_FAILURE] SD-INCIDENT-001 - Controlled cart failure');
  for (const expected of ['TestGenerator Incident', 'Application: saucedemo', 'Scenario:', 'Priority:', 'Source Type: Not provided', 'Browser: chromium', 'Expected:', 'Actual:', 'Technical Error:', 'Screenshot:', 'Trace:', 'Report:', 'Simulation: YES', 'Marker: SIMULATED_DEMO_FAILURE']) {
    assert.match(payload.desc, new RegExp(expected));
  }
  assert.doesNotMatch(JSON.stringify(payload), /local-key|local-token/);
});

test('provider maps IncidentModel and returns the real card URL contract offline', async () => {
  let capturedName = '';
  const client = { createCard: async (_listId: string, payload: { name: string; desc: string }) => {
    capturedName = payload.name;
    return { id: 'card-id', url: 'https://trello.com/c/example' };
  } } as TrelloClient;
  const artifact = await new TrelloIncidentProvider(client, 'list-id').writePreview(incident);
  assert.match(capturedName, /^\[SIMULATED_DEMO_FAILURE\]/);
  assert.equal(artifact.path, 'https://trello.com/c/example');
});

test('client failures never leak API key or token', async () => {
  const failingFetch = (async () => new Response('', { status: 401 })) as typeof fetch;
  const client = new TrelloClient(loadTrelloConfig(environment), failingFetch);
  await assert.rejects(client.getBoards(), (error: Error) => {
    assert.equal(error.message, 'Trello request failed with HTTP 401');
    assert.doesNotMatch(error.message, /local-key|local-token/);
    return true;
  });
});
