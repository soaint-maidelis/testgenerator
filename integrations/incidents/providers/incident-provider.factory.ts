import type { AzureIncidentClient } from '../../../azure-devops/azure-devops.service';
import type { IncidentRuntimeConfig } from '../incident.types';
import type { IncidentProvider } from './incident-provider';
import { AzureProvider } from './azure/azure.provider';
import type { JiraClient } from './jira/jira.client';
import { JiraProvider } from './jira/jira.provider';
import { NoneProvider } from './none/none.provider';
import type { TrelloClient } from './trello/trello.client';
import { TrelloProvider } from './trello/trello.provider';

export type IncidentProviderFactoryDependencies = {
  azureClient?: AzureIncidentClient;
  jiraClient?: JiraClient;
  trelloClient?: TrelloClient;
};

export function createIncidentProvider(
  config: IncidentRuntimeConfig,
  dependencies: IncidentProviderFactoryDependencies = {},
): IncidentProvider {
  switch (config.provider) {
    case 'azure':
      return new AzureProvider(config, dependencies.azureClient);
    case 'jira':
      return new JiraProvider(config, dependencies.jiraClient);
    case 'trello':
      return new TrelloProvider(config, dependencies.trelloClient);
    case 'none':
      return new NoneProvider();
    default:
      throw new Error(`INCIDENT_PROVIDER no soportado: ${String(config.provider)}`);
  }
}
