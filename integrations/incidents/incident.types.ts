import type { FailureCause } from '../../tests/e2e/_globalshared/diagnostics/failure-cause';

export type IncidentMode = 'preview' | 'create';
export type IncidentProvider = 'azure' | 'jira' | 'trello' | 'none';
export type IncidentAction = 'CANDIDATO A BUG' | 'CANDIDATO A BUG - REVISION' | 'REVISION MANUAL' | 'NO CANDIDATO';
export type TechnicalClassification =
  | 'ASSERTION_FAILURE'
  | 'PERMISSION_FAILURE'
  | 'BUSINESS_RULE_FAILURE'
  | 'PROCESSING_TIMEOUT'
  | 'NAV_FAILURE'
  | 'DATA_FAILURE'
  | 'AUTH_FAILURE'
  | 'ENV_FAILURE'
  | 'AUTOMATION_FAILURE'
  | 'CONFIG_FAILURE'
  | 'UNKNOWN_FAILURE';

export type ProbableCause =
  | 'EXPECTED_VALUE_MISMATCH'
  | 'ELEMENT_NOT_FOUND'
  | 'LOCATOR_AMBIGUOUS'
  | 'ELEMENT_NOT_INTERACTABLE'
  | 'PAGE_NOT_LOADED'
  | 'MODAL_NOT_OPENED'
  | 'OPTION_NOT_AVAILABLE'
  | 'AUTHENTICATION_FAILED'
  | 'SESSION_EXPIRED'
  | 'WRONG_ROLE'
  | 'WRONG_PROJECT'
  | 'MISSING_TEST_DATA'
  | 'ENVIRONMENT_UNAVAILABLE'
  | 'NETWORK_FAILURE'
  | 'BUSINESS_VALIDATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'PROCESS_TIMEOUT'
  | 'UNKNOWN';

export type IncidentDecision = 'BUG_AUTO' | 'BUG_REVIEW' | 'AUTOMATION_ISSUE' | 'IGNORE';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type AzureDevOpsEligibility =
  | 'ELEGIBLE PARA CREACION AUTOMATICA'
  | 'REQUIERE REVISION'
  | 'NO ELEGIBLE';

export type IncidentClassificationInput = {
  frameworkClassification: string;
  expectedRole: string;
  usedRole: string;
  expectedProject: string;
  usedProject: string;
  phase: string;
  message: string;
  expected: string;
  received: string;
  observedResult: string;
  errorText: string;
  stack: string;
  contextText: string;
  caseTitle: string;
  technicalOrigin: string;
  view: string;
};

export type IncidentClassification = {
  classification: TechnicalClassification;
  probableCause: ProbableCause;
  confidence: Confidence;
  evidence: string[];
};

export type IncidentDecisionResult = IncidentClassification & {
  decision: IncidentDecision;
  reason: string;
  recommendation: string;
  azureDevOpsEligibility: AzureDevOpsEligibility;
};

export type IncidentEvidence = {
  screenshot: string[];
  video: string[];
  trace: string[];
  htmlReport: string[];
  logs: string[];
};

export type IncidentCandidate = {
  caseId: string;
  title: string;
  bugTitle: string;
  bugDescription: string;
  block: string;
  specFile: string;
  project: string;
  role: string;
  browser: string;
  status: string;
  durationMs: number;
  retry: number;
  finalUrl: string;
  phase: string;
  classification: FailureCause;
  errorMessage: string;
  expectedResult: string;
  observedResult: string;
  stackSummary: string;
  expected: string;
  received: string;
  errorOrigin: string;
  timeout: string;
  executedAt: string;
  evidence: IncidentEvidence;
  action: IncidentAction;
  technicalDiagnostic: TechnicalDiagnostic;
  incidentDecision: IncidentDecisionResult;
  originalError: string;
};

export type TechnicalDiagnostic = {
  error: string;
  caseId: string;
  phase: string;
  probableCause: string;
  message: string;
  expectedRole: string;
  expectedProject: string;
  usedProject: string;
  file: string;
  technicalOrigin: string;
  view: string;
};

export type IncidentPolicyDecision = {
  shouldCreate: boolean;
  action: IncidentAction;
  reason: string;
};

export type IncidentRuntimeConfig = {
  autoCreateIncidents: boolean;
  mode: IncidentMode;
  provider: IncidentProvider;
  attachEvidence: boolean;
  attachVideo: boolean;
  maxVideoMb: number;
  requestTimeoutMs: number;
  azureOrganization: string;
  azureProject: string;
  hasAzurePat: boolean;
  azureValidateOnly: boolean;
  azureAttachEvidence: boolean;
  azureAttachVideo: boolean;
  azureMaxVideoMb: number;
  jiraBaseUrl: string;
  jiraProjectKey: string;
  jiraEmail: string;
  hasJiraApiToken: boolean;
  jiraIssueType: string;
  jiraValidateOnly: boolean;
  trelloBoardId: string;
  trelloListId: string;
  hasTrelloApiKey: boolean;
  hasTrelloToken: boolean;
  trelloValidateOnly: boolean;
};

export type AzureEvidenceAttachmentType = 'screenshot' | 'trace' | 'video';
export type AzureEvidenceAttachmentStatus =
  | 'LINKED'
  | 'UPLOAD_ERROR'
  | 'LINK_ERROR'
  | 'FILE_NOT_FOUND'
  | 'EMPTY_FILE'
  | 'SKIPPED'
  | 'ALREADY_LINKED';

export type AzureEvidenceAttachmentResult = {
  type: AzureEvidenceAttachmentType;
  status: AzureEvidenceAttachmentStatus;
  fileName?: string;
  reason?: string;
  message?: string;
  maxMb?: number;
  attachmentId?: string;
  mimeType?: string;
  size?: number;
  contentUrl?: string;
};

export type AzureIncidentResult =
  | {
      status: 'CREATED';
      workItemId: number;
      url?: string;
      duplicateSignature?: string;
      attachments?: AzureEvidenceAttachmentResult[];
    }
  | {
      status: 'DUPLICATE';
      workItemId: number;
      url?: string;
      duplicateSignature?: string;
      attachments?: AzureEvidenceAttachmentResult[];
    }
  | {
      status: 'VALIDATED';
      message?: string;
      duplicateSignature?: string;
      attachments?: AzureEvidenceAttachmentResult[];
    }
  | {
      status: 'SKIPPED';
      reason: string;
      duplicateSignature?: string;
      attachments?: AzureEvidenceAttachmentResult[];
    }
  | {
      status: 'ERROR';
      message: string;
      statusCode?: number;
      operation?: 'create' | 'validate';
      duplicateSignature?: string;
      attachments?: AzureEvidenceAttachmentResult[];
    };
