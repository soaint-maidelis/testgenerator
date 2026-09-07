import type { CatalogCase, TestCatalog } from '../cases/catalog.types';
import type { TestStrategy, TestStrategyFilter } from './test-strategy.types';

export function validateTestStrategy(strategy: TestStrategy, catalog: TestCatalog): void {
  const errors: string[] = [];
  if (strategy.applicationId !== catalog.applicationId) errors.push('strategy applicationId must match catalog');
  assertUnique(strategy.suites, 'suite', errors);
  assertUnique(strategy.features, 'feature', errors);
  const catalogIds = new Set(catalog.cases.map(({ caseId }) => caseId));
  for (const [caseId, metadata] of Object.entries(strategy.cases)) {
    if (!catalogIds.has(caseId)) errors.push(`strategy references unknown case ${caseId}`);
    if (!strategy.features.includes(metadata.feature)) errors.push(`${caseId} references unknown feature ${metadata.feature}`);
    for (const suite of metadata.suites) if (!strategy.suites.includes(suite)) errors.push(`${caseId} references unknown suite ${suite}`);
    for (const dependency of metadata.dependencies ?? []) if (!catalogIds.has(dependency)) errors.push(`${caseId} has missing dependency ${dependency}`);
  }
  detectCycles(strategy, errors);
  if (errors.length > 0) throw new Error(`Invalid TestStrategy:\n- ${errors.join('\n- ')}`);
}

export function selectStrategyCases(strategy: TestStrategy, catalog: TestCatalog, filter: TestStrategyFilter): readonly CatalogCase[] {
  validateTestStrategy(strategy, catalog);
  const matched = catalog.cases.filter((testCase) => {
    const metadata = strategy.cases[testCase.caseId];
    if (!metadata) return false;
    return (!filter.suite || metadata.suites.includes(filter.suite))
      && (!filter.feature || metadata.feature === filter.feature)
      && (!filter.priority || testCase.priority === filter.priority);
  });
  const selected = new Set(matched.map(({ caseId }) => caseId));
  const ordered: CatalogCase[] = [];
  const visited = new Set<string>();
  const byId = new Map(matched.map((entry) => [entry.caseId, entry]));
  const visit = (caseId: string): void => {
    if (visited.has(caseId)) return;
    visited.add(caseId);
    for (const dependency of strategy.cases[caseId]?.dependencies ?? []) if (selected.has(dependency)) visit(dependency);
    const entry = byId.get(caseId); if (entry) ordered.push(entry);
  };
  matched.forEach(({ caseId }) => visit(caseId));
  return ordered;
}

function assertUnique(values: readonly string[], label: string, errors: string[]): void {
  if (new Set(values).size !== values.length) errors.push(`${label} values must be unique`);
}

function detectCycles(strategy: TestStrategy, errors: string[]): void {
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (caseId: string): void => {
    if (visiting.has(caseId)) { errors.push(`dependency cycle detected at ${caseId}`); return; }
    if (visited.has(caseId)) return;
    visiting.add(caseId);
    for (const dependency of strategy.cases[caseId]?.dependencies ?? []) if (strategy.cases[dependency]) visit(dependency);
    visiting.delete(caseId); visited.add(caseId);
  };
  Object.keys(strategy.cases).forEach(visit);
}
