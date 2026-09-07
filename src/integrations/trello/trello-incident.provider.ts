import type { IncidentArtifact, IncidentModel, IncidentProvider } from '../../core/incidents/incident.types';
import { mapIncidentToTrelloCard } from './trello-card.mapper';
import type { TrelloClient } from './trello-client';

export class TrelloIncidentProvider implements IncidentProvider {
  readonly id = 'trello';

  constructor(
    private readonly client: TrelloClient,
    private readonly listId: string,
    private readonly environment = 'demo',
  ) {}

  async writePreview(incident: IncidentModel): Promise<IncidentArtifact> {
    const card = await this.client.createCard(this.listId, mapIncidentToTrelloCard(incident, this.environment));
    return { providerId: this.id, path: card.url, createdAt: new Date().toISOString() };
  }
}
