import { expect, type Page } from '@playwright/test';

import type { ArticleData, PublishedArticle } from '../data/realworld-data';

export class EditorPage {
  constructor(private readonly page: Page) {}

  async fillArticle(article: ArticleData): Promise<void> {
    await this.page.getByPlaceholder('Article Title').fill(article.title);
    await this.page.getByPlaceholder("What's this article about?").fill(article.description);
    await this.page.getByPlaceholder('Write your article (in markdown)').fill(article.body);
    for (const tag of article.tagList) {
      await this.page.getByPlaceholder('Enter tags').fill(tag);
      await this.page.getByPlaceholder('Enter tags').press('Enter');
    }
  }

  async publish(): Promise<PublishedArticle> {
    const responsePromise = this.page.waitForResponse((response) =>
      ['POST', 'PUT'].includes(response.request().method()) && /\/api\/articles(?:\/[^/]+)?$/.test(new URL(response.url()).pathname));
    await this.page.getByRole('button', { name: 'Publish Article' }).click();
    const response = await responsePromise;
    if (!response.ok()) throw new Error(`Article publication failed with HTTP ${response.status()}`);
    await expect(this.page, 'Debe navegar al artículo publicado').toHaveURL(/\/article\//);
    return (await response.json() as { readonly article: PublishedArticle }).article;
  }

  async update(article: ArticleData): Promise<PublishedArticle> {
    await this.fillArticle(article);
    return this.publish();
  }
}
