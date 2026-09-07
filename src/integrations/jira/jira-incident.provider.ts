import type { IncidentArtifact, IncidentModel, IncidentProvider } from '../../core/incidents/incident.types';
import { buildIncidentDescription, buildIncidentTitle } from '../incident-payload';
import { uploadIncidentEvidence, type EvidenceUploadResult } from '../provider-evidence';
import type { JiraClient } from './jira-client';

export interface JiraIncidentArtifact extends IncidentArtifact {
  readonly issueKey: string;
  readonly duplicate: boolean;
  readonly attachments: readonly EvidenceUploadResult[];
}

export class JiraIncidentProvider implements IncidentProvider {
  readonly id = 'jira';

  constructor(private readonly client: JiraClient, private readonly projectKey?: string) {}

  async writePreview(incident: IncidentModel): Promise<JiraIncidentArtifact> {
    const existing = await this.findExistingIncident(incident);
    if (existing) {
      return {
        providerId: this.id,
        path: this.client.issueUrl(existing.key),
        createdAt: new Date().toISOString(),
        issueKey: existing.key,
        duplicate: true,
        attachments: [],
      };
    }

    const issue = await this.client.createIssue({
      summary: buildIncidentTitle(incident),
      description: buildIncidentDescription(incident, 'Jira'),
    });
    const attachments = await uploadIncidentEvidence(incident, async (filePath, fileName) => {
      await this.client.uploadAttachment(issue.key, filePath, fileName);
    });
    return {
      providerId: this.id,
      path: this.client.issueUrl(issue.key),
      createdAt: new Date().toISOString(),
      issueKey: issue.key,
      duplicate: false,
      attachments,
    };
  }

  private async findExistingIncident(incident: IncidentModel): Promise<{ readonly key: string } | undefined> {
    if (typeof this.client.searchIssues !== 'function') return undefined;
    const issues = await this.client.searchIssues([
      `project = "${escapeJqlProject(this.projectKey ?? '')}"`,
      'labels = QA-AUTO',
      `text ~ "${escapeJqlText(incident.caseId)}"`,
      `text ~ "${escapeJqlText(incident.context?.marker ?? 'SIMULATED_DEMO_FAILURE')}"`,
      'statusCategory != Done',
    ].filter((part) => !part.startsWith('project = ""')).join(' AND '));
    return issues[0];
  }
}

function escapeJqlText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeJqlProject(value: string): string {
  return escapeJqlText(value);
}
