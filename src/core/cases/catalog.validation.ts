import type { TestCatalog } from './catalog.types';

const CASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class CatalogValidationError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(`Invalid test catalog:\n- ${errors.join('\n- ')}`);
    this.name = 'CatalogValidationError';
  }
}

export function parseTestCatalog(value: unknown): TestCatalog {
  const errors = getCatalogValidationErrors(value);
  if (errors.length > 0) throw new CatalogValidationError(errors);
  return value as TestCatalog;
}

export function getCatalogValidationErrors(value: unknown): readonly string[] {
  if (!isRecord(value)) return ['catalog must be an object'];

  const errors: string[] = [];
  validateString(value.applicationId, 'applicationId', errors);
  if (!Array.isArray(value.cases)) {
    errors.push('cases must be an array');
    return errors;
  }

  const ids = new Set<string>();
  value.cases.forEach((entry, index) => {
    const path = `cases[${index}]`;
    validateCatalogCase(entry, path, errors);
    if (isRecord(entry) && typeof entry.caseId === 'string') {
      if (ids.has(entry.caseId)) errors.push(`${path}.caseId must be unique`);
      ids.add(entry.caseId);
    }
  });
  return errors;
}

export function validateSpecCaseIds(
  catalog: TestCatalog,
  referencedCaseIds: readonly string[],
): void {
  const known = new Set(catalog.cases.map(({ caseId }) => caseId));
  const unknown = [...new Set(referencedCaseIds.filter((caseId) => !known.has(caseId)))];
  if (unknown.length > 0) {
    throw new CatalogValidationError(
      unknown.map((caseId) => `spec references unknown caseId "${caseId}"`),
    );
  }
}

function validateCatalogCase(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  validateCaseId(value.caseId, `${path}.caseId`, errors);
  validateString(value.title, `${path}.title`, errors);
  validateString(value.description, `${path}.description`, errors);
  validateStringArray(value.preconditions, `${path}.preconditions`, errors);
  if (!isRecord(value.inputData)) errors.push(`${path}.inputData must be an object`);
  validateSteps(value.steps, `${path}.steps`, errors);
  validateStringArray(value.expectedResults, `${path}.expectedResults`, errors);
  validateString(value.priority, `${path}.priority`, errors);
  validateString(value.type, `${path}.type`, errors);
  validateStringArray(value.tags, `${path}.tags`, errors);
  validateString(value.automationStatus, `${path}.automationStatus`, errors);
  validateSource(value.source, `${path}.source`, errors);
  if (value.sourceType !== undefined) validateString(value.sourceType, `${path}.sourceType`, errors);
  if (value.reviewStatus !== undefined) validateString(value.reviewStatus, `${path}.reviewStatus`, errors);
}

function validateSource(value: unknown, path: string, errors: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  validateString(value.type, `${path}.type`, errors);
  validateString(value.file, `${path}.file`, errors);
  if (value.sourceId !== undefined) validateString(value.sourceId, `${path}.sourceId`, errors);
  if (value.originalReference !== undefined) validateString(value.originalReference, `${path}.originalReference`, errors);
  if (value.row !== undefined && (!Number.isInteger(value.row) || (value.row as number) < 1)) {
    errors.push(`${path}.row must be a positive integer`);
  }
}

function validateCaseId(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== 'string' || !CASE_ID_PATTERN.test(value)) {
    errors.push(`${path} must be a non-empty identifier`);
  }
}

function validateString(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function validateStringArray(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    errors.push(`${path} must be an array of non-empty strings`);
  }
}

function validateSteps(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty array`);
    return;
  }

  const orders = new Set<number>();
  value.forEach((step, index) => {
    const stepPath = `${path}[${index}]`;
    if (!isRecord(step)) {
      errors.push(`${stepPath} must be an object`);
      return;
    }
    validateStep(step, stepPath, errors);
    if (typeof step.order === 'number') {
      if (orders.has(step.order)) errors.push(`${stepPath}.order must be unique`);
      orders.add(step.order);
    }
  });
}

function validateStep(value: Readonly<Record<string, unknown>>, path: string, errors: string[]): void {
  if (!Number.isInteger(value.order) || (value.order as number) < 1) {
    errors.push(`${path}.order must be a positive integer`);
  }
  validateString(value.action, `${path}.action`, errors);
  if (value.expectedResult !== undefined) {
    validateString(value.expectedResult, `${path}.expectedResult`, errors);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
