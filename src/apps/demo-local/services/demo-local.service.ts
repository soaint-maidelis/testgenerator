import type { APIRequestContext } from '@playwright/test';

import type { DemoItem, DemoItemInput } from '../data/demo-local.data';

export class DemoLocalService {
  constructor(private readonly request: APIRequestContext, private readonly apiURL: string) {}

  async reset(): Promise<void> {
    const response = await this.request.post(`${this.apiURL}/reset`);
    if (!response.ok()) throw new Error(`Local demo reset failed with HTTP ${response.status()}`);
  }

  async createItem(item: DemoItemInput): Promise<DemoItem> {
    const response = await this.request.post(`${this.apiURL}/items`, { data: item });
    if (!response.ok()) throw new Error(`Local item creation failed with HTTP ${response.status()}`);
    return await response.json() as DemoItem;
  }

  async deleteItem(id: number): Promise<void> {
    const response = await this.request.delete(`${this.apiURL}/items/${id}`);
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`Local item cleanup failed with HTTP ${response.status()}`);
    }
  }
}
