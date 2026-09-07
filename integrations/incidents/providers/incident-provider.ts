import type { IncidentCandidate } from '../incident.types';
import type {
  IncidentAttachmentResult,
  IncidentDuplicateResult,
  IncidentProviderCreateResult,
  IncidentProviderName,
  IncidentProviderResult,
  IncidentReference,
  ProcessIncidentInput,
} from './incident-provider.types';

export interface IncidentProvider {
  readonly name: IncidentProviderName;

  findDuplicate(candidate: IncidentCandidate): Promise<IncidentDuplicateResult>;

  createIncident(candidate: IncidentCandidate): Promise<IncidentProviderCreateResult>;

  processEvidence?(incident: IncidentReference, candidate: IncidentCandidate): Promise<IncidentAttachmentResult[]>;

  getIncidentUrl?(incidentId: string): string | undefined;

  processIncident?(input: ProcessIncidentInput): Promise<IncidentProviderResult>;
}
