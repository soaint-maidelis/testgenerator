import type { NormalizedTestResult } from '../results/normalized-test-result.types';
import type { FailureClassificationResult, IncidentModel } from './incident.types';

export function createIncidentModel(
  result: NormalizedTestResult,
  classification: FailureClassificationResult,
  occurredAt = new Date().toISOString(),
  context?: Readonly<Record<string, string>>,
): IncidentModel {
  if (result.status !== 'failed' || result.failure === undefined) {
    throw new Error('An incident preview requires a failed NormalizedTestResult with failure details');
  }

  return Object.freeze({
    applicationId: result.applicationId,
    caseId: result.caseId,
    title: result.title,
    classification,
    error: result.failure.message,
    evidence: result.evidence,
    occurredAt,
    simulated: true,
    ...(context === undefined ? {} : { context }),
  });
}
