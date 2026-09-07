import { buildIncidentSignature, INCIDENT_SIGNATURE_MARKER } from '../../incident-signature';
import type { IncidentCandidate } from '../../incident.types';
import type { TrelloConfig, TrelloCreateCardInput } from './trello.types';

export function mapIncidentToTrelloCard(candidate: IncidentCandidate, config: TrelloConfig): TrelloCreateCardInput {
  return {
    idList: config.listId,
    name: `[QA-AUTO][${candidate.caseId}] ${candidate.bugTitle.replace(/^\[QA-AUTO\]\[[^\]]+\]\s*/i, '')}`,
    desc: buildTrelloDescription(candidate),
  };
}

export function buildTrelloDescription(candidate: IncidentCandidate): string {
  return [
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
    candidate.incidentDecision.reason,
    '',
    `${INCIDENT_SIGNATURE_MARKER}`,
    buildIncidentSignature(candidate),
  ].join('\n');
}
