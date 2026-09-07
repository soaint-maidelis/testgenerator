import type { CatalogCase, TestCatalog } from '../cases/catalog.types';

export type InputSourceType = string;
export type InputReviewStatus = 'REQUIRES_QA_REVIEW' | 'APPROVED';

export interface NormalizedCatalogCase extends Omit<CatalogCase, 'sourceType' | 'reviewStatus'> {
  readonly sourceType?: InputSourceType;
  readonly reviewStatus?: InputReviewStatus;
  readonly approvedAt?: string;
}

export interface NormalizedTestCatalog extends Omit<TestCatalog, 'cases'> {
  readonly cases: readonly NormalizedCatalogCase[];
  readonly warnings: readonly string[];
}

export interface InputNormalizationContext {
  readonly fileName: string;
  readonly applicationId?: string;
}
