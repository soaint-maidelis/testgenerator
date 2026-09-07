import { buildIncidentSignature, INCIDENT_SIGNATURE_MARKER, normalizeIncidentSignature } from '../../incident-signature';
import type { IncidentCandidate } from '../../incident.types';
import type { JiraIssue } from './jira.types';
import { extractTextFromAdf } from './jira-adf';

export function findJiraDuplicateBySignature(candidate: IncidentCandidate, issues: JiraIssue[]): JiraIssue | undefined {
  const expected = normalizeIncidentSignature(buildIncidentSignature(candidate));

  return issues.find((issue) => {
    const description = extractTextFromAdf(issue.fields?.description);
    const signature = extractJiraIncidentSignature(description);
    return signature !== undefined && normalizeIncidentSignature(signature) === expected;
  });
}

export function extractJiraIncidentSignature(description: string): string | undefined {
  const match = description.match(new RegExp(`${INCIDENT_SIGNATURE_MARKER}\\s*([^\\r\\n]+)`, 'i'));
  return match?.[1]?.trim() || undefined;
}
