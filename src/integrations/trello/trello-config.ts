export interface TrelloConfig {
  readonly apiKey: string;
  readonly token: string;
  readonly boardName: string;
  readonly listName: string;
}

const VARIABLES = [
  'TRELLO_API_KEY',
  'TRELLO_API_TOKEN',
  'TRELLO_BOARD_NAME',
  'TRELLO_LIST_NAME',
] as const;

export function loadTrelloConfig(environment: NodeJS.ProcessEnv = process.env): TrelloConfig {
  const missing = VARIABLES.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing Trello environment variables: ${missing.join(', ')}`);
  }
  return {
    apiKey: environment.TRELLO_API_KEY!.trim(),
    token: environment.TRELLO_API_TOKEN!.trim(),
    boardName: environment.TRELLO_BOARD_NAME!.trim(),
    listName: environment.TRELLO_LIST_NAME!.trim(),
  };
}
