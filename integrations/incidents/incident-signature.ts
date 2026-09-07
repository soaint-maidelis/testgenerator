import type { AzureEvidenceAttachmentType, IncidentCandidate } from './incident.types';

export const INCIDENT_SIGNATURE_MARKER = 'QA-AUTO-SIGNATURE:';
export const INCIDENT_EVIDENCE_SIGNATURE_MARKER = 'QA-AUTO-EVIDENCE:';

export function buildIncidentSignature(candidate: IncidentCandidate): string {
  return [
    normalizeSignaturePart(candidate.caseId),
    normalizeSignaturePart(candidate.incidentDecision.probableCause),
    normalizeSignaturePart(candidate.technicalDiagnostic.view),
  ].join('|');
}

export function buildIncidentEvidenceSignature(candidate: IncidentCandidate, type: AzureEvidenceAttachmentType): string {
  return `${candidate.caseId}|${candidate.project}|${candidate.retry}|${type}`;
}

export function normalizeIncidentSignature(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .trim()
    .split('|')
    .map((part) => part.replace(/\s+/g, ' ').trim().toLowerCase())
    .join('|');
}

function normalizeSignaturePart(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized && !/^(unknown|undefined|null|n\/a)$/i.test(normalized) ? normalized : 'N/D';
}
