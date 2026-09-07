import { access } from 'node:fs/promises';
import { basename } from 'node:path';

import type { IncidentArtifact, IncidentModel, IncidentProvider } from '../../core/incidents/incident.types';
import type { EvidenceKind } from '../../core/results/normalized-test-result.types';
import { mapIncidentToTrelloCard } from './trello-card.mapper';
import type { TrelloClient } from './trello-client';

export type TrelloEvidenceUploadStatus = 'LINKED' | 'FILE_NOT_FOUND' | 'UPLOAD_ERROR' | 'SKIPPED';

export interface TrelloEvidenceUploadResult {
  readonly kind: EvidenceKind;
  readonly path: string;
  readonly fileName: string;
  readonly status: TrelloEvidenceUploadStatus;
  readonly message?: string;
}

export interface TrelloIncidentArtifact extends IncidentArtifact {
  readonly attachments: readonly TrelloEvidenceUploadResult[];
}

export class TrelloIncidentProvider implements IncidentProvider {
  readonly id = 'trello';

  constructor(
    private readonly client: TrelloClient,
    private readonly listId: string,
    private readonly environment = 'demo',
  ) {}

  async writePreview(incident: IncidentModel): Promise<TrelloIncidentArtifact> {
    const card = await this.client.createCard(this.listId, mapIncidentToTrelloCard(incident, this.environment));
    const attachments = await this.uploadEvidence(card.id, incident);
    return { providerId: this.id, path: card.url, createdAt: new Date().toISOString(), attachments };
  }

  private async uploadEvidence(cardId: string, incident: IncidentModel): Promise<readonly TrelloEvidenceUploadResult[]> {
    const uploadableEvidence = incident.evidence.filter((item) => (
      item.kind === 'screenshot' || item.kind === 'video' || item.kind === 'trace'
    ));

    if (typeof this.client.uploadAttachment !== 'function') {
      return uploadableEvidence.map((item) => ({
        kind: item.kind,
        path: item.path,
        fileName: basename(item.path),
        status: 'SKIPPED',
        message: 'Trello client does not support attachments',
      }));
    }

    const results: TrelloEvidenceUploadResult[] = [];
    for (const evidence of uploadableEvidence) {
      const fileName = `${incident.caseId}-${evidence.kind}-${basename(evidence.path)}`;
      try {
        await access(evidence.path);
      } catch {
        results.push({ kind: evidence.kind, path: evidence.path, fileName, status: 'FILE_NOT_FOUND' });
        continue;
      }

      try {
        await this.client.uploadAttachment(cardId, evidence.path, fileName);
        results.push({ kind: evidence.kind, path: evidence.path, fileName, status: 'LINKED' });
      } catch (error) {
        results.push({
          kind: evidence.kind,
          path: evidence.path,
          fileName,
          status: 'UPLOAD_ERROR',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }
}
