import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import type { AzureConfig } from './azure-config';

export interface AzureWorkItem { readonly id: number; readonly url?: string; readonly fields?: Record<string, unknown>; }
export interface AzureAttachment { readonly id?: string; readonly url: string; }
export interface AzureWorkItemPayload { readonly title: string; readonly description: string; }
export interface AzureWorkItemReference { readonly id: number; readonly url?: string; }

export class AzureClient {
  readonly #fetch: typeof fetch;

  constructor(private readonly config: AzureConfig, fetchImplementation: typeof fetch = fetch) {
    this.#fetch = fetchImplementation;
  }

  createWorkItem(payload: AzureWorkItemPayload): Promise<AzureWorkItem> {
    return this.request<AzureWorkItem>(
      'PATCH',
      `${this.projectUrl()}/_apis/wit/workitems/$${encodeURIComponent(this.config.workItemType)}?api-version=7.1-preview.3`,
      [
        { op: 'add', path: '/fields/System.Title', value: payload.title },
        { op: 'add', path: '/fields/System.Description', value: payload.description },
        { op: 'add', path: '/fields/System.Tags', value: 'QA-AUTO; Playwright' },
      ],
      'application/json-patch+json',
    );
  }

  getWorkItem(id: number): Promise<AzureWorkItem> {
    return this.request<AzureWorkItem>('GET', `${this.projectUrl()}/_apis/wit/workitems/${id}?api-version=7.1`);
  }

  async queryWorkItems(wiql: string): Promise<readonly AzureWorkItemReference[]> {
    const response = await this.request<{ workItems?: AzureWorkItemReference[] }>(
      'POST',
      `${this.projectUrl()}/_apis/wit/wiql?api-version=7.1`,
      { query: wiql },
    );
    return response.workItems ?? [];
  }

  async uploadAttachment(workItemId: number, filePath: string, fileName = basename(filePath)): Promise<AzureAttachment> {
    const content = await readFile(filePath);
    const attachment = await this.request<AzureAttachment>(
      'POST',
      `${this.projectUrl()}/_apis/wit/attachments?fileName=${encodeURIComponent(fileName)}&api-version=7.1-preview.3`,
      content,
      'application/octet-stream',
    );

    await this.request<AzureWorkItem>(
      'PATCH',
      `${this.projectUrl()}/_apis/wit/workitems/${workItemId}?api-version=7.1-preview.3`,
      [{ op: 'add', path: '/relations/-', value: { rel: 'AttachedFile', url: attachment.url, attributes: { comment: fileName } } }],
      'application/json-patch+json',
    );
    return attachment;
  }

  workItemUrl(id: number): string {
    return `${this.projectUrl()}/_workitems/edit/${id}`;
  }

  private async request<T>(method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown, contentType = 'application/json'): Promise<T> {
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`:${this.config.pat}`).toString('base64')}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': contentType }),
        },
        ...(body === undefined ? {} : { body: body instanceof Buffer ? body : JSON.stringify(body) }),
      });
    } catch {
      throw new Error('Azure DevOps request failed before receiving a response');
    }

    const text = await response.text();
    if (!response.ok) throw new Error(`Azure DevOps request failed with HTTP ${response.status}${formatResponseText(text)}`);
    return text.trim() ? JSON.parse(text) as T : {} as T;
  }

  private projectUrl(): string {
    return `https://dev.azure.com/${encodeURIComponent(this.config.organization)}/${encodeURIComponent(this.config.project)}`;
  }
}

function formatResponseText(text: string): string {
  if (!text.trim()) return '';
  try {
    const body = JSON.parse(text) as { message?: string; typeName?: string };
    return body.message ? `: ${body.message}` : body.typeName ? `: ${body.typeName}` : '';
  } catch {
    return `: ${text.replace(/\s+/g, ' ').trim().slice(0, 180)}`;
  }
}
