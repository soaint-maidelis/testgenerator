/** TG-REQ-005: Playwright-independent catalog contract and case traceability. */
export type CatalogInputData = Readonly<Record<string, unknown>>;

export interface CatalogStep {
  readonly order: number;
  readonly action: string;
  readonly expectedResult?: string;
}

export interface CatalogSource {
  readonly type: string;
  readonly file: string;
  readonly sourceId?: string;
  readonly row?: number;
  readonly originalReference?: string;
}

export interface CatalogCase {
  readonly caseId: string;
  readonly title: string;
  readonly description: string;
  readonly preconditions: readonly string[];
  readonly inputData: CatalogInputData;
  readonly steps: readonly CatalogStep[];
  readonly expectedResults: readonly string[];
  readonly priority: string;
  readonly type: string;
  readonly tags: readonly string[];
  readonly automationStatus: string;
  readonly source?: CatalogSource;
  readonly sourceType?: string;
  readonly reviewStatus?: string;
}

export interface TestCatalog {
  readonly applicationId: string;
  readonly cases: readonly CatalogCase[];
}
