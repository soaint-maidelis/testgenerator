import { expect, test } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { JiraHttpClient } from './jira.client';
import { JiraRequestError, type JiraConfig } from './jira.types';
import { textToAdf } from './jira-adf';

const config: JiraConfig = {
  baseUrl: 'https://jira.example.test',
  projectKey: 'QA',
  email: 'qa@example.test',
  apiToken: 'secret-token',
  issueType: 'Bug',
  requestTimeoutMs: 50,
};

test.describe('jira http client', () => {
  test('validateConnection returns VALID for project and issue type', async () => {
    const client = new JiraHttpClient(config, mockFetch([
      jsonResponse(200, { key: 'QA', name: 'QA Project' }),
      jsonResponse(200, { projects: [{ key: 'QA', issuetypes: [{ id: '1', name: 'Bug' }] }] }),
    ]));

    await expect(client.validateConnection()).resolves.toMatchObject({ status: 'VALID', project: { key: 'QA' }, issueType: { name: 'Bug' } });
  });

  test('validateConnection returns PROJECT_NOT_FOUND for missing project', async () => {
    await expect(new JiraHttpClient(config, mockFetch([jsonResponse(404, { errorMessages: ['Not found'] })])).validateConnection())
      .resolves.toMatchObject({ status: 'PROJECT_NOT_FOUND', statusCode: 404 });
  });

  test('validateConnection returns ISSUE_TYPE_NOT_FOUND with available issue types', async () => {
    const client = new JiraHttpClient(config, mockFetch([
      jsonResponse(200, { key: 'SCRUM', name: 'Scrum Project' }),
      jsonResponse(200, { projects: [{ key: 'SCRUM', issuetypes: [{ id: '10001', name: 'Task' }, { id: '10002', name: 'Story' }] }] }),
    ]));

    await expect(client.validateConnection()).resolves.toMatchObject({
      status: 'ISSUE_TYPE_NOT_FOUND',
      project: { key: 'SCRUM' },
      requestedIssueType: 'Bug',
      availableIssueTypes: [{ name: 'Task' }, { name: 'Story' }],
    });
  });

  test('validateConnection maps auth and permission failures', async () => {
    await expect(new JiraHttpClient(config, mockFetch([jsonResponse(401, { errorMessages: ['Unauthorized'] })])).validateConnection())
      .resolves.toMatchObject({ status: 'AUTH_ERROR', statusCode: 401 });
    await expect(new JiraHttpClient(config, mockFetch([jsonResponse(403, { errorMessages: ['Forbidden'] })])).validateConnection())
      .resolves.toMatchObject({ status: 'PERMISSION_ERROR', statusCode: 403 });
  });

  test('validateConnection returns INVALID_CONFIG for missing config', async () => {
    const client = new JiraHttpClient({ ...config, apiToken: '' }, mockFetch([]));
    await expect(client.validateConnection()).resolves.toMatchObject({ status: 'INVALID_CONFIG', message: /JIRA_API_TOKEN/ });
  });

  test('searchIssues posts enhanced JQL and returns issues', async () => {
    let request: { url: string; init: RequestInit } | undefined;
    const client = new JiraHttpClient(config, async (url, init) => {
      request = { url: String(url), init: init ?? {} };
      return jsonResponse(200, { issues: [{ key: 'QA-1', fields: { description: 'desc' } }] });
    });

    const issues = await client.searchIssues('project = QA');

    expect(issues[0].key).toBe('QA-1');
    expect(request?.url).toBe('https://jira.example.test/rest/api/3/search/jql');
    expect(request?.url).not.toBe('https://jira.example.test/rest/api/3/search');
    expect(request?.init.method).toBe('POST');
    expect(String(request?.init.headers && (request.init.headers as Record<string, string>).Authorization)).toMatch(/^Basic /);
    expect(JSON.parse(String(request?.init.body))).toEqual({
      jql: 'project = QA',
      maxResults: 50,
      fields: ['summary', 'description', 'status', 'labels', 'issuetype', 'project'],
    });
  });

  test('searchIssues follows nextPageToken and stops when it is missing', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const client = new JiraHttpClient(config, async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return requests.length === 1
        ? jsonResponse(200, { issues: [{ key: 'QA-1' }], nextPageToken: 'next-token' })
        : jsonResponse(200, { issues: [{ key: 'QA-2' }], isLast: true });
    });

    const issues = await client.searchIssues('project = QA');

    expect(issues.map((issue) => issue.key)).toEqual(['QA-1', 'QA-2']);
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.url.endsWith('/rest/api/3/search/jql'))).toBe(true);
    expect(requests[0].body).not.toHaveProperty('startAt');
    expect(requests[1].body).toMatchObject({ nextPageToken: 'next-token' });
    expect(requests[1].body).not.toHaveProperty('startAt');
  });

  test('searchIssues without nextPageToken stops after first page', async () => {
    let calls = 0;
    const client = new JiraHttpClient(config, async () => {
      calls += 1;
      return jsonResponse(200, { issues: [{ key: 'QA-1' }], isLast: true });
    });

    await expect(client.searchIssues('project = QA')).resolves.toHaveLength(1);
    expect(calls).toBe(1);
  });

  test('searchIssues 410 reports typed JiraRequestError', async () => {
    const client = new JiraHttpClient(config, mockFetch([jsonResponse(410, { errorMessages: ['La API solicitada se ha eliminado.'] })]));
    await expect(client.searchIssues('legacy')).rejects.toMatchObject({
      name: 'JiraRequestError',
      operation: 'searchIssues',
      statusCode: 410,
    });
  });

  test('searchIssues 500 fails closed with visible message', async () => {
    const client = new JiraHttpClient(config, mockFetch([jsonResponse(500, { errorMessages: ['JQL failed'] })]));
    await expect(client.searchIssues('bad')).rejects.toMatchObject({ statusCode: 500 });
  });

  test('createIssue returns issue key and maps 400/401', async () => {
    const client = new JiraHttpClient(config, mockFetch([jsonResponse(201, { id: '10001', key: 'QA-123' })]));
    await expect(client.createIssue(minimalIssue())).resolves.toMatchObject({ key: 'QA-123' });

    await expect(new JiraHttpClient(config, mockFetch([jsonResponse(400, { errors: { summary: 'Summary required' } })])).createIssue(minimalIssue()))
      .rejects.toThrow(/Summary required/);
    await expect(new JiraHttpClient(config, mockFetch([jsonResponse(401, { errorMessages: ['Unauthorized'] })])).createIssue(minimalIssue()))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  test('getIssueAttachments reads fields attachment', async () => {
    const client = new JiraHttpClient(config, mockFetch([jsonResponse(200, { fields: { attachment: [{ id: '1', filename: 'a.png' }] } })]));

    await expect(client.getIssueAttachments('SCRUM-2')).resolves.toEqual([{ id: '1', filename: 'a.png' }]);
  });

  test('uploadAttachment posts multipart to Jira attachments endpoint without manual content type', async () => {
    const filePath = await tempFile('upload-source.png', 'png');
    let request: { url: string; init: RequestInit } | undefined;
    const client = new JiraHttpClient(config, async (url, init) => {
      request = { url: String(url), init: init ?? {} };
      return jsonResponse(201, [{ id: '1', filename: 'QA-AUTO-SCRUM-2-screenshot.png', mimeType: 'image/png', size: 3, content: 'https://content.example.test/1' }]);
    });

    const result = await client.uploadAttachment('SCRUM-2', filePath, 'QA-AUTO-SCRUM-2-screenshot.png');

    expect(result[0]).toMatchObject({ id: '1', filename: 'QA-AUTO-SCRUM-2-screenshot.png' });
    expect(request?.url).toBe('https://jira.example.test/rest/api/3/issue/SCRUM-2/attachments');
    expect(request?.init.method).toBe('POST');
    const headers = request?.init.headers as Record<string, string>;
    expect(headers['X-Atlassian-Token']).toBe('no-check');
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers['Content-Type']).toBeUndefined();
  });

  test('timeout aborts request', async () => {
    const client = new JiraHttpClient({ ...config, requestTimeoutMs: 5 }, async (_url, init) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
      return jsonResponse(200, {});
    });

    await expect(client.searchIssues('project = QA')).rejects.toThrow(/Timeout al comunicarse con Jira/);
  });

  test('invalid JSON is reported as JiraRequestError', async () => {
    const client = new JiraHttpClient(config, mockFetch([textResponse(200, 'not-json')]));
    await expect(client.searchIssues('project = QA')).rejects.toBeInstanceOf(JiraRequestError);
  });
});

function minimalIssue() {
  return {
    fields: {
      project: { key: 'QA' },
      summary: 'summary',
      description: textToAdf('description'),
      issuetype: { name: 'Bug' },
      labels: ['QA-AUTO'],
    },
  };
}

async function tempFile(name: string, content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-client-test-'));
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, content);
  return filePath;
}

function mockFetch(responses: Response[]): typeof fetch {
  const queue = [...responses];
  return async () => {
    const response = queue.shift();
    if (!response) {
      throw new Error('No mock response configured.');
    }
    return response;
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, statusText: status === 200 || status === 201 ? 'OK' : 'ERROR' });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status });
}
