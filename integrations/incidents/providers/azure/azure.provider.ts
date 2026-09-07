import { processAzureIncident, type AzureIncidentClient } from '../../../../azure-devops/azure-devops.service';
import type { AzureIncidentResult, IncidentCandidate, IncidentRuntimeConfig } from '../../incident.types';
import type { IncidentProvider } from '../incident-provider';
import type {
  IncidentDuplicateResult,
  IncidentProviderCreateResult,
  IncidentProviderResult,
  ProcessIncidentInput,
} from '../incident-provider.types';

export class AzureProvider implements IncidentProvider {
  readonly name = 'azure' as const;

  constructor(
    private readonly config: IncidentRuntimeConfig,
    private readonly client?: AzureIncidentClient,
  ) {}

  async findDuplicate(_candidate: IncidentCandidate): Promise<IncidentDuplicateResult> {
    throw new Error('AzureProvider usa processAzureIncident como adapter estable en esta fase.');
  }

  async createIncident(_candidate: IncidentCandidate): Promise<IncidentProviderCreateResult> {
    throw new Error('AzureProvider usa processAzureIncident como adapter estable en esta fase.');
  }

  async processIncident(input: ProcessIncidentInput): Promise<IncidentProviderResult> {
    const azureResult = await processAzureIncident(input.candidate, this.config, this.client);
    return mapAzureResultToProviderResult(azureResult);
  }
}

export function mapAzureResultToProviderResult(result: AzureIncidentResult): IncidentProviderResult {
  const workItemId = 'workItemId' in result ? result.workItemId : undefined;

  return {
    provider: 'azure',
    status: result.status,
    incidentId: workItemId ? String(workItemId) : undefined,
    incidentUrl: 'url' in result ? result.url : undefined,
    attachments: result.attachments,
    message: 'message' in result ? result.message : 'reason' in result ? result.reason : undefined,
    statusCode: 'statusCode' in result ? result.statusCode : undefined,
    operation: 'operation' in result ? result.operation : undefined,
    duplicateSignature: result.duplicateSignature,
    legacy: workItemId ? { workItemId } : undefined,
  };
}
