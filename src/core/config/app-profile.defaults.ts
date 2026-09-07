import type {
  AppCapabilities,
  AppProfile,
  AppProfileInput,
  AppRole,
  EvidencePolicy,
  IncidentPolicy,
} from './app-profile.types';
import { INITIAL_CAPABILITY_KEYS } from './app-profile.types';

export const DEFAULT_CAPABILITIES: AppCapabilities = Object.freeze(
  Object.fromEntries(INITIAL_CAPABILITY_KEYS.map((key) => [key, false])),
);

export const DEFAULT_ROLES: readonly AppRole[] = Object.freeze([
  Object.freeze({
    id: 'default',
    displayName: 'Default',
    reusableAuthentication: false,
  }),
]);

export const DEFAULT_TEST_MATCH: readonly string[] = Object.freeze(['**/*.spec.ts']);

/** TG-REQ-009: retain only failure diagnostics needed by default; video is opt-in. */
export const DEFAULT_EVIDENCE_POLICY: EvidencePolicy = Object.freeze({
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'off',
});

/** TG-REQ-002 and TG-REQ-009: local preview is the only MVP incident default. */
export const DEFAULT_INCIDENT_POLICY: IncidentPolicy = Object.freeze({
  mode: 'preview',
  provider: 'file',
});

export function applyAppProfileDefaults(input: AppProfileInput): AppProfile {
  const normalized = {
    id: input.id.trim(),
    displayName: input.displayName.trim(),
    baseURL: input.baseURL,
    roles: input.roles ?? DEFAULT_ROLES,
    testMatch: input.testMatch ?? DEFAULT_TEST_MATCH,
    capabilities: Object.freeze({
      ...DEFAULT_CAPABILITIES,
      ...input.capabilities,
    }),
    featureFlags: Object.freeze({ ...input.featureFlags }),
    evidencePolicy: Object.freeze({
      ...DEFAULT_EVIDENCE_POLICY,
      ...input.evidencePolicy,
    }),
    incidentPolicy: Object.freeze({
      ...DEFAULT_INCIDENT_POLICY,
      ...input.incidentPolicy,
    }),
  } satisfies Omit<AppProfile, 'apiURL'>;

  return input.apiURL === undefined
    ? normalized
    : { ...normalized, apiURL: input.apiURL };
}
