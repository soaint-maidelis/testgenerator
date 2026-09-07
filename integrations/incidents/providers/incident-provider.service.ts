import type { IncidentCandidate, IncidentRuntimeConfig } from '../incident.types';
import type { IncidentProvider } from './incident-provider';
import type { IncidentProviderResult } from './incident-provider.types';
import { createIncidentProvider, type IncidentProviderFactoryDependencies } from './incident-provider.factory';

export async function processIncidentWithProvider(
  candidate: IncidentCandidate,
  config: IncidentRuntimeConfig,
  dependencies: IncidentProviderFactoryDependencies = {},
): Promise<IncidentProviderResult> {
  const provider = createIncidentProvider(config, dependencies);
  return processIncident(provider, candidate, config);
}

export async function processIncident(
  provider: IncidentProvider,
  candidate: IncidentCandidate,
  config: IncidentRuntimeConfig,
): Promise<IncidentProviderResult> {
  if (provider.processIncident) {
    return provider.processIncident({ candidate, config });
  }

  const gate = evaluateProviderGate(candidate, config);
  if (!gate.ok) {
    return { provider: provider.name, status: 'SKIPPED', message: gate.reason };
  }

  try {
    const duplicate = await provider.findDuplicate(candidate);
    if (duplicate.duplicate) {
      const attachments = provider.processEvidence ? await provider.processEvidence(duplicate.incident, candidate) : undefined;
      return {
        provider: provider.name,
        status: 'DUPLICATE',
        incidentId: duplicate.incident.incidentId,
        incidentUrl: duplicate.incident.incidentUrl,
        attachments,
        message: duplicate.message,
      };
    }

    const created = await provider.createIncident(candidate);
    const attachments = provider.processEvidence ? await provider.processEvidence(created, candidate) : undefined;
    return {
      provider: provider.name,
      status: 'CREATED',
      incidentId: created.incidentId,
      incidentUrl: created.incidentUrl,
      attachments,
      message: created.message,
    };
  } catch (error) {
    return {
      provider: provider.name,
      status: 'ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function evaluateProviderGate(candidate: IncidentCandidate, config: IncidentRuntimeConfig): { ok: true } | { ok: false; reason: string } {
  if (config.provider === 'none') {
    return { ok: false, reason: 'INCIDENT_PROVIDER=none' };
  }

  if (config.mode === 'preview') {
    return { ok: false, reason: 'INCIDENT_MODE=preview' };
  }

  if (!config.autoCreateIncidents) {
    return { ok: false, reason: 'AUTO_CREATE_INCIDENTS=false' };
  }

  if (candidate.incidentDecision.decision !== 'BUG_AUTO' || candidate.incidentDecision.confidence !== 'HIGH') {
    return { ok: false, reason: 'NO ELEGIBLE' };
  }

  return { ok: true };
}
