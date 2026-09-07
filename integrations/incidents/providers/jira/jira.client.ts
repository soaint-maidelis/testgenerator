import fs from 'fs/promises';
import path from 'path';
import type { IncidentAttachmentResult } from '../incident-provider.types';
import type {
  JiraAttachment,
  JiraConfig,
  JiraCreateIssueInput,
  JiraIssue,
  JiraIssueType,
  JiraProject,
  JiraValidationResult,
} from './jira.types';
import { JiraRequestError } from './jira.types';
import { debug } from '../../incident-logger';

export interface JiraClient {
  validateConnection(): Promise<JiraValidationResult>;
  searchIssues(jql: string): Promise<JiraIssue[]>;
  getIssue(issueKey: string): Promise<JiraIssue>;
  createIssue(input: JiraCreateIssueInput): Promise<JiraIssue>;
  getIssueAttachments(issueKey: string): Promise<JiraAttachment[]>;
  uploadAttachment(issueKey: string, filePath: string, fileName?: string): Promise<JiraAttachment[]>;
  attachEvidence?(issueKey: string, evidence: IncidentAttachmentResult[]): Promise<IncidentAttachmentResult[]>;
}

type FetchLike = typeof fetch;
type JiraSearchResponse = {
  issues?: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
};
type JiraCreateIssueResponse = {
  id?: string;
  key?: string;
  self?: string;
};
type JiraCreateMetaResponse = {
  projects?: Array<JiraProject & { issuetypes?: JiraIssueType[] }>;
};

export class JiraHttpClient implements JiraClient {
  constructor(
    private readonly config: JiraConfig,
    private readonly fetchImpl?: FetchLike,
  ) {}

  async validateConnection(): Promise<JiraValidationResult> {
    const configError = validateJiraConfig(this.config);
    if (configError) {
      return { status: 'INVALID_CONFIG', message: configError };
    }

    try {
      const project = await this.getProject(this.config.projectKey);
      const availableIssueTypes = await this.getIssueTypes(this.config.projectKey);
      const issueType = availableIssueTypes.find((item) => item.name === this.config.issueType);
      if (!issueType) {
        return {
          status: 'ISSUE_TYPE_NOT_FOUND',
          project,
          requestedIssueType: this.config.issueType,
          availableIssueTypes,
        };
      }
      return { status: 'VALID', project, issueType };
    } catch (error) {
      return mapJiraValidationError(error);
    }
  }

  async searchIssues(jql: string): Promise<JiraIssue[]> {
    const issues: JiraIssue[] = [];
    let nextPageToken: string | undefined;

    do {
      const body = buildJiraSearchBody(jql, nextPageToken);
      const response = await this.request<JiraSearchResponse>('searchIssues', '/rest/api/3/search/jql', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      issues.push(...(response.issues ?? []));
      nextPageToken = response.nextPageToken;
    } while (nextPageToken);

    return issues;
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    return this.request<JiraIssue>('getIssue', `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,description,labels,status`, {
      method: 'GET',
    });
  }

  async getIssueAttachments(issueKey: string): Promise<JiraAttachment[]> {
    const issue = await this.request<JiraIssue>('getIssueAttachments', `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=attachment`, {
      method: 'GET',
    });
    return issue.fields?.attachment ?? [];
  }

  async createIssue(input: JiraCreateIssueInput): Promise<JiraIssue> {
    const created = await this.request<JiraCreateIssueResponse>('createIssue', '/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!created.key) {
      throw new JiraRequestError('Jira no devolvio key del issue creado.', undefined, 'createIssue');
    }
    return { id: created.id, key: created.key, self: created.self };
  }

  async uploadAttachment(issueKey: string, filePath: string, fileName?: string): Promise<JiraAttachment[]> {
    const body = await fs.readFile(filePath);
    const form = new FormData();
    const blob = new Blob([body]);
    form.append('file', blob, fileName ?? path.basename(filePath));
    const response = await this.request<JiraAttachment[]>('uploadAttachment', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`, {
      method: 'POST',
      body: form,
      headers: { 'X-Atlassian-Token': 'no-check' },
      skipContentType: true,
    });
    return Array.isArray(response) ? response : [];
  }

  private async getProject(projectKey: string): Promise<JiraProject> {
    return this.request<JiraProject>('getProject', `/rest/api/3/project/${encodeURIComponent(projectKey)}`, { method: 'GET' });
  }

  private async getIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    const response = await this.request<JiraCreateMetaResponse>(
      'getCreateMetadata',
      `/rest/api/3/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&expand=projects.issuetypes`,
      { method: 'GET' },
    );
    return response.projects?.flatMap((project) => project.issuetypes ?? []) ?? [];
  }

  private async request<T>(
    operation: string,
    resourcePath: string,
    options: RequestInit & { skipContentType?: boolean } = {},
  ): Promise<T> {
    const url = buildJiraUrl(this.config.baseUrl, resourcePath);
    const controller = new AbortController();
    const started = Date.now();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      debug('[JIRA CLIENT]', { operation, method: options.method ?? 'GET', url: sanitizeJiraUrl(url), requestStarted: true });
      const fetchImpl = this.fetchImpl ?? getGlobalFetch(operation);
      const response = await fetchImpl(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: buildJiraAuthHeader(this.config),
          Accept: 'application/json',
          ...(options.skipContentType ? {} : { 'Content-Type': 'application/json' }),
          ...(options.headers ?? {}),
        },
      });
      const text = await response.text();
      debug('[JIRA CLIENT]', { operation, statusCode: response.status, elapsedMs: Date.now() - started });

      if (!response.ok) {
        throw new JiraRequestError(buildJiraErrorMessage(text, response.status, response.statusText), response.status, operation);
      }

      if (!text.trim()) {
        return {} as T;
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new JiraRequestError(`Jira devolvio JSON invalido en ${operation}.`, response.status, operation);
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw new JiraRequestError(`Timeout al comunicarse con Jira en ${operation}.`, undefined, operation);
      }
      if (error instanceof JiraRequestError) {
        throw error;
      }
      throw new JiraRequestError(error instanceof Error ? error.message : String(error), undefined, operation);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function getGlobalFetch(operation: string): FetchLike {
  const fetchImpl = (globalThis as typeof globalThis & { fetch?: FetchLike }).fetch;
  if (!fetchImpl) {
    throw new JiraRequestError('Runtime sin fetch global disponible para Jira.', undefined, operation);
  }
  return fetchImpl;
}

export function validateJiraConfig(config: JiraConfig): string | undefined {
  if (!config.baseUrl) return 'Falta JIRA_BASE_URL.';
  if (!config.projectKey) return 'Falta JIRA_PROJECT_KEY.';
  if (!config.email) return 'Falta JIRA_EMAIL.';
  if (!config.apiToken) return 'Falta JIRA_API_TOKEN.';
  if (!config.issueType) return 'Falta JIRA_ISSUE_TYPE.';
  return undefined;
}

function buildJiraAuthHeader(config: JiraConfig): string {
  return `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`;
}

function buildJiraSearchBody(jql: string, nextPageToken?: string): Record<string, unknown> {
  return {
    jql,
    maxResults: 50,
    fields: ['summary', 'description', 'status', 'labels', 'issuetype', 'project'],
    ...(nextPageToken ? { nextPageToken } : {}),
  };
}

function buildJiraUrl(baseUrl: string, resourcePath: string): string {
  return `${baseUrl.replace(/\/+$/g, '')}${resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`}`;
}

function buildJiraErrorMessage(text: string, status: number, statusText: string): string {
  const visible = parseJiraErrorText(text) || statusText || 'Error Jira';
  return `Jira HTTP ${status}: ${visible}`;
}

function parseJiraErrorText(text: string): string | undefined {
  if (!text.trim()) {
    return undefined;
  }

  try {
    const body = JSON.parse(text) as { errorMessages?: string[]; errors?: Record<string, string>; message?: string };
    return [
      ...(body.errorMessages ?? []),
      ...Object.values(body.errors ?? {}),
      body.message,
    ].filter(Boolean).join(' | ') || undefined;
  } catch {
    return text.replace(/\s+/g, ' ').trim().slice(0, 300);
  }
}

function mapJiraValidationError(error: unknown): JiraValidationResult {
  if (!(error instanceof JiraRequestError)) {
    return { status: 'HTTP_ERROR', message: error instanceof Error ? error.message : String(error) };
  }

  if (error.statusCode === 401) return { status: 'AUTH_ERROR', statusCode: error.statusCode, message: error.message };
  if (error.statusCode === 403) return { status: 'PERMISSION_ERROR', statusCode: error.statusCode, message: error.message };
  if (error.statusCode === 404) return { status: 'PROJECT_NOT_FOUND', statusCode: error.statusCode, message: error.message };
  return { status: 'HTTP_ERROR', statusCode: error.statusCode, message: error.message };
}

function sanitizeJiraUrl(url: string): string {
  return url.replace(/([?&](?:token|api_token|apiToken|access_token)=)[^&\s]+/gi, '$1[REDACTED]');
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
