export type TrelloConfig = {
  baseUrl: string;
  boardId: string;
  listId: string;
  apiKey: string;
  token: string;
  requestTimeoutMs: number;
};

export type TrelloBoard = {
  id: string;
  name: string;
};

export type TrelloList = {
  id: string;
  name: string;
  idBoard?: string;
  closed?: boolean;
};

export type TrelloCard = {
  id: string;
  name: string;
  desc?: string;
  url?: string;
  shortUrl?: string;
  idList?: string;
  closed?: boolean;
};

export type TrelloAttachment = {
  id?: string;
  name: string;
  url?: string;
  bytes?: number;
  mimeType?: string;
};

export type TrelloMember = {
  id: string;
  username?: string;
};

export type TrelloCreateCardInput = {
  idList: string;
  name: string;
  desc: string;
  labels?: string[];
};

export type TrelloValidationStatus =
  | 'VALID'
  | 'INVALID_CONFIG'
  | 'AUTH_ERROR'
  | 'BOARD_NOT_FOUND'
  | 'LIST_NOT_FOUND'
  | 'PERMISSION_ERROR'
  | 'HTTP_ERROR';

export type TrelloValidationResult =
  | { status: 'VALID'; board: TrelloBoard; list: TrelloList }
  | { status: Exclude<TrelloValidationStatus, 'VALID'>; statusCode?: number; message?: string };

export class TrelloRequestError extends Error {
  constructor(message: string, readonly statusCode?: number, readonly operation?: string) {
    super(message);
    this.name = 'TrelloRequestError';
  }
}
