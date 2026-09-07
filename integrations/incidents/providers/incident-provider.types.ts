import type { AzureEvidenceAttachmentResult, IncidentCandidate, IncidentRuntimeConfig } from '../incident.types';

export type IncidentProviderName = 'azure' | 'jira' | 'trello' | 'none';
export type IncidentProviderStatus = 'VALIDATED' | 'CREATED' | 'DUPLICATE' | 'SKIPPED' | 'ERROR';
export type IncidentAttachmentResult = AzureEvidenceAttachmentResult;

export type IncidentReference = {
  provider: IncidentProviderName;
  incidentId: string;
  incidentUrl?: string;
};

export type IncidentDuplicateResult =
  | { duplicate: true; incident: IncidentReference; message?: string }
  | { duplicate: false; message?: string };

export type IncidentProviderResult = {
  provider: IncidentProviderName;
  status: IncidentProviderStatus;
  incidentId?: string;
  incidentUrl?: string;
  attachments?: IncidentAttachmentResult[];
  message?: string;
  statusCode?: number;
  operation?: 'create' | 'validate';
  duplicateSignature?: string;
  legacy?: {
    workItemId?: number;
  };
};

export type IncidentProviderContext = {
  config: IncidentRuntimeConfig;
};

export type IncidentProviderCreateResult = IncidentReference & {
  message?: string;
};

export type ProcessIncidentInput = {
  candidate: IncidentCandidate;
  config: IncidentRuntimeConfig;
};
