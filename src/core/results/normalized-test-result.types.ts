/** TG-REQ-007: runner-neutral execution result consumed by core capabilities. */
export type NormalizedTestStatus = 'passed' | 'failed' | 'skipped';

export type EvidenceKind = 'screenshot' | 'trace' | 'video' | 'log' | 'other';

export interface EvidenceReference {
  readonly kind: EvidenceKind;
  readonly path: string;
}

export interface NormalizedFailure {
  readonly message: string;
  readonly stack?: string;
  readonly source?: string;
}

export interface NormalizedTestResult {
  readonly applicationId: string;
  readonly caseId: string;
  readonly title: string;
  readonly status: NormalizedTestStatus;
  readonly durationMs: number;
  readonly startedAt: string;
  readonly evidence: readonly EvidenceReference[];
  readonly failure?: NormalizedFailure;
}
