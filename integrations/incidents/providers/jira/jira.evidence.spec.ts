import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from '@playwright/test';
import { uploadJiraEvidenceFile, uploadJiraEvidenceFiles } from './jira.evidence';
import type { JiraAttachment } from './jira.types';

test.describe('jira evidence upload', () => {
  test('getIssueAttachments without matches uploads file', async () => {
    const filePath = await tempFile('screenshot.png', 'png');
    const client = makeEvidenceClient({ existing: [], uploaded: [{ id: '1', filename: 'screenshot.png' }] });

    const [result] = await uploadJiraEvidenceFiles(client, 'SCRUM-2', [{ type: 'screenshot', filePath }]);

    expect(result.status).toBe('LINKED');
    expect(client.calls.upload).toBe(1);
  });

  test('existing exact filename returns ALREADY_LINKED without upload', async () => {
    const filePath = await tempFile('screenshot.png', 'png');
    const client = makeEvidenceClient({ existing: [{ filename: ' screenshot.PNG ' }] });

    const [result] = await uploadJiraEvidenceFiles(client, 'SCRUM-2', [{ type: 'screenshot', filePath, fileName: 'screenshot.png' }]);

    expect(result.status).toBe('ALREADY_LINKED');
    expect(client.calls.upload).toBe(0);
  });

  test('different filename uploads', async () => {
    const filePath = await tempFile('screenshot.png', 'png');
    const client = makeEvidenceClient({ existing: [{ filename: 'other.png' }], uploaded: [{ filename: 'screenshot.png' }] });

    const [result] = await uploadJiraEvidenceFiles(client, 'SCRUM-2', [{ type: 'screenshot', filePath }]);

    expect(result.status).toBe('LINKED');
    expect(client.calls.upload).toBe(1);
  });

  test('upload 200 maps to LINKED', async () => {
    const filePath = await tempFile('screenshot.png', 'png');
    const result = await uploadJiraEvidenceFile(makeEvidenceClient({ uploaded: [{ id: '1', filename: 'screenshot.png' }] }), 'SCRUM-2', {
      type: 'screenshot',
      filePath,
    }, []);

    expect(result).toMatchObject({ status: 'LINKED', attachmentId: '1' });
  });

  test('upload 201 maps to LINKED', async () => {
    const filePath = await tempFile('trace.zip', 'zip');
    const result = await uploadJiraEvidenceFile(makeEvidenceClient({ uploaded: [{ id: '2', filename: 'trace.zip' }] }), 'SCRUM-2', {
      type: 'trace',
      filePath,
    }, []);

    expect(result).toMatchObject({ status: 'LINKED', attachmentId: '2' });
  });

  for (const statusCode of [400, 401, 403, 404, 500]) {
    test(`upload ${statusCode} maps to UPLOAD_ERROR`, async () => {
      const filePath = await tempFile('screenshot.png', 'png');
      const result = await uploadJiraEvidenceFile(makeEvidenceClient({ uploadError: new Error(`Jira HTTP ${statusCode}`) }), 'SCRUM-2', {
        type: 'screenshot',
        filePath,
      }, []);

      expect(result).toMatchObject({ status: 'UPLOAD_ERROR', message: `Jira HTTP ${statusCode}` });
    });
  }

  test('missing file maps to FILE_NOT_FOUND', async () => {
    const result = await uploadJiraEvidenceFile(makeEvidenceClient(), 'SCRUM-2', {
      type: 'screenshot',
      filePath: path.join(os.tmpdir(), 'missing-jira-file.png'),
      fileName: 'missing-jira-file.png',
    }, []);

    expect(result).toMatchObject({ status: 'FILE_NOT_FOUND', fileName: 'missing-jira-file.png' });
  });

  test('empty file maps to EMPTY_FILE', async () => {
    const filePath = await tempFile('empty.zip', '');
    const result = await uploadJiraEvidenceFile(makeEvidenceClient(), 'SCRUM-2', { type: 'trace', filePath }, []);

    expect(result.status).toBe('EMPTY_FILE');
  });

  test('video above size limit is skipped without upload', async () => {
    const filePath = await tempFile('video.webm', '1234567890');
    const client = makeEvidenceClient();
    const result = await uploadJiraEvidenceFile(client, 'SCRUM-2', { type: 'video', filePath, maxVideoMb: 0.000001 }, []);

    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'VIDEO_TOO_LARGE' });
    expect(client.calls.upload).toBe(0);
  });

  test('screenshot failure does not prevent trace or video', async () => {
    const screenshot = await tempFile('screenshot.png', 'png');
    const trace = await tempFile('trace.zip', 'zip');
    const video = await tempFile('video.webm', 'webm');
    const client = makeEvidenceClient({
      uploadByFileName: {
        'screenshot.png': new Error('screenshot failed'),
        'trace.zip': [{ filename: 'trace.zip' }],
        'video.webm': [{ filename: 'video.webm' }],
      },
    });

    const results = await uploadJiraEvidenceFiles(client, 'SCRUM-2', [
      { type: 'screenshot', filePath: screenshot },
      { type: 'trace', filePath: trace },
      { type: 'video', filePath: video, maxVideoMb: 50 },
    ]);

    expect(results.map((result) => result.status)).toEqual(['UPLOAD_ERROR', 'LINKED', 'LINKED']);
  });
});

async function tempFile(name: string, content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-evidence-test-'));
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, content);
  return filePath;
}

function makeEvidenceClient(options: {
  existing?: JiraAttachment[];
  uploaded?: JiraAttachment[];
  uploadError?: Error;
  uploadByFileName?: Record<string, JiraAttachment[] | Error>;
} = {}) {
  const calls = { get: 0, upload: 0 };
  return {
    calls,
    async getIssueAttachments() {
      calls.get += 1;
      return options.existing ?? [];
    },
    async uploadAttachment(_issueKey: string, _filePath: string, fileName?: string) {
      calls.upload += 1;
      if (options.uploadByFileName && fileName) {
        const value = options.uploadByFileName[fileName];
        if (value instanceof Error) throw value;
        if (value) return value;
      }
      if (options.uploadError) throw options.uploadError;
      return options.uploaded ?? [{ filename: fileName ?? path.basename(_filePath) }];
    },
  };
}
