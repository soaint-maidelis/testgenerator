import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from '@playwright/test';
import { uploadTrelloEvidenceFile, uploadTrelloEvidenceFiles } from './trello.evidence';
import { TrelloRequestError, type TrelloAttachment } from './trello.types';

test.describe('trello evidence upload', () => {
  test('existing filename returns ALREADY_LINKED without upload', async () => {
    const filePath = await tempFile('screenshot.png', 'png');
    const client = makeEvidenceClient({ existing: [{ name: ' screenshot.PNG ' }] });

    const [result] = await uploadTrelloEvidenceFiles(client, 'card-1', [{ type: 'screenshot', filePath, fileName: 'screenshot.png' }]);

    expect(result.status).toBe('ALREADY_LINKED');
    expect(client.calls.upload).toBe(0);
  });

  test('new filename uploads', async () => {
    const filePath = await tempFile('trace.zip', 'zip');
    const client = makeEvidenceClient({ existing: [], uploaded: { id: 'att-1', name: 'trace.zip' } });

    const [result] = await uploadTrelloEvidenceFiles(client, 'card-1', [{ type: 'trace', filePath }]);

    expect(result.status).toBe('LINKED');
    expect(client.calls.upload).toBe(1);
  });

  test('9 MB and 10 MB are allowed by attachment limit', async () => {
    for (const sizeMb of [9, 10]) {
      const filePath = await tempSizedFile(`trace-${sizeMb}.zip`, sizeMb * 1024 * 1024);
      const client = makeEvidenceClient({ uploaded: { id: `att-${sizeMb}`, name: `trace-${sizeMb}.zip` } });

      const result = await uploadTrelloEvidenceFile(client, 'card-1', {
        type: 'trace',
        filePath,
        maxAttachmentMb: 10,
      }, []);

      expect(result.status).toBe('LINKED');
      expect(client.calls.upload).toBe(1);
    }
  });

  test('10.01 MB is FILE_TOO_LARGE without upload', async () => {
    const filePath = await tempSizedFile('trace-10-01.zip', Math.ceil(10.01 * 1024 * 1024));
    const client = makeEvidenceClient();

    const result = await uploadTrelloEvidenceFile(client, 'card-1', {
      type: 'trace',
      filePath,
      maxAttachmentMb: 10,
    }, []);

    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'FILE_TOO_LARGE', maxMb: 10 });
    expect(client.calls.upload).toBe(0);
  });

  test('12.6 MB trace is FILE_TOO_LARGE without upload', async () => {
    const filePath = await tempSizedFile('trace-12-6.zip', 13_277_823);
    const client = makeEvidenceClient();

    const result = await uploadTrelloEvidenceFile(client, 'card-1', {
      type: 'trace',
      filePath,
      maxAttachmentMb: 10,
    }, []);

    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'FILE_TOO_LARGE', maxMb: 10, size: 13_277_823 });
    expect(client.calls.upload).toBe(0);
  });

  test('missing and empty files are mapped', async () => {
    const missing = await uploadTrelloEvidenceFile(makeEvidenceClient(), 'card-1', {
      type: 'screenshot',
      filePath: path.join(os.tmpdir(), 'missing-trello-file.png'),
      fileName: 'missing-trello-file.png',
    }, []);
    expect(missing.status).toBe('FILE_NOT_FOUND');

    const emptyPath = await tempFile('empty.zip', '');
    const empty = await uploadTrelloEvidenceFile(makeEvidenceClient(), 'card-1', { type: 'trace', filePath: emptyPath }, []);
    expect(empty.status).toBe('EMPTY_FILE');
  });

  test('video too large is skipped', async () => {
    const filePath = await tempFile('video.webm', '1234567890');
    const client = makeEvidenceClient();

    const result = await uploadTrelloEvidenceFile(client, 'card-1', { type: 'video', filePath, maxVideoMb: 0.000001 }, []);

    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'VIDEO_TOO_LARGE' });
    expect(client.calls.upload).toBe(0);
  });

  test('upload failure is UPLOAD_ERROR and does not cancel others', async () => {
    const screenshot = await tempFile('screenshot.png', 'png');
    const trace = await tempFile('trace.zip', 'zip');
    const client = makeEvidenceClient({
      uploadByFileName: {
        'screenshot.png': new Error('screenshot failed'),
        'trace.zip': { name: 'trace.zip' },
      },
    });

    const results = await uploadTrelloEvidenceFiles(client, 'card-1', [
      { type: 'screenshot', filePath: screenshot },
      { type: 'trace', filePath: trace },
    ]);

    expect(results.map((result) => result.status)).toEqual(['UPLOAD_ERROR', 'LINKED']);
  });

  test('HTTP 413 maps to FILE_TOO_LARGE fallback', async () => {
    const filePath = await tempFile('trace.zip', 'zip');
    const client = makeEvidenceClient({ uploadByFileName: { 'trace.zip': new TrelloRequestError('Trello HTTP 413: too large', 413, 'uploadAttachment') } });

    const result = await uploadTrelloEvidenceFile(client, 'card-1', {
      type: 'trace',
      filePath,
      maxAttachmentMb: 25,
    }, []);

    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'FILE_TOO_LARGE', maxMb: 25 });
  });

  test('large trace does not affect screenshot or video', async () => {
    const screenshot = await tempFile('screenshot.png', 'png');
    const trace = await tempSizedFile('trace.zip', 13_277_823);
    const video = await tempFile('video.webm', 'webm');
    const client = makeEvidenceClient();

    const results = await uploadTrelloEvidenceFiles(client, 'card-1', [
      { type: 'screenshot', filePath: screenshot, maxAttachmentMb: 10 },
      { type: 'trace', filePath: trace, maxAttachmentMb: 10 },
      { type: 'video', filePath: video, maxAttachmentMb: 10, maxVideoMb: 50 },
    ]);

    expect(results.map((result) => `${result.type}:${result.status}:${result.reason ?? ''}`)).toEqual([
      'screenshot:LINKED:',
      'trace:SKIPPED:FILE_TOO_LARGE',
      'video:LINKED:',
    ]);
    expect(client.calls.upload).toBe(2);
  });
});

async function tempFile(name: string, content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trello-evidence-test-'));
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, content);
  return filePath;
}

async function tempSizedFile(name: string, sizeBytes: number): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trello-evidence-test-'));
  const filePath = path.join(dir, name);
  const handle = await fs.open(filePath, 'w');
  try {
    await handle.truncate(sizeBytes);
  } finally {
    await handle.close();
  }
  return filePath;
}

function makeEvidenceClient(options: {
  existing?: TrelloAttachment[];
  uploaded?: TrelloAttachment;
  uploadByFileName?: Record<string, TrelloAttachment | Error>;
} = {}) {
  const calls = { get: 0, upload: 0 };
  return {
    calls,
    async getCardAttachments() {
      calls.get += 1;
      return options.existing ?? [];
    },
    async uploadAttachment(_cardId: string, _filePath: string, fileName?: string) {
      calls.upload += 1;
      if (options.uploadByFileName && fileName) {
        const value = options.uploadByFileName[fileName];
        if (value instanceof Error) throw value;
        if (value) return value;
      }
      return options.uploaded ?? { name: fileName ?? path.basename(_filePath) };
    },
  };
}
