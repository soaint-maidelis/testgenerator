import { expect, type Page } from '@playwright/test';

export class ArticlePage {
  constructor(private readonly page: Page) {}

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/article/${slug}`, { waitUntil: 'domcontentloaded' });
    await expect(this.page, 'Debe abrir el detalle del artículo').toHaveURL(new RegExp(`/article/${escapeRegExp(slug)}$`));
  }

  async expectArticle(title: string, body: string, author: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: title }), 'Debe mostrar el título del artículo').toBeVisible();
    await expect(this.page.getByText(body, { exact: true }), 'Debe mostrar el contenido del artículo').toBeVisible();
    await expect(this.page.getByRole('link', { name: author }).first(), 'Debe mostrar el autor').toBeVisible();
  }

  async edit(): Promise<void> {
    await this.page.getByRole('link', { name: /edit article/i }).first().click();
    await expect(this.page, 'Debe abrir el editor del artículo').toHaveURL(/\/editor\//);
  }

  async delete(): Promise<void> {
    await this.page.getByRole('button', { name: /delete article/i }).first().click();
  }

  slug(): string {
    return new URL(this.page.url()).pathname.split('/').filter(Boolean).at(-1) ?? '';
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
