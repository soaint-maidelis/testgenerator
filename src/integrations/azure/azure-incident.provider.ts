import type { IncidentArtifact, IncidentModel, IncidentProvider } from '../../core/incidents/incident.types';
import { buildIncidentDescription, buildIncidentTitle } from '../incident-payload';
import { uploadIncidentEvidence, type EvidenceUploadResult } from '../provider-evidence';
import type { AzureClient } from './azure-client';

export interface AzureIncidentArtifact extends IncidentArtifact {
  readonly workItemId: number;
  readonly duplicate: boolean;
  readonly attachments: readonly EvidenceUploadResult[];
}

export class AzureIncidentProvider implements IncidentProvider {
  readonly id = 'azure';

  constructor(private readonly client: AzureClient) {}

  async writePreview(incident: IncidentModel): Promise<AzureIncidentArtifact> {
    const existing = await this.findExistingIncident(incident);
    if (existing) {
      return {
        providerId: this.id,
        path: this.client.workItemUrl(existing.id),
        createdAt: new Date().toISOString(),
        workItemId: existing.id,
        duplicate: true,
        attachments: [],
      };
    }

    const workItem = await this.client.createWorkItem({
      title: buildIncidentTitle(incident),
      description: buildIncidentDescription(incident, 'Azure DevOps'),
    });
    const attachments = await uploadIncidentEvidence(incident, async (filePath, fileName) => {
      await this.client.uploadAttachment(workItem.id, filePath, fileName);
    });
    return {
      providerId: this.id,
      path: this.client.workItemUrl(workItem.id),
      createdAt: new Date().toISOString(),
      workItemId: workItem.id,
      duplicate: false,
      attachments,
    };
  }

  private async findExistingIncident(incident: IncidentModel): Promise<{ readonly id: number } | undefined> {
    if (typeof this.client.queryWorkItems !== 'function') return undefined;
    const marker = incident.context?.marker ?? 'SIMULATED_DEMO_FAILURE';
    const items = await this.client.queryWorkItems([
      'SELECT [System.Id]',
      'FROM WorkItems',
      `WHERE [System.Tags] CONTAINS 'QA-AUTO'`,
      `AND [System.State] <> 'Closed'`,
      `AND [System.Title] CONTAINS '${escapeWiql(incident.caseId)}'`,
      `AND [System.Description] CONTAINS '${escapeWiql(marker)}'`,
      'ORDER BY [System.ChangedDate] DESC',
    ].join(' '));
    return items[0];
  }
}

function escapeWiql(value: string): string {
  return value.replace(/'/g, "''");
}
