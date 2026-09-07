import fs from 'fs/promises';
import path from 'path';
import type { IncidentAttachmentResult } from '../incident-provider.types';
import { debug } from '../../incident-logger';
import type {
  TrelloAttachment,
  TrelloBoard,
  TrelloCard,
  TrelloConfig,
  TrelloCreateCardInput,
  TrelloList,
  TrelloMember,
  TrelloValidationResult,
} from './trello.types';
import { TrelloRequestError } from './trello.types';

export interface TrelloClient {
  validateConnection(): Promise<TrelloValidationResult>;
  getCurrentMember(): Promise<TrelloMember>;
  getBoard(boardId: string): Promise<TrelloBoard>;
  getBoardLists(boardId: string): Promise<TrelloList[]>;
  getList(listId: string): Promise<TrelloList>;
  getActiveCards(boardId: string, listId: string): Promise<TrelloCard[]>;
  getCard(cardId: string): Promise<TrelloCard>;
  createCard(input: TrelloCreateCardInput): Promise<TrelloCard>;
  getCardAttachments(cardId: string): Promise<TrelloAttachment[]>;
  uploadAttachment(cardId: string, filePath: string, fileName?: string): Promise<TrelloAttachment>;
  attachEvidence?(cardId: string, evidence: IncidentAttachmentResult[]): Promise<IncidentAttachmentResult[]>;
}

type FetchLike = typeof fetch;

export class TrelloHttpClient implements TrelloClient {
  constructor(
    private readonly config: TrelloConfig,
    private readonly fetchImpl?: FetchLike,
  ) {}

  async validateConnection(): Promise<TrelloValidationResult> {
    const configError = validateTrelloConfig(this.config);
    if (configError) {
      return { status: 'INVALID_CONFIG', message: configError };
    }

    try {
      const board = await this.getBoard(this.config.boardId);
      const list = await this.getList(this.config.listId);
      if (list.idBoard && list.idBoard !== board.id) {
        return { status: 'LIST_NOT_FOUND', message: 'La lista no pertenece al board configurado.' };
      }
      return { status: 'VALID', board, list };
    } catch (error) {
      return mapTrelloValidationError(error);
    }
  }

  async getCurrentMember(): Promise<TrelloMember> {
    return this.request<TrelloMember>('getCurrentMember', '/members/me', {
      method: 'GET',
      query: { fields: 'username' },
    });
  }

  async getBoard(boardId: string): Promise<TrelloBoard> {
    return this.request<TrelloBoard>('getBoard', `/boards/${encodeURIComponent(boardId)}`, {
      method: 'GET',
      query: { fields: 'name' },
    });
  }

  async getBoardLists(boardId: string): Promise<TrelloList[]> {
    const lists = await this.request<TrelloList[]>('getBoardLists', `/boards/${encodeURIComponent(boardId)}/lists`, {
      method: 'GET',
      query: { fields: 'name,idBoard,closed', filter: 'open' },
    });
    return lists.filter((list) => !list.closed);
  }

  async getList(listId: string): Promise<TrelloList> {
    return this.request<TrelloList>('getList', `/lists/${encodeURIComponent(listId)}`, {
      method: 'GET',
      query: { fields: 'name,idBoard,closed' },
    });
  }

  async getActiveCards(_boardId: string, listId: string): Promise<TrelloCard[]> {
    const cards = await this.request<TrelloCard[]>('getActiveCards', `/lists/${encodeURIComponent(listId)}/cards`, {
      method: 'GET',
      query: { fields: 'id,name,desc,url,shortUrl,idList,closed', filter: 'open' },
    });
    return cards.filter((card) => !card.closed);
  }

  async getCard(cardId: string): Promise<TrelloCard> {
    return this.request<TrelloCard>('getCard', `/cards/${encodeURIComponent(cardId)}`, {
      method: 'GET',
      query: { fields: 'id,name,desc,url,shortUrl,idList,closed' },
    });
  }

  async createCard(input: TrelloCreateCardInput): Promise<TrelloCard> {
    const body = new URLSearchParams({
      idList: input.idList,
      name: input.name,
      desc: input.desc,
      pos: 'top',
    });
    return this.request<TrelloCard>('createCard', '/cards', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  async getCardAttachments(cardId: string): Promise<TrelloAttachment[]> {
    return this.request<TrelloAttachment[]>('getCardAttachments', `/cards/${encodeURIComponent(cardId)}/attachments`, {
      method: 'GET',
      query: { fields: 'id,name,url,bytes,mimeType' },
    });
  }

  async uploadAttachment(cardId: string, filePath: string, fileName?: string): Promise<TrelloAttachment> {
    const body = await fs.readFile(filePath);
    const form = new FormData();
    const uploadName = fileName ?? path.basename(filePath);
    form.append('file', new Blob([body]), uploadName);
    form.append('name', uploadName);
    return this.request<TrelloAttachment>('uploadAttachment', `/cards/${encodeURIComponent(cardId)}/attachments`, {
      method: 'POST',
      body: form,
      skipContentType: true,
    });
  }

  private async request<T>(
    operation: string,
    resourcePath: string,
    options: RequestInit & { query?: Record<string, string>; skipContentType?: boolean } = {},
  ): Promise<T> {
    const url = buildTrelloUrl(this.config, resourcePath, options.query);
    const controller = new AbortController();
    const started = Date.now();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      debug('[TRELLO CLIENT]', { operation, method: options.method ?? 'GET', url: sanitizeTrelloUrl(url), requestStarted: true });
      const fetchImpl = this.fetchImpl ?? getGlobalFetch(operation);
      const response = await fetchImpl(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(options.skipContentType ? {} : { 'Content-Type': 'application/json' }),
          ...(options.headers ?? {}),
        },
      });
      const text = await response.text();
      debug('[TRELLO CLIENT]', { operation, statusCode: response.status, elapsedMs: Date.now() - started });

      if (!response.ok) {
        throw new TrelloRequestError(buildTrelloErrorMessage(text, response.status, response.statusText), response.status, operation);
      }

      if (!text.trim()) {
        return {} as T;
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new TrelloRequestError(`Trello devolvio JSON invalido en ${operation}.`, response.status, operation);
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw new TrelloRequestError(`Timeout al comunicarse con Trello en ${operation}.`, undefined, operation);
      }
      if (error instanceof TrelloRequestError) {
        throw error;
      }
      throw new TrelloRequestError(error instanceof Error ? error.message : String(error), undefined, operation);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function validateTrelloConfig(config: TrelloConfig): string | undefined {
  if (!config.baseUrl) return 'Falta TRELLO_BASE_URL.';
  if (!config.boardId) return 'Falta TRELLO_BOARD_ID.';
  if (!config.listId) return 'Falta TRELLO_LIST_ID.';
  if (!config.apiKey) return 'Falta TRELLO_API_KEY.';
  if (!config.token) return 'Falta TRELLO_TOKEN.';
  return undefined;
}

export function buildTrelloUrl(config: TrelloConfig, resourcePath: string, query: Record<string, string> = {}): string {
  const base = config.baseUrl.replace(/\/+$/g, '');
  const pathPart = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;
  const url = new URL(`${base}${pathPart}`);
  for (const [key, value] of Object.entries({ ...query, key: config.apiKey, token: config.token })) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function getGlobalFetch(operation: string): FetchLike {
  const fetchImpl = (globalThis as typeof globalThis & { fetch?: FetchLike }).fetch;
  if (!fetchImpl) {
    throw new TrelloRequestError('Runtime sin fetch global disponible para Trello.', undefined, operation);
  }
  return fetchImpl;
}

function mapTrelloValidationError(error: unknown): TrelloValidationResult {
  if (!(error instanceof TrelloRequestError)) {
    return { status: 'HTTP_ERROR', message: error instanceof Error ? error.message : String(error) };
  }

  if (error.statusCode === 401) return { status: 'AUTH_ERROR', statusCode: error.statusCode, message: error.message };
  if (error.statusCode === 403) return { status: 'PERMISSION_ERROR', statusCode: error.statusCode, message: error.message };
  if (error.statusCode === 404 && error.operation === 'getBoard') return { status: 'BOARD_NOT_FOUND', statusCode: error.statusCode, message: error.message };
  if (error.statusCode === 404 && error.operation === 'getBoardLists') return { status: 'BOARD_NOT_FOUND', statusCode: error.statusCode, message: error.message };
  if (error.statusCode === 404 && error.operation === 'getList') return { status: 'LIST_NOT_FOUND', statusCode: error.statusCode, message: error.message };
  return { status: 'HTTP_ERROR', statusCode: error.statusCode, message: error.message };
}

function buildTrelloErrorMessage(text: string, status: number, statusText: string): string {
  const visible = parseTrelloErrorText(text) || statusText || 'Error Trello';
  return `Trello HTTP ${status}: ${visible}`;
}

function parseTrelloErrorText(text: string): string | undefined {
  if (!text.trim()) return undefined;
  try {
    const body = JSON.parse(text) as { message?: string; error?: string };
    return body.message ?? body.error ?? undefined;
  } catch {
    return text.replace(/\s+/g, ' ').trim().slice(0, 300);
  }
}

function sanitizeTrelloUrl(url: string): string {
  return url.replace(/([?&](?:key|token)=)[^&\s]+/gi, '$1[REDACTED]');
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
