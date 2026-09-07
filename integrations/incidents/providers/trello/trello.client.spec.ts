import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from '@playwright/test';
import { buildTrelloUrl, TrelloHttpClient } from './trello.client';
import { TrelloRequestError, type TrelloConfig } from './trello.types';

const config: TrelloConfig = {
  baseUrl: 'https://api.trello.test/1',
  boardId: 'board-1',
  listId: 'list-1',
  apiKey: 'secret-key',
  token: 'secret-token',
  requestTimeoutMs: 50,
};

test.describe('trello http client', () => {
  test('validateConnection returns VALID for board/list and membership', async () => {
    const client = new TrelloHttpClient(config, mockFetch([
      jsonResponse(200, { id: 'board-1', name: 'Board' }),
      jsonResponse(200, { id: 'list-1', name: 'List', idBoard: 'board-1' }),
    ]));

    await expect(client.validateConnection()).resolves.toMatchObject({ status: 'VALID', board: { id: 'board-1' }, list: { id: 'list-1' } });
  });

  test('validateConnection maps board/list/auth/permission failures', async () => {
    await expect(new TrelloHttpClient(config, mockFetch([jsonResponse(404, { message: 'not found' })])).validateConnection())
      .resolves.toMatchObject({ status: 'BOARD_NOT_FOUND', statusCode: 404 });

    await expect(new TrelloHttpClient(config, mockFetch([
      jsonResponse(200, { id: 'board-1', name: 'Board' }),
      jsonResponse(404, { message: 'not found' }),
    ])).validateConnection()).resolves.toMatchObject({ status: 'LIST_NOT_FOUND', statusCode: 404 });

    await expect(new TrelloHttpClient(config, mockFetch([jsonResponse(401, { message: 'unauthorized' })])).validateConnection())
      .resolves.toMatchObject({ status: 'AUTH_ERROR', statusCode: 401 });

    await expect(new TrelloHttpClient(config, mockFetch([jsonResponse(403, { message: 'forbidden' })])).validateConnection())
      .resolves.toMatchObject({ status: 'PERMISSION_ERROR', statusCode: 403 });
  });

  test('getActiveCards calls list cards and filters closed cards', async () => {
    let requestUrl = '';
    const client = new TrelloHttpClient(config, async (url) => {
      requestUrl = String(url);
      return jsonResponse(200, [
        { id: 'open', name: 'open', closed: false },
        { id: 'closed', name: 'closed', closed: true },
      ]);
    });

    const cards = await client.getActiveCards('board-1', 'list-1');

    expect(cards.map((card) => card.id)).toEqual(['open']);
    expect(requestUrl).toContain('/lists/list-1/cards');
    expect(requestUrl).toContain('key=secret-key');
    expect(requestUrl).toContain('token=secret-token');
  });

  test('getBoardLists calls board lists and filters closed lists', async () => {
    let requestUrl = '';
    const client = new TrelloHttpClient(config, async (url) => {
      requestUrl = String(url);
      return jsonResponse(200, [
        { id: 'open-list', name: 'Backlog', idBoard: 'board-1', closed: false },
        { id: 'closed-list', name: 'Archived', idBoard: 'board-1', closed: true },
      ]);
    });

    const lists = await client.getBoardLists('board-1');

    expect(lists.map((list) => list.id)).toEqual(['open-list']);
    expect(requestUrl).toContain('/boards/board-1/lists');
    expect(requestUrl).toContain('filter=open');
  });

  test('getCurrentMember calls members me with auth query params', async () => {
    let requestUrl = '';
    const client = new TrelloHttpClient(config, async (url) => {
      requestUrl = String(url);
      return jsonResponse(200, { id: 'member-1', username: 'qa-user' });
    });

    const member = await client.getCurrentMember();

    expect(member).toEqual({ id: 'member-1', username: 'qa-user' });
    expect(requestUrl).toContain('/members/me');
    expect(requestUrl).toContain('key=secret-key');
    expect(requestUrl).toContain('token=secret-token');
  });

  test('createCard posts minimal card body', async () => {
    let request: { url: string; init: RequestInit } | undefined;
    const client = new TrelloHttpClient(config, async (url, init) => {
      request = { url: String(url), init: init ?? {} };
      return jsonResponse(200, { id: 'card-1', name: 'created', url: 'https://trello.test/card-1' });
    });

    await expect(client.createCard({ idList: 'list-1', name: 'Name', desc: 'Desc' })).resolves.toMatchObject({ id: 'card-1' });

    expect(request?.url).toContain('/cards?');
    expect(request?.init.method).toBe('POST');
    expect(String(request?.init.body)).toContain('idList=list-1');
    expect(String(request?.init.body)).toContain('name=Name');
  });

  test('createCard maps 400/401 and cards maps 500', async () => {
    await expect(new TrelloHttpClient(config, mockFetch([jsonResponse(400, { message: 'bad request' })]))
      .createCard({ idList: 'list-1', name: 'Name', desc: 'Desc' })).rejects.toMatchObject({ statusCode: 400 });

    await expect(new TrelloHttpClient(config, mockFetch([jsonResponse(401, { message: 'unauthorized' })]))
      .createCard({ idList: 'list-1', name: 'Name', desc: 'Desc' })).rejects.toMatchObject({ statusCode: 401 });

    await expect(new TrelloHttpClient(config, mockFetch([jsonResponse(500, { message: 'cards failed' })]))
      .getActiveCards('board-1', 'list-1')).rejects.toMatchObject({ statusCode: 500 });
  });

  test('attachments list and upload use card attachment endpoint', async () => {
    const filePath = await tempFile('screenshot.png', 'png');
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = new TrelloHttpClient(config, async (url, init) => {
      requests.push({ url: String(url), init });
      return requests.length === 1
        ? jsonResponse(200, [{ id: 'att-1', name: 'a.png' }])
        : jsonResponse(200, { id: 'att-2', name: 'screenshot.png', url: 'https://trello.test/att-2' });
    });

    await expect(client.getCardAttachments('card-1')).resolves.toEqual([{ id: 'att-1', name: 'a.png' }]);
    await expect(client.uploadAttachment('card-1', filePath, 'screenshot.png')).resolves.toMatchObject({ id: 'att-2' });

    expect(requests[0].url).toContain('/cards/card-1/attachments');
    expect(requests[1].url).toContain('/cards/card-1/attachments');
    expect(requests[1].init?.method).toBe('POST');
  });

  test('timeout aborts request', async () => {
    const client = new TrelloHttpClient({ ...config, requestTimeoutMs: 5 }, async (_url, init) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
      return jsonResponse(200, {});
    });

    await expect(client.getActiveCards('board-1', 'list-1')).rejects.toThrow(/Timeout al comunicarse con Trello/);
  });

  test('invalid JSON is reported as TrelloRequestError', async () => {
    const client = new TrelloHttpClient(config, mockFetch([textResponse(200, 'not-json')]));
    await expect(client.getActiveCards('board-1', 'list-1')).rejects.toBeInstanceOf(TrelloRequestError);
  });

  test('buildTrelloUrl centralizes auth query params', () => {
    const url = buildTrelloUrl(config, '/cards/card-1', { fields: 'name' });

    expect(url).toContain('fields=name');
    expect(url).toContain('key=secret-key');
    expect(url).toContain('token=secret-token');
  });
});

async function tempFile(name: string, content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trello-client-test-'));
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, content);
  return filePath;
}

function mockFetch(responses: Response[]): typeof fetch {
  const queue = [...responses];
  return async () => {
    const response = queue.shift();
    if (!response) throw new Error('No mock response configured.');
    return response;
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, statusText: status === 200 || status === 201 ? 'OK' : 'ERROR' });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status });
}
