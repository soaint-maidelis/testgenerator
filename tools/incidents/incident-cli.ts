import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

import type { IncidentModel } from '../../src/core/incidents/incident.types';
import { AzureClient } from '../../src/integrations/azure/azure-client';
import { loadAzureConfig } from '../../src/integrations/azure/azure-config';
import { AzureIncidentProvider } from '../../src/integrations/azure/azure-incident.provider';
import { JiraClient } from '../../src/integrations/jira/jira-client';
import { loadJiraConfig } from '../../src/integrations/jira/jira-config';
import { JiraIncidentProvider } from '../../src/integrations/jira/jira-incident.provider';
import { TrelloClient } from '../../src/integrations/trello/trello-client';
import { loadTrelloConfig } from '../../src/integrations/trello/trello-config';
import { TrelloIncidentProvider } from '../../src/integrations/trello/trello-incident.provider';

type ProviderName = 'azure' | 'jira' | 'trello';

async function submitIncident(providerName: ProviderName, inputFile: string): Promise<void> {
  const incident = await loadControlledIncident(inputFile);
  if (providerName === 'trello') {
    await submitTrello(incident);
    return;
  }
  if (providerName === 'jira') {
    await submitJira(incident);
    return;
  }
  await submitAzure(incident);
}

async function submitTrello(incident: IncidentModel): Promise<void> {
  const config = loadTrelloConfig();
  const client = new TrelloClient(config);
  const board = await client.findBoardExact();
  if (board === undefined) throw new Error(`Board not found by exact name: ${config.boardName}`);
  const list = await client.findListExact(board.id);
  if (list === undefined) throw new Error(`List not found by exact name: ${config.listName}`);
  const artifact = await new TrelloIncidentProvider(client, list.id, 'demo').writePreview(incident);
  const cardId = new URL(artifact.path).pathname.split('/').filter(Boolean)[1];
  if (!cardId) throw new Error('Created Trello card returned no verifiable identifier');
  const card = await client.getCard(cardId);
  if (card.idList !== list.id || !card.name.includes('SIMULATED_DEMO_FAILURE') || !card.desc.includes('SIMULATED_DEMO_FAILURE')) {
    throw new Error('Created Trello card failed post-creation verification');
  }
  printResult({ provider: 'Trello', target: `${board.name} / ${list.name}`, verifiedLabel: 'Card', url: artifact.path, duplicate: artifact.duplicate, attachments: artifact.attachments });
}

async function submitJira(incident: IncidentModel): Promise<void> {
  const config = loadJiraConfig();
  const client = new JiraClient(config);
  const artifact = await new JiraIncidentProvider(client, config.projectKey).writePreview(incident);
  const issue = await client.getIssue(artifact.issueKey);
  if (issue.key !== artifact.issueKey) throw new Error('Created Jira issue failed post-creation verification');
  printResult({ provider: 'Jira', target: `${config.projectKey} / ${config.issueType}`, verifiedLabel: 'Issue', url: artifact.path, duplicate: artifact.duplicate, attachments: artifact.attachments });
}

async function submitAzure(incident: IncidentModel): Promise<void> {
  const config = loadAzureConfig();
  const client = new AzureClient(config);
  const artifact = await new AzureIncidentProvider(client).writePreview(incident);
  const workItem = await client.getWorkItem(artifact.workItemId);
  if (workItem.id !== artifact.workItemId) throw new Error('Created Azure DevOps work item failed post-creation verification');
  printResult({ provider: 'Azure DevOps', target: `${config.organization} / ${config.project}`, verifiedLabel: 'Work item', url: artifact.path, duplicate: artifact.duplicate, attachments: artifact.attachments });
}

async function loadControlledIncident(inputFile: string): Promise<IncidentModel> {
  const incidentsDirectory = resolve('artifacts/incidents');
  const incidentFile = resolve(inputFile);
  if (relative(incidentsDirectory, incidentFile).startsWith('..')) {
    throw new Error('Incident file must be inside artifacts/incidents');
  }
  const incident = JSON.parse(await readFile(incidentFile, 'utf8')) as IncidentModel;
  if (!incident.simulated || incident.context?.marker !== 'SIMULATED_DEMO_FAILURE') {
    throw new Error('Prepared incident is not a controlled SIMULATED_DEMO_FAILURE');
  }
  return incident;
}

function printResult(input: {
  readonly provider: string;
  readonly target: string;
  readonly verifiedLabel: string;
  readonly url: string;
  readonly duplicate: boolean;
  readonly attachments: readonly { readonly kind: string; readonly status: string; readonly message?: string }[];
}): void {
  console.log(`Provider: ${input.provider}`);
  console.log(`Target: ${input.target}`);
  console.log(`Duplicate: ${input.duplicate ? 'YES' : 'NO'}`);
  console.log('Marker verified: YES');
  console.log(`${input.verifiedLabel} verified: YES`);
  console.log('Incident verified: YES');
  for (const attachment of input.attachments) {
    const detail = attachment.message ? ` (${attachment.message})` : '';
    console.log(`Attachment ${attachment.kind}: ${attachment.status}${detail}`);
  }
  console.log(`Incident URL: ${input.url}`);
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const provider = process.argv[3] as ProviderName | undefined;
  const inputFile = process.argv[4];
  if (mode !== 'submit-incident') throw new Error(`Unknown incident command: ${mode ?? '(missing)'}`);
  if (provider !== 'azure' && provider !== 'jira' && provider !== 'trello') throw new Error(`Unknown incident provider: ${provider ?? '(missing)'}`);
  if (!inputFile) throw new Error('Missing prepared incident file');
  await submitIncident(provider, inputFile);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown incident provider error');
  process.exitCode = 1;
});
