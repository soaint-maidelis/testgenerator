export interface TestStrategyCase {
  readonly feature: string;
  readonly suites: readonly string[];
  readonly risk: string;
  readonly tags?: readonly string[];
  readonly role?: string;
  readonly dependencies?: readonly string[];
}

export interface TestStrategy {
  readonly applicationId: string;
  readonly suites: readonly string[];
  readonly features: readonly string[];
  readonly cases: Readonly<Record<string, TestStrategyCase>>;
}

export interface TestStrategyFilter {
  readonly suite?: string;
  readonly feature?: string;
  readonly priority?: string;
}
