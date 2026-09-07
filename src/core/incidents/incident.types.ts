import type {
  EvidenceReference,
  NormalizedTestResult,
} from '../results/normalized-test-result.types';

/** TG-REQ-008: minimum failure classifications without assuming product defect. */
export type FailureClassification =
  | 'PRODUCT_DEFECT'
  | 'AUTOMATION_DEFECT'
  | 'TEST_DATA'
  | 'ENVIRONMENT'
  | 'UNKNOWN';

export interface FailureClassificationResult {
  readonly classification: FailureClassification;
  readonly reason: string;
}

export interface FailureClassifier {
  classify(result: NormalizedTestResult): FailureClassificationResult;
}

export interface IncidentModel {
  readonly applicationId: string;
  readonly caseId: string;
  readonly title: string;
  readonly classification: FailureClassificationResult;
  readonly error: string;
  readonly evidence: readonly EvidenceReference[];
  readonly occurredAt: string;
  readonly simulated: boolean;
  readonly context?: Readonly<Record<string, string>>;
}

export interface IncidentArtifact {
  readonly providerId: string;
  readonly path: string;
  readonly createdAt: string;
}

/** TG-REQ-008: provider boundary; the MVP implementation remains preview-only. */
export interface IncidentProvider {
  readonly id: string;
  writePreview(incident: IncidentModel): Promise<IncidentArtifact>;
}
