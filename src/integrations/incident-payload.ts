import { sanitizeSensitiveText } from '../core/security/sanitize';
import type { IncidentModel } from '../core/incidents/incident.types';

export function buildIncidentTitle(incident: IncidentModel): string {
  const prefix = incident.simulated ? '[SIMULATED_DEMO_FAILURE]' : `[${incident.classification.classification}]`;
  return `${prefix} ${incident.caseId} - ${sanitizeSensitiveText(incident.title)}`;
}

export function buildIncidentDescription(incident: IncidentModel, provider: string): string {
  const context = incident.context ?? {};
  const evidence = incident.evidence.map((item) => `- ${item.kind}: ${item.path}`);
  return sanitizeSensitiveText([
    'QGenerator Incident',
    '',
    `Provider: ${provider}`,
    `Case ID: ${incident.caseId}`,
    `Application: ${incident.applicationId}`,
    `Scenario: ${context.scenario ?? incident.title}`,
    `Priority: ${context.priority ?? 'Not provided'}`,
    `Source Type: ${context.sourceType ?? 'Not provided'}`,
    `Classification: ${incident.classification.classification}`,
    `Reason: ${incident.classification.reason}`,
    `Environment: ${context.environment ?? 'demo'}`,
    `Browser: ${context.browser ?? 'Not provided'}`,
    `Timestamp: ${incident.occurredAt}`,
    '',
    'Expected:',
    context.expected ?? 'Not provided',
    '',
    'Actual:',
    context.actual ?? incident.error,
    '',
    'Technical Error:',
    incident.error,
    '',
    'Evidence available locally:',
    ...evidence,
    '- Report: playwright-report/index.html',
    '',
    `Simulation: ${incident.simulated ? 'YES' : 'NO'}`,
    ...(incident.simulated ? [`Marker: ${context.marker ?? 'SIMULATED_DEMO_FAILURE'}`] : []),
  ].join('\n'));
}
