import { buildIncidentSignature, INCIDENT_SIGNATURE_MARKER } from '../../incident-signature';
import type { IncidentCandidate } from '../../incident.types';
import type { JiraConfig, JiraCreateIssueInput } from './jira.types';
import { linesToAdf, type JiraAdfDocument } from './jira-adf';

export function mapIncidentToJiraIssue(candidate: IncidentCandidate, config: JiraConfig): JiraCreateIssueInput {
  return {
    fields: {
      project: { key: config.projectKey },
      summary: buildJiraSummary(candidate),
      description: buildJiraDescription(candidate),
      issuetype: { name: config.issueType || 'Bug' },
      labels: buildJiraLabels(candidate),
    },
  };
}

export function buildJiraDescription(candidate: IncidentCandidate): JiraAdfDocument {
  return linesToAdf([
    `Caso: ${candidate.caseId}`,
    `Bloque: ${candidate.block}`,
    `Clasificacion: ${candidate.incidentDecision.classification}`,
    `Causa probable: ${candidate.incidentDecision.probableCause}`,
    `Fase: ${candidate.phase}`,
    `Mensaje: ${candidate.errorMessage}`,
    `Rol: ${candidate.role}`,
    `Proyecto: ${candidate.project}`,
    `Vista: ${candidate.technicalDiagnostic.view}`,
    `Resultado esperado: ${candidate.expectedResult}`,
    `Resultado observado: ${candidate.observedResult}`,
    `URL: ${candidate.finalUrl}`,
    `Origen tecnico: ${candidate.errorOrigin}`,
    '',
    'Diagnostico:',
    candidate.incidentDecision.reason,
    '',
    `${INCIDENT_SIGNATURE_MARKER}`,
    buildIncidentSignature(candidate),
  ]);
}

export function buildJiraSummary(candidate: IncidentCandidate): string {
  const rawSummary = candidate.bugTitle.replace(/^\[QA-AUTO]\[[^\]]+]\s*/i, '').trim() || candidate.title;
  return `[QA-AUTO][${candidate.caseId}] ${rawSummary}`;
}

export function buildJiraLabels(candidate: IncidentCandidate): string[] {
  return [
    'QA-AUTO',
    'Playwright',
    sanitizeLabel(candidate.caseId),
    sanitizeLabel(candidate.incidentDecision.classification),
    sanitizeLabel(candidate.incidentDecision.probableCause),
  ].filter(Boolean);
}

function sanitizeLabel(value: string): string {
  return value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
}
