import { buildIncidentSignature, INCIDENT_SIGNATURE_MARKER, normalizeIncidentSignature } from '../../incident-signature';
import type { IncidentCandidate } from '../../incident.types';
import type { TrelloCard } from './trello.types';

export function findTrelloDuplicateBySignature(candidate: IncidentCandidate, cards: TrelloCard[]): TrelloCard | undefined {
  const expected = normalizeIncidentSignature(buildIncidentSignature(candidate));

  return cards.find((card) => {
    if (card.closed) {
      return false;
    }

    const signature = extractTrelloIncidentSignature(card.desc ?? '');
    return signature !== undefined && normalizeIncidentSignature(signature) === expected;
  });
}

export function extractTrelloIncidentSignature(description: string): string | undefined {
  const match = description.match(new RegExp(`${INCIDENT_SIGNATURE_MARKER}\\s*([^\\r\\n]+)`, 'i'));
  return match?.[1]?.trim() || undefined;
}
