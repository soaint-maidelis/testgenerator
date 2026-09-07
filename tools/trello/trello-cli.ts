import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

import type { IncidentModel } from '../../src/core/incidents/incident.types';
import { DefaultFailureClassifier } from '../../src/core/incidents/failure-classifier';
import { createIncidentModel } from '../../src/core/incidents/incident-model';
import type { NormalizedTestResult } from '../../src/core/results/normalized-test-result.types';
import { TrelloClient, type TrelloBoard, type TrelloList } from '../../src/integrations/trello/trello-client';
import { loadTrelloConfig } from '../../src/integrations/trello/trello-config';
import { TrelloIncidentProvider } from '../../src/integrations/trello/trello-incident.provider';

interface Discovery { readonly client: TrelloClient; readonly board: TrelloBoard; readonly list: TrelloList; }

async function setup(): Promise<Discovery> {
  const config = loadTrelloConfig();
  console.log('Credentials: FOUND');
  const client = new TrelloClient(config);
  const board = await client.findBoardExact();
  if (board === undefined) throw new Error(`Board not found by exact name: ${config.boardName}`);
  console.log(`Board: FOUND (${maskId(board.id)})`);
  const list = await client.findListExact(board.id);
  if (list === undefined) throw new Error(`List not found by exact name: ${config.listName}`);
  console.log(`List: FOUND (${maskId(list.id)})`);
  return { client, board, list };
}

async function integrationTest(): Promise<void> {
  const { client, list } = await setup();
  const card = await client.createCard(list.id, {
    name: '[TG-DEMO] Trello integration test',
    desc: 'TestGenerator Trello integration validation.\n\nCreated automatically by TestGenerator.\n\nThis is a demo integration card.\nSafe to delete.',
  });
  console.log('Card created: YES');
  console.log(`Card URL: ${card.url}`);
}

async function demoIncident(): Promise<void> {
  const demo = spawnSync(process.execPath, ['tools/demo/demo-cli.cjs', 'sauce-incident'], { cwd: process.cwd(), stdio: 'inherit' });
  if ((demo.status ?? 1) !== 0) throw new Error('SauceDemo synthetic incident did not produce a valid preview');
  await submitPreparedDemoIncident();
}

async function submitPreparedDemoIncident(): Promise<void> {
  await submitPreparedIncident('artifacts/incidents/saucedemo-SD-INCIDENT-001.json');
}

async function submitPreparedIncident(inputFile: string): Promise<void> {
  const incidentsDirectory = resolve('artifacts/incidents');
  const incidentFile = resolve(inputFile);
  if (relative(incidentsDirectory, incidentFile).startsWith('..')) throw new Error('Incident file must be inside artifacts/incidents');
  const incident = JSON.parse(await readFile(incidentFile, 'utf8')) as IncidentModel;
  if (!incident.simulated || incident.context?.marker !== 'SIMULATED_DEMO_FAILURE') throw new Error('Prepared incident is not a controlled SIMULATED_DEMO_FAILURE');
  const { client, board, list } = await setup();
  const artifact = await new TrelloIncidentProvider(client, list.id, 'demo').writePreview(incident);
  const cardId = new URL(artifact.path).pathname.split('/').filter(Boolean)[1];
  if (!cardId) throw new Error('Created Trello card returned no verifiable identifier');
  const card = await client.getCard(cardId);
  if (card.idList !== list.id || !card.name.includes('SIMULATED_DEMO_FAILURE') || !card.desc.includes('SIMULATED_DEMO_FAILURE')) throw new Error('Created Trello card failed post-creation verification');
  console.log('Card created: YES');
  console.log(`Board name: ${board.name}`);
  console.log(`List name: ${list.name}`);
  console.log('Marker verified: YES');
  console.log('Card verified: YES');
  console.log(`Card URL: ${artifact.path}`);
}

async function certifySources(): Promise<void> {
  const { client, list } = await setup();
  const sources = [
    { sourceType: 'USER_STORY', caseId: 'US-SD-CART-REMOVE-001-AC-1', summary: 'Controlled user story certification failure' },
    { sourceType: 'EXCEL', caseId: 'SD-CART-001', summary: 'Controlled Excel certification failure' },
    { sourceType: 'JSON', caseId: 'SD-CART-001', summary: 'Controlled JSON certification failure' },
  ] as const;
  for (const source of sources) {
    const result: NormalizedTestResult = {
      applicationId: 'saucedemo', caseId: source.caseId, title: source.summary, status: 'failed', durationMs: 1,
      startedAt: new Date().toISOString(), evidence: [{ kind: 'other', path: 'playwright-report/index.html' }],
      failure: { message: 'SIMULATED_DEMO_FAILURE: controlled certification condition', source: 'product' },
    };
    const classification = new DefaultFailureClassifier().classify(result);
    const incident = createIncidentModel(result, classification, new Date().toISOString(), {
      marker: 'SIMULATED_DEMO_FAILURE', sourceType: source.sourceType, environment: 'certification', browser: 'chromium',
      expected: 'Controlled condition passes', actual: 'Controlled synthetic condition fails',
    });
    const artifact = await new TrelloIncidentProvider(client, list.id, 'certification').writePreview(incident);
    const cardId = new URL(artifact.path).pathname.split('/').filter(Boolean)[1];
    if (!cardId) throw new Error(`Created ${source.sourceType} card returned no verifiable identifier`);
    const card = await client.getCard(cardId);
    const valid = card.idList === list.id && card.name.includes(source.caseId) && card.desc.includes(`Source Type: ${source.sourceType}`) && card.desc.includes('SIMULATED_DEMO_FAILURE');
    if (!valid) throw new Error(`Created ${source.sourceType} card failed post-creation verification`);
    console.log(`${source.sourceType} card verified: YES`);
    console.log(`${source.sourceType} card URL: ${card.url}`);
  }
}

function maskId(id: string): string {
  return `${'*'.repeat(Math.max(4, id.length - 4))}${id.slice(-4)}`;
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === 'setup') await setup();
  else if (mode === 'test') await integrationTest();
  else if (mode === 'demo-incident') await demoIncident();
  else if (mode === 'submit-demo-incident') await submitPreparedDemoIncident();
  else if (mode === 'submit-incident') {
    const inputFile = process.argv[3];
    if (!inputFile) throw new Error('Missing prepared incident file');
    await submitPreparedIncident(inputFile);
  }
  else if (mode === 'certify-sources') await certifySources();
  else throw new Error(`Unknown Trello command: ${mode ?? '(missing)'}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown Trello error');
  process.exitCode = 1;
});
