import type { IncidentCandidate, IncidentRuntimeConfig } from '../../incident.types';
import type { IncidentProvider } from '../incident-provider';
import type {
  IncidentAttachmentResult,
  IncidentDuplicateResult,
  IncidentProviderCreateResult,
  IncidentProviderResult,
  ProcessIncidentInput,
} from '../incident-provider.types';
import { JiraHttpClient, type JiraClient } from './jira.client';
import { findJiraDuplicateBySignature } from './jira.dedup';
import { uploadJiraEvidenceFiles, type JiraEvidenceFile } from './jira.evidence';
import { mapIncidentToJiraIssue } from './jira.mapper';
import type { JiraConfig } from './jira.types';

export class JiraProvider implements IncidentProvider {
  readonly name = 'jira' as const;

  constructor(
    private readonly config: IncidentRuntimeConfig,
    private readonly client: JiraClient = new JiraHttpClient(getJiraConfig(config)),
  ) {}

  async processIncident(input: ProcessIncidentInput): Promise<IncidentProviderResult> {
    const gate = evaluateJiraGate(input.candidate, this.config);
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

    if (this.config.jiraValidateOnly) {
      mapIncidentToJiraIssue(input.candidate, getJiraConfig(this.config));
      return {
        provider: this.name,
        status: 'VALIDATED',
        message: 'JIRA_VALIDATE_ONLY=true',
      };
    }

    try {
      const created = await this.createIncident(input.candidate);
      const attachments = await this.processEvidence(created, input.candidate);
      return {
        provider: this.name,
        status: 'CREATED',
        incidentId: created.incidentId,
        incidentUrl: created.incidentUrl,
        attachments,
      };
    } catch (error) {
      return { provider: this.name, status: 'ERROR', message: error instanceof Error ? error.message : String(error) };
    }
  }

  async findDuplicate(candidate: IncidentCandidate): Promise<IncidentDuplicateResult> {
    const issues = await this.client.searchIssues(buildJiraDuplicateJql(candidate, this.config));
    const duplicate = findJiraDuplicateBySignature(candidate, issues);
    return duplicate
      ? { duplicate: true, incident: { provider: this.name, incidentId: duplicate.key, incidentUrl: this.getIncidentUrl(duplicate.key) } }
      : { duplicate: false };
  }

  async createIncident(candidate: IncidentCandidate): Promise<IncidentProviderCreateResult> {
    const issue = await this.client.createIssue(mapIncidentToJiraIssue(candidate, getJiraConfig(this.config)));
    return { provider: this.name, incidentId: issue.key, incidentUrl: this.getIncidentUrl(issue.key) };
  }

  async processEvidence(incident: IncidentProviderCreateResult, candidate: IncidentCandidate): Promise<IncidentAttachmentResult[]> {
    if (!this.config.attachEvidence) {
      return [
        { type: 'screenshot', status: 'SKIPPED', reason: 'INCIDENT_ATTACH_EVIDENCE=false' },
        { type: 'trace', status: 'SKIPPED', reason: 'INCIDENT_ATTACH_EVIDENCE=false' },
        { type: 'video', status: 'SKIPPED', reason: 'INCIDENT_ATTACH_EVIDENCE=false' },
      ];
    }

    const files: JiraEvidenceFile[] = [
      { type: 'screenshot', filePath: candidate.evidence.screenshot[0] ?? '', fileName: buildJiraEvidenceFileName(candidate, 'screenshot', 'png') },
      { type: 'trace', filePath: candidate.evidence.trace[0] ?? '', fileName: buildJiraEvidenceFileName(candidate, 'trace', 'zip') },
    ];

    const results = await uploadJiraEvidenceFiles(this.client, incident.incidentId, files);
    if (!this.config.attachVideo) {
      return [...results, { type: 'video', status: 'SKIPPED', reason: 'VIDEO_DISABLED' }];
    }

    const [video] = await uploadJiraEvidenceFiles(this.client, incident.incidentId, [
      {
        type: 'video',
        filePath: candidate.evidence.video[0] ?? '',
        fileName: buildJiraEvidenceFileName(candidate, 'video', 'webm'),
        maxVideoMb: this.config.maxVideoMb,
      },
    ]);
    return [...results, video];
  }

  getIncidentUrl(issueKey: string): string | undefined {
    return this.config.jiraBaseUrl ? `${this.config.jiraBaseUrl.replace(/\/+$/g, '')}/browse/${issueKey}` : undefined;
  }
}

function getJiraConfig(config: IncidentRuntimeConfig): JiraConfig {
  return {
    baseUrl: config.jiraBaseUrl,
    projectKey: config.jiraProjectKey,
    email: config.jiraEmail,
    apiToken: process.env.JIRA_API_TOKEN?.trim() ?? '',
    issueType: config.jiraIssueType,
    requestTimeoutMs: config.requestTimeoutMs,
  };
}

function buildJiraDuplicateJql(candidate: IncidentCandidate, config: IncidentRuntimeConfig): string {
  return [
    `project = "${escapeJql(config.jiraProjectKey)}"`,
    'labels = QA-AUTO',
    `text ~ "${escapeJql(candidate.caseId)}"`,
    'statusCategory != Done',
  ].join(' AND ');
}

function evaluateJiraGate(candidate: IncidentCandidate, config: IncidentRuntimeConfig): { ok: true } | { ok: false; reason: string } {
  if (config.provider !== 'jira') {
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

function escapeJql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildJiraEvidenceFileName(candidate: IncidentCandidate, type: 'screenshot' | 'trace' | 'video', extension: string): string {
  return `QA-AUTO-${candidate.caseId}-${candidate.project}-retry-${candidate.retry}-${type}.${extension}`;
}
