/** TG-REQ-002: declarative capabilities; additional boolean keys remain supported. */
export const INITIAL_CAPABILITY_KEYS = [
  'authentication',
  'apiDataSetup',
  'fileUpload',
  'fileDownload',
  'multiRole',
  'networkInterception',
  'incidentReporting',
] as const;

export type InitialCapability = (typeof INITIAL_CAPABILITY_KEYS)[number];

export type AppCapabilities = Readonly<Record<string, boolean>>;

export interface AppRole {
  readonly id: string;
  readonly displayName: string;
  readonly reusableAuthentication: boolean;
}

export type TraceEvidenceMode = 'off' | 'retain-on-failure';
export type ScreenshotEvidenceMode = 'off' | 'only-on-failure';
export type VideoEvidenceMode = 'off' | 'retain-on-failure';

export interface EvidencePolicy {
  readonly trace: TraceEvidenceMode;
  readonly screenshot: ScreenshotEvidenceMode;
  readonly video: VideoEvidenceMode;
}

export interface IncidentPolicy {
  readonly mode: 'preview';
  readonly provider: 'file';
}

/** TG-REQ-002 and TG-REQ-009: normalized, application-neutral profile. */
export interface AppProfile {
  readonly id: string;
  readonly displayName: string;
  readonly baseURL: string;
  readonly apiURL?: string;
  readonly roles: readonly AppRole[];
  readonly testMatch: readonly string[];
  readonly capabilities: AppCapabilities;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly evidencePolicy: EvidencePolicy;
  readonly incidentPolicy: IncidentPolicy;
}

export interface AppProfileInput {
  readonly id: string;
  readonly displayName: string;
  readonly baseURL: string;
  readonly apiURL?: string;
  readonly roles?: readonly AppRole[];
  readonly testMatch?: readonly string[];
  readonly capabilities?: AppCapabilities;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
  readonly evidencePolicy?: Partial<EvidencePolicy>;
  readonly incidentPolicy?: Partial<IncidentPolicy>;
}
