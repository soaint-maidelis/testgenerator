import { expect, test } from '@playwright/test';
import { buildIncidentSignature } from '../../incident-signature';
import { makeProviderTestCandidate, makeProviderTestConfig } from '../provider-test-helpers';
import { findTrelloDuplicateBySignature } from './trello.dedup';
import { mapIncidentToTrelloCard } from './trello.mapper';
import { TrelloProvider } from './trello.provider';
import type { TrelloClient } from './trello.client';
import { TrelloRequestError } from './trello.types';

test.describe('trello provider', () => {
  test('mapper builds card with signature', () => {
    const candidate = makeProviderTestCandidate();
    const card = mapIncidentToTrelloCard(candidate, {
      baseUrl: 'https://api.trello.com/1',
      boardId: 'board',
      listId: 'list',
      apiKey: 'key',
      token: 'token',
      requestTimeoutMs: 15_000,
    });

    expect(card.idList).toBe('list');
    expect(card.name).toContain('[QA-AUTO][CASE-001]');
    expect(card.desc).toContain('Bloque: sample');
    expect(card.desc).toContain(buildIncidentSignature(candidate));
  });

  test('dedup matches active card signature and ignores closed/mismatch', () => {
    const candidate = makeProviderTestCandidate();
    const duplicate = findTrelloDuplicateBySignature(candidate, [
      { id: 'closed', name: 'closed', closed: true, desc: `QA-AUTO-SIGNATURE:\n${buildIncidentSignature(candidate)}` },
      { id: 'wrong', name: 'wrong', desc: 'QA-AUTO-SIGNATURE:\nWRONG|SIGNATURE|X' },
      { id: 'card-1', name: 'match', desc: `QA-AUTO-SIGNATURE:\n${buildIncidentSignature(candidate)}` },
    ]);

    expect(duplicate?.id).toBe('card-1');
  });

  test('provider create maps mocked card', async () => {
    const provider = new TrelloProvider(makeProviderTestConfig('trello'), makeTrelloClient({ createId: 'card-123' }));

    const created = await provider.createIncident(makeProviderTestCandidate());
    expect(created).toMatchObject({ provider: 'trello', incidentId: 'card-123', incidentUrl: 'https://trello.example/card-123' });
  });

  test('validate only performs validation and dedup without create', async () => {
    const client = makeTrelloClient();
    const provider = new TrelloProvider(makeProviderTestConfig('trello'), client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('trello') });

    expect(result).toMatchObject({ provider: 'trello', status: 'VALIDATED', message: 'TRELLO_VALIDATE_ONLY=true' });
    expect(client.calls.create).toBe(0);
  });

  test('dedup exact returns DUPLICATE', async () => {
    const candidate = makeProviderTestCandidate();
    const client = makeTrelloClient({
      cards: [{ id: 'card-777', name: 'match', url: 'https://trello.example/card-777', desc: `QA-AUTO-SIGNATURE:\n${buildIncidentSignature(candidate)}` }],
    });
    const provider = new TrelloProvider(makeProviderTestConfig('trello'), client);

    const result = await provider.processIncident({ candidate, config: makeProviderTestConfig('trello') });

    expect(result).toMatchObject({ provider: 'trello', status: 'DUPLICATE', incidentId: 'card-777' });
    expect(client.calls.create).toBe(0);
  });

  test('same case id different signature is not duplicate and validates only', async () => {
    const client = makeTrelloClient({
      cards: [{ id: 'card-777', name: 'same case', desc: 'QA-AUTO-SIGNATURE:\nE37-AM-01.01.1|OTHER|VIEW' }],
    });
    const provider = new TrelloProvider(makeProviderTestConfig('trello'), client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('trello') });

    expect(result.status).toBe('VALIDATED');
    expect(client.calls.create).toBe(0);
  });

  test('description without signature is not duplicate', () => {
    const duplicate = findTrelloDuplicateBySignature(makeProviderTestCandidate(), [{ id: 'card-1', name: 'no signature', desc: 'Caso: CASE-001' }]);

    expect(duplicate).toBeUndefined();
  });

  test('dedup failure fails closed and does not create', async () => {
    const client = makeTrelloClient({ searchError: new TrelloRequestError('Trello HTTP 500: cards failed', 500, 'getActiveCards') });
    const provider = new TrelloProvider({ ...makeProviderTestConfig('trello'), trelloValidateOnly: false }, client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('trello') });

    expect(result).toMatchObject({ provider: 'trello', status: 'ERROR', message: 'Trello HTTP 500: cards failed' });
    expect(client.calls.create).toBe(0);
  });

  test('BUG_AUTO HIGH with create enabled creates card', async () => {
    const client = makeTrelloClient({ createId: 'card-999' });
    const provider = new TrelloProvider({ ...makeProviderTestConfig('trello'), trelloValidateOnly: false }, client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('trello') });

    expect(result).toMatchObject({ provider: 'trello', status: 'CREATED', incidentId: 'card-999' });
    expect(client.calls.create).toBe(1);
  });

  test('create failure returns ERROR', async () => {
    const client = makeTrelloClient({ createError: new TrelloRequestError('Trello HTTP 400: bad request', 400, 'createCard') });
    const provider = new TrelloProvider({ ...makeProviderTestConfig('trello'), trelloValidateOnly: false }, client);

    const result = await provider.processIncident({ candidate: makeProviderTestCandidate(), config: makeProviderTestConfig('trello') });

    expect(result).toMatchObject({ provider: 'trello', status: 'ERROR', message: 'Trello HTTP 400: bad request' });
  });

  test('gate skips before Trello HTTP', async () => {
    const client = makeTrelloClient();
    const provider = new TrelloProvider({ ...makeProviderTestConfig('trello'), trelloValidateOnly: false }, client);
    const candidate = makeProviderTestCandidate();
    candidate.incidentDecision.confidence = 'MEDIUM';

    const result = await provider.processIncident({ candidate, config: makeProviderTestConfig('trello') });

    expect(result).toMatchObject({ status: 'SKIPPED', message: 'confidence!=HIGH' });
    expect(client.calls.validate).toBe(0);
  });
});

function makeTrelloClient(options: {
  cards?: Awaited<ReturnType<TrelloClient['getActiveCards']>>;
  createId?: string;
  searchError?: Error;
  createError?: Error;
} = {}): TrelloClient & { calls: { validate: number; search: number; create: number } } {
  const calls = { validate: 0, search: 0, create: 0 };
  return {
    calls,
    async validateConnection() {
      calls.validate += 1;
      return { status: 'VALID', board: { id: 'board-1', name: 'Board' }, list: { id: 'list-1', name: 'List', idBoard: 'board-1' } };
    },
    async getCurrentMember() {
      return { id: 'member-1', username: 'qa-user' };
    },
    async getBoard(boardId) {
      return { id: boardId, name: 'Board' };
    },
    async getList(listId) {
      return { id: listId, name: 'List', idBoard: 'board-1' };
    },
    async getActiveCards() {
      calls.search += 1;
      if (options.searchError) throw options.searchError;
      return options.cards ?? [];
    },
    async getCard(cardId) {
      return { id: cardId, name: 'Card' };
    },
    async createCard() {
      calls.create += 1;
      if (options.createError) throw options.createError;
      const id = options.createId ?? 'card-123';
      return { id, name: 'created', url: `https://trello.example/${id}` };
    },
    async getCardAttachments() {
      return [];
    },
    async uploadAttachment(_cardId, _filePath, fileName) {
      return { id: 'att-1', name: fileName ?? 'file.bin' };
    },
  };
}
