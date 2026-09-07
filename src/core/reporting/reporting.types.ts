import type { NormalizedTestResult } from '../results/normalized-test-result.types';
import type { FailureClassification } from '../incidents/incident.types';

/** TG-REQ-007: reporting consumes normalized results, never runner internals. */
export type ReportFormat = 'html' | 'json' | 'markdown';

export interface ReportingInput {
  readonly applicationId: string;
  readonly generatedAt: string;
  readonly results: readonly NormalizedTestResult[];
  readonly classifications?: Readonly<Record<string, FailureClassification>>;
}

export interface ReportingSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly durationMs: number;
}

export interface ReportArtifact {
  readonly format: ReportFormat;
  readonly path: string;
}

export interface ReportingOutput {
  readonly summary: ReportingSummary;
  readonly artifacts: readonly ReportArtifact[];
}
