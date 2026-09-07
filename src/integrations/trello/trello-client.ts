import type { TrelloConfig } from './trello-config';

export interface TrelloBoard { readonly id: string; readonly name: string; }
export interface TrelloList { readonly id: string; readonly name: string; }
export interface TrelloCard { readonly id: string; readonly url: string; }
export interface TrelloCardDetails extends TrelloCard { readonly name: string; readonly desc: string; readonly idList: string; }
export interface TrelloCardPayload { readonly name: string; readonly desc: string; }

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

  getCard(cardId: string): Promise<TrelloCardDetails> {
    return this.request<TrelloCardDetails>('GET', `/cards/${encodeURIComponent(cardId)}`, { fields: 'name,desc,idList,url' });
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
}
