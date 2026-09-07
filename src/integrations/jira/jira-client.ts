import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import type { JiraConfig } from './jira-config';

export interface JiraIssue { readonly id?: string; readonly key: string; readonly self?: string; }
export interface JiraIssueDetails extends JiraIssue { readonly fields?: { readonly project?: { readonly key: string } }; }
export interface JiraIssuePayload { readonly summary: string; readonly description: string; }
export interface JiraAttachment { readonly id?: string; readonly filename: string; readonly content?: string; readonly mimeType?: string; readonly size?: number; }

export class JiraClient {
  readonly #fetch: typeof fetch;

  constructor(private readonly config: JiraConfig, fetchImplementation: typeof fetch = fetch) {
    this.#fetch = fetchImplementation;
  }

  async createIssue(payload: JiraIssuePayload): Promise<JiraIssue> {
    const response = await this.request<{ id?: string; key?: string; self?: string }>('POST', '/rest/api/3/issue', {
      fields: {
        project: { key: this.config.projectKey },
        summary: payload.summary,
        description: jiraTextDocument(payload.description),
        issuetype: { name: this.config.issueType },
        labels: ['QA-AUTO', 'Playwright'],
      },
    });
    if (!response.key) throw new Error('Jira did not return a verifiable issue key');
    return { id: response.id, key: response.key, self: response.self };
  }

  getIssue(issueKey: string): Promise<JiraIssueDetails> {
    return this.request<JiraIssueDetails>('GET', `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=project`);
  }

  async searchIssues(jql: string): Promise<readonly JiraIssue[]> {
    const response = await this.request<{ issues?: JiraIssue[] }>('POST', '/rest/api/3/search/jql', {
      jql,
      maxResults: 10,
      fields: ['summary'],
    });
    return response.issues ?? [];
  }

  async uploadAttachment(issueKey: string, filePath: string, fileName = basename(filePath)): Promise<JiraAttachment[]> {
    const content = await readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([content]), fileName);
    const response = await this.request<JiraAttachment[]>('POST', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`, form, true);
    return Array.isArray(response) ? response : [];
  }

  issueUrl(issueKey: string): string {
    return `${this.config.baseUrl.replace(/\/+$/g, '')}/browse/${issueKey}`;
  }

  private async request<T>(method: 'GET' | 'POST', pathname: string, body?: unknown, multipart = false): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/+$/g, '')}${pathname}`;
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64')}`,
          Accept: 'application/json',
          ...(multipart ? { 'X-Atlassian-Token': 'no-check' } : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: multipart ? body as BodyInit : JSON.stringify(body) }),
      });
    } catch {
      throw new Error('Jira request failed before receiving a response');
    }

    const text = await response.text();
    if (!response.ok) throw new Error(`Jira request failed with HTTP ${response.status}${formatResponseText(text)}`);
    return text.trim() ? JSON.parse(text) as T : {} as T;
  }
}

function jiraTextDocument(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    version: 1,
    content: text.split(/\r?\n/).map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

function formatResponseText(text: string): string {
  if (!text.trim()) return '';
  try {
    const body = JSON.parse(text) as { errorMessages?: string[]; errors?: Record<string, string>; message?: string };
    const visible = [...(body.errorMessages ?? []), ...Object.values(body.errors ?? {}), body.message].filter(Boolean).join(' | ');
    return visible ? `: ${visible}` : '';
  } catch {
    return `: ${text.replace(/\s+/g, ' ').trim().slice(0, 180)}`;
  }
}
