import type { JiraAdfDocument } from './jira-adf';

export type JiraConfig = {
  baseUrl: string;
  projectKey: string;
  email: string;
  apiToken: string;
  issueType: string;
  requestTimeoutMs: number;
};

export type JiraIssue = {
  id?: string;
  key: string;
  self?: string;
  fields?: {
    description?: string | JiraAdfDocument | null;
    labels?: string[];
    attachment?: JiraAttachment[];
  };
};

export type JiraAttachment = {
  id?: string;
  filename: string;
  mimeType?: string;
  size?: number;
  content?: string;
};

export type JiraProject = {
  id?: string;
  key: string;
  name?: string;
};

export type JiraIssueType = {
  id?: string;
  name: string;
};

export type JiraValidationStatus =
  | 'VALID'
  | 'INVALID_CONFIG'
  | 'AUTH_ERROR'
  | 'PROJECT_NOT_FOUND'
  | 'ISSUE_TYPE_NOT_FOUND'
  | 'PERMISSION_ERROR'
  | 'HTTP_ERROR';

export type JiraValidationResult = {
  status: JiraValidationStatus;
  statusCode?: number;
  message?: string;
  project?: JiraProject;
  issueType?: JiraIssueType;
  requestedIssueType?: string;
  availableIssueTypes?: JiraIssueType[];
};

export class JiraRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly operation?: string,
  ) {
    super(message);
    this.name = 'JiraRequestError';
  }
}

export type JiraCreateIssueInput = {
  fields: {
    project: { key: string };
    summary: string;
    description: JiraAdfDocument;
    issuetype: { name: string };
    labels: string[];
  };
};
