import type { IncidentCandidate } from '../../incident.types';
import type { IncidentProvider } from '../incident-provider';
import type { IncidentDuplicateResult, IncidentProviderCreateResult, IncidentProviderResult, ProcessIncidentInput } from '../incident-provider.types';

export class NoneProvider implements IncidentProvider {
  readonly name = 'none' as const;

  async findDuplicate(_candidate: IncidentCandidate): Promise<IncidentDuplicateResult> {
    return { duplicate: false };
  }

  async createIncident(_candidate: IncidentCandidate): Promise<IncidentProviderCreateResult> {
    throw new Error('INCIDENT_PROVIDER=none no crea incidencias.');
  }

  async processIncident(_input: ProcessIncidentInput): Promise<IncidentProviderResult> {
    return {
      provider: this.name,
      status: 'SKIPPED',
      message: 'INCIDENT_PROVIDER=none',
    };
  }
}
