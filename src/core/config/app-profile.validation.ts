import { applyAppProfileDefaults } from './app-profile.defaults';
import type {
  AppProfile,
  AppProfileInput,
  EvidencePolicy,
  IncidentPolicy,
} from './app-profile.types';

const PROFILE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const DECLARATIVE_KEY_PATTERN = /^[a-z][A-Za-z0-9]*$/;

const EVIDENCE_VALUES = {
  trace: new Set<EvidencePolicy['trace']>(['off', 'retain-on-failure']),
  screenshot: new Set<EvidencePolicy['screenshot']>(['off', 'only-on-failure']),
  video: new Set<EvidencePolicy['video']>(['off', 'retain-on-failure', 'on']),
} as const;

/** TG-REQ-002: normalize a validated partial profile with safe defaults. */
export function normalizeAppProfile(value: unknown): AppProfile {
  assertValidAppProfileInput(value);
  return applyAppProfileDefaults(value);
}

export function assertValidAppProfileInput(value: unknown): asserts value is AppProfileInput {
  const errors = getAppProfileValidationErrors(value);

  if (errors.length > 0) {
    throw new Error(`Invalid AppProfile:\n- ${errors.join('\n- ')}`);
  }
}

export function getAppProfileValidationErrors(value: unknown): readonly string[] {
  if (!isRecord(value)) {
    return ['profile must be an object'];
  }

  const errors: string[] = [];
  validateId(value.id, 'id', errors);
  validateNonEmptyString(value.displayName, 'displayName', errors);
  validateHttpUrl(value.baseURL, 'baseURL', false, errors);
  validateHttpUrl(value.apiURL, 'apiURL', true, errors);
  validateRoles(value.roles, errors);
  validateStringArray(value.testMatch, 'testMatch', true, errors);
  validateBooleanRecord(value.capabilities, 'capabilities', true, errors);
  validateBooleanRecord(value.featureFlags, 'featureFlags', true, errors);
  validateEvidencePolicy(value.evidencePolicy, errors);
  validateIncidentPolicy(value.incidentPolicy, errors);
  return errors;
}

function validateId(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== 'string' || !PROFILE_ID_PATTERN.test(value)) {
    errors.push(`${path} must be a lowercase kebab-case identifier`);
  }
}

function validateNonEmptyString(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function validateHttpUrl(value: unknown, path: string, optional: boolean, errors: string[]): void {
  if (value === undefined && optional) {
    return;
  }

  if (typeof value !== 'string') {
    errors.push(`${path} must be an absolute HTTP(S) URL`);
    return;
  }

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      errors.push(`${path} must be an absolute HTTP(S) URL without embedded credentials`);
    }
  } catch {
    errors.push(`${path} must be an absolute HTTP(S) URL`);
  }
}

function validateRoles(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    errors.push('roles must be an array');
    return;
  }

  const roleIds = new Set<string>();
  value.forEach((role, index) => {
    const path = `roles[${index}]`;
    if (!isRecord(role)) {
      errors.push(`${path} must be an object`);
      return;
    }

    validateId(role.id, `${path}.id`, errors);
    validateNonEmptyString(role.displayName, `${path}.displayName`, errors);
    if (typeof role.reusableAuthentication !== 'boolean') {
      errors.push(`${path}.reusableAuthentication must be boolean`);
    }

    if (typeof role.id === 'string') {
      if (roleIds.has(role.id)) {
        errors.push(`${path}.id must be unique`);
      }
      roleIds.add(role.id);
    }
  });
}

function validateStringArray(value: unknown, path: string, optional: boolean, errors: string[]): void {
  if (value === undefined && optional) {
    return;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    errors.push(`${path} must be an array of non-empty strings`);
  }
}

function validateBooleanRecord(value: unknown, path: string, optional: boolean, errors: string[]): void {
  if (value === undefined && optional) {
    return;
  }

  if (!isRecord(value)) {
    errors.push(`${path} must be an object of boolean values`);
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!DECLARATIVE_KEY_PATTERN.test(key)) {
      errors.push(`${path}.${key} has an invalid key`);
    }
    if (typeof entry !== 'boolean') {
      errors.push(`${path}.${key} must be boolean`);
    }
  }
}

function validateEvidencePolicy(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    errors.push('evidencePolicy must be an object');
    return;
  }

  validateKnownKeys(value, 'evidencePolicy', Object.keys(EVIDENCE_VALUES), errors);
  for (const key of Object.keys(EVIDENCE_VALUES) as (keyof EvidencePolicy)[]) {
    const entry = value[key];
    if (entry !== undefined && !EVIDENCE_VALUES[key].has(entry as never)) {
      errors.push(`evidencePolicy.${key} is not supported`);
    }
  }
}

function validateIncidentPolicy(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    errors.push('incidentPolicy must be an object');
    return;
  }

  validateKnownKeys(value, 'incidentPolicy', ['mode', 'provider'], errors);
  if (value.mode !== undefined && value.mode !== 'preview') {
    errors.push('incidentPolicy.mode must be preview for the MVP');
  }
  if (value.provider !== undefined && value.provider !== 'file') {
    errors.push('incidentPolicy.provider must be file for the MVP');
  }
}

function validateKnownKeys(
  value: Readonly<Record<string, unknown>>,
  path: string,
  allowedKeys: readonly string[],
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      errors.push(`${path}.${key} is not supported`);
    }
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
