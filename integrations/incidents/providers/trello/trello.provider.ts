import type { IncidentCandidate, IncidentRuntimeConfig } from '../../incident.types';
import type { IncidentProvider } from '../incident-provider';
import type {
  IncidentAttachmentResult,
  IncidentDuplicateResult,
  IncidentProviderCreateResult,
  IncidentProviderResult,
  ProcessIncidentInput,
} from '../incident-provider.types';
import { TrelloHttpClient, type TrelloClient } from './trello.client';
import { findTrelloDuplicateBySignature } from './trello.dedup';
import { readTrelloMaxAttachmentMb, uploadTrelloEvidenceFiles, type TrelloEvidenceFile } from './trello.evidence';
import { mapIncidentToTrelloCard } from './trello.mapper';
import type { TrelloConfig } from './trello.types';

export class TrelloProvider implements IncidentProvider {
  readonly name = 'trello' as const;

  constructor(
    private readonly config: IncidentRuntimeConfig,
    private readonly client: TrelloClient = new TrelloHttpClient(getTrelloConfig(config)),
  ) {}

  async processIncident(input: ProcessIncidentInput): Promise<IncidentProviderResult> {
    const gate = evaluateTrelloGate(input.candidate, this.config);
    if (!gate.ok) {
      return { provider: this.name, status: 'SKIPPED', message: gate.reason };
    }

    const validation = await this.client.validateConnection();
    if (validation.status !== 'VALID') {
      return { provider: this.name, status: 'ERROR', message: validation.message ?? validation.status, statusCode: validation.statusCode };
    }

    let duplicate: IncidentDuplicateResult;
    try {
      duplicate = await this.findDuplicate(input.candidate);
    } catch (error) {
      return { provider: this.name, status: 'ERROR', message: error instanceof Error ? error.message : String(error) };
    }

    if (duplicate.duplicate) {
      const attachments = await this.processEvidence(duplicate.incident, input.candidate);
      return {
        provider: this.name,
        status: 'DUPLICATE',
        incidentId: duplicate.incident.incidentId,
        incidentUrl: duplicate.incident.incidentUrl,
        attachments,
      };
    }

    if (this.config.trelloValidateOnly) {
      mapIncidentToTrelloCard(input.candidate, getTrelloConfig(this.config));
      return { provider: this.name, status: 'VALIDATED', message: 'TRELLO_VALIDATE_ONLY=true' };
    }

    try {
      const created = await this.createIncident(input.candidate);
      const attachments = await this.processEvidence(created, input.candidate);
      return { provider: this.name, status: 'CREATED', incidentId: created.incidentId, incidentUrl: created.incidentUrl, attachments };
    } catch (error) {
      return { provider: this.name, status: 'ERROR', message: error instanceof Error ? error.message : String(error) };
    }
  }

  async findDuplicate(candidate: IncidentCandidate): Promise<IncidentDuplicateResult> {
    const cards = await this.client.getActiveCards(this.config.trelloBoardId, this.config.trelloListId);
    const duplicate = findTrelloDuplicateBySignature(candidate, cards);
    return duplicate
      ? { duplicate: true, incident: { provider: this.name, incidentId: duplicate.id, incidentUrl: duplicate.url } }
      : { duplicate: false };
  }

  async createIncident(candidate: IncidentCandidate): Promise<IncidentProviderCreateResult> {
    const card = await this.client.createCard(mapIncidentToTrelloCard(candidate, getTrelloConfig(this.config)));
    return { provider: this.name, incidentId: card.id, incidentUrl: card.url ?? card.shortUrl };
  }

  async processEvidence(incident: IncidentProviderCreateResult, candidate: IncidentCandidate): Promise<IncidentAttachmentResult[]> {
    if (!this.config.attachEvidence) {
      return [
        { type: 'screenshot', status: 'SKIPPED', reason: 'INCIDENT_ATTACH_EVIDENCE=false' },
        { type: 'trace', status: 'SKIPPED', reason: 'INCIDENT_ATTACH_EVIDENCE=false' },
        { type: 'video', status: 'SKIPPED', reason: 'INCIDENT_ATTACH_EVIDENCE=false' },
      ];
    }

    const maxAttachmentMb = readTrelloMaxAttachmentMb();
    const files: TrelloEvidenceFile[] = [
      {
        type: 'screenshot',
        filePath: candidate.evidence.screenshot[0] ?? '',
        fileName: buildTrelloEvidenceFileName(candidate, 'screenshot', 'png'),
        maxAttachmentMb,
      },
      {
        type: 'trace',
        filePath: candidate.evidence.trace[0] ?? '',
        fileName: buildTrelloEvidenceFileName(candidate, 'trace', 'zip'),
        maxAttachmentMb,
      },
    ];
    const results = await uploadTrelloEvidenceFiles(this.client, incident.incidentId, files);

    if (!this.config.attachVideo) {
      return [...results, { type: 'video', status: 'SKIPPED', reason: 'VIDEO_DISABLED' }];
    }

    const [video] = await uploadTrelloEvidenceFiles(this.client, incident.incidentId, [
      {
        type: 'video',
        filePath: candidate.evidence.video[0] ?? '',
        fileName: buildTrelloEvidenceFileName(candidate, 'video', 'webm'),
        maxAttachmentMb,
        maxVideoMb: this.config.maxVideoMb,
      },
    ]);
    return [...results, video];
  }
}

function getTrelloConfig(config: IncidentRuntimeConfig): TrelloConfig {
  return {
    baseUrl: process.env.TRELLO_BASE_URL?.trim() || 'https://api.trello.com/1',
    boardId: config.trelloBoardId,
    listId: config.trelloListId,
    apiKey: process.env.TRELLO_API_KEY?.trim() ?? '',
    token: process.env.TRELLO_TOKEN?.trim() ?? '',
    requestTimeoutMs: config.requestTimeoutMs,
  };
}

function evaluateTrelloGate(candidate: IncidentCandidate, config: IncidentRuntimeConfig): { ok: true } | { ok: false; reason: string } {
  if (config.provider !== 'trello') {
    return { ok: false, reason: `INCIDENT_PROVIDER=${config.provider}` };
  }

  if (config.mode === 'preview') {
    return { ok: false, reason: 'INCIDENT_MODE=preview' };
  }

  if (!config.autoCreateIncidents) {
    return { ok: false, reason: 'AUTO_CREATE_INCIDENTS=false' };
  }

  if (candidate.incidentDecision.decision !== 'BUG_AUTO') {
    return { ok: false, reason: 'decision!=BUG_AUTO' };
  }

  if (candidate.incidentDecision.confidence !== 'HIGH') {
    return { ok: false, reason: 'confidence!=HIGH' };
  }

  return { ok: true };
}

function buildTrelloEvidenceFileName(candidate: IncidentCandidate, type: 'screenshot' | 'trace' | 'video', extension: string): string {
  return `QA-AUTO-${candidate.caseId}-${candidate.project}-retry-${candidate.retry}-${type}.${extension}`;
}
