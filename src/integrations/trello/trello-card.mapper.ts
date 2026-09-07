import { sanitizeSensitiveText } from '../../core/security/sanitize';
import type { IncidentModel } from '../../core/incidents/incident.types';
import type { TrelloCardPayload } from './trello-client';

export function mapIncidentToTrelloCard(incident: IncidentModel, environment = 'demo'): TrelloCardPayload {
  const context = incident.context ?? {};
  const evidenceByKind = new Map(incident.evidence.map((item) => [item.kind, item.path]));
  const evidence = [
    `- Screenshot: ${evidenceByKind.get('screenshot') ?? 'Not available'}`,
    `- Trace: ${evidenceByKind.get('trace') ?? 'Not available'}`,
    `- Video: ${evidenceByKind.get('video') ?? 'Not available'}`,
    '- Report: playwright-report/index.html',
  ];
  const localEvidence = incident.evidence.map((item) => `- ${label(item.kind)}: ${item.path}`);
  const simulation = incident.simulated ? ['', 'Simulation: YES', `Marker: ${context.marker ?? 'SIMULATED_DEMO_FAILURE'}`] : [];
  const lines = [
    'TestGenerator Incident', '',
    `Case ID: ${incident.caseId}`,
    `Application: ${incident.applicationId}`,
    `Scenario: ${context.scenario ?? incident.title}`,
    `Priority: ${context.priority ?? 'Not provided'}`,
    `Source Type: ${context.sourceType ?? 'Not provided'}`,
    `Classification: ${incident.classification.classification}`,
    `Environment: ${context.environment ?? environment}`,
    `Browser: ${context.browser ?? 'Not provided'}`,
    `Timestamp: ${incident.occurredAt}`, '',
    'Expected:', context.expected ?? 'Not provided', '',
    'Actual:', context.actual ?? incident.error, '',
    'Technical Error:', incident.error, '',
    'Evidence:', ...evidence,
    '', 'Evidence available locally:', ...localEvidence, '- Report: playwright-report/index.html',
    ...simulation,
  ];
  return {
    name: `${incident.simulated ? '[SIMULATED_DEMO_FAILURE]' : `[${incident.classification.classification}]`} ${incident.caseId} - ${sanitizeSensitiveText(incident.title)}`,
    desc: sanitizeSensitiveText(lines.join('\n')),
  };
}

function label(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
