import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import type { TrelloConfig } from './trello-config';

export interface TrelloBoard { readonly id: string; readonly name: string; }
export interface TrelloList { readonly id: string; readonly name: string; }
export interface TrelloCard { readonly id: string; readonly url: string; }
export interface TrelloCardDetails extends TrelloCard { readonly name: string; readonly desc: string; readonly idList: string; }
export interface TrelloCardPayload { readonly name: string; readonly desc: string; }
export interface TrelloAttachment { readonly id?: string; readonly name: string; readonly url?: string; readonly bytes?: number; readonly mimeType?: string; }

export class TrelloClient {
  readonly #fetch: typeof fetch;

  constructor(private readonly config: TrelloConfig, fetchImplementation: typeof fetch = fetch) {
    this.#fetch = fetchImplementation;
  }

  getBoards(): Promise<readonly TrelloBoard[]> {
    return this.request<readonly TrelloBoard[]>('GET', '/members/me/boards', { fields: 'name' });
  }

  async findBoardExact(name = this.config.boardName): Promise<TrelloBoard | undefined> {
    return (await this.getBoards()).find((board) => board.name === name);
  }

  getLists(boardId: string): Promise<readonly TrelloList[]> {
    return this.request<readonly TrelloList[]>('GET', `/boards/${encodeURIComponent(boardId)}/lists`, { fields: 'name' });
  }

  async findListExact(boardId: string, name = this.config.listName): Promise<TrelloList | undefined> {
    return (await this.getLists(boardId)).find((list) => list.name === name);
  }

  createCard(listId: string, payload: TrelloCardPayload): Promise<TrelloCard> {
    return this.request<TrelloCard>('POST', '/cards', { idList: listId, name: payload.name, desc: payload.desc });
  }

  getCards(listId: string): Promise<readonly TrelloCardDetails[]> {
    return this.request<readonly TrelloCardDetails[]>('GET', `/lists/${encodeURIComponent(listId)}/cards`, { fields: 'id,name,desc,idList,url', filter: 'open' });
  }

  getCard(cardId: string): Promise<TrelloCardDetails> {
    return this.request<TrelloCardDetails>('GET', `/cards/${encodeURIComponent(cardId)}`, { fields: 'name,desc,idList,url' });
  }

  async uploadAttachment(cardId: string, filePath: string, fileName = basename(filePath)): Promise<TrelloAttachment> {
    const content = await readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([content]), fileName);
    form.append('name', fileName);
    return this.requestForm<TrelloAttachment>('POST', `/cards/${encodeURIComponent(cardId)}/attachments`, form);
  }

  private async request<T>(method: 'GET' | 'POST', pathname: string, parameters: Readonly<Record<string, string>>): Promise<T> {
    const url = new URL(`https://api.trello.com/1${pathname}`);
    for (const [name, value] of Object.entries({ ...parameters, key: this.config.apiKey, token: this.config.token })) {
      url.searchParams.set(name, value);
    }
    let response: Response;
    try {
      response = await this.#fetch(url, { method, headers: { Accept: 'application/json' } });
    } catch {
      throw new Error('Trello request failed before receiving a response');
    }
    if (!response.ok) throw new Error(`Trello request failed with HTTP ${response.status}`);
    return await response.json() as T;
  }

  private async requestForm<T>(method: 'POST', pathname: string, body: FormData): Promise<T> {
    const url = new URL(`https://api.trello.com/1${pathname}`);
    url.searchParams.set('key', this.config.apiKey);
    url.searchParams.set('token', this.config.token);
    let response: Response;
    try {
      response = await this.#fetch(url, { method, headers: { Accept: 'application/json' }, body });
    } catch {
      throw new Error('Trello request failed before receiving a response');
    }
    if (!response.ok) throw new Error(`Trello request failed with HTTP ${response.status}`);
    return await response.json() as T;
  }
}
