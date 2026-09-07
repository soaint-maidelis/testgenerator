import { expect, type Page } from '@playwright/test';

export class CommentsPage {
  constructor(private readonly page: Page) {}

  async add(body: string): Promise<void> {
    await this.page.getByPlaceholder('Write a comment...').fill(body);
    const responsePromise = this.page.waitForResponse((response) =>
      response.request().method() === 'POST' && /\/api\/articles\/[^/]+\/comments$/.test(new URL(response.url()).pathname));
    await this.page.getByRole('button', { name: 'Post Comment' }).click();
    const response = await responsePromise;
    if (!response.ok()) throw new Error(`Comment creation failed with HTTP ${response.status()}`);
    await expect(this.page.getByText(body, { exact: true }), 'Debe mostrar el comentario creado').toBeVisible();
  }

  async remove(body: string): Promise<void> {
    await expect(this.page.getByText(body, { exact: true }), 'Debe existir el comentario antes de eliminarlo').toBeVisible();
    const responsePromise = this.page.waitForResponse((response) =>
      response.request().method() === 'DELETE' && /\/api\/articles\/[^/]+\/comments\/\d+$/.test(new URL(response.url()).pathname));
    // The hosted demo exposes the comment delete icon without an accessible role or name.
    await this.page.locator('.ion-trash-a').last().click();
    const response = await responsePromise;
    if (!response.ok()) throw new Error(`Comment deletion failed with HTTP ${response.status()}`);
    await expect(this.page.getByText(body, { exact: true }), 'Debe eliminar el comentario').toHaveCount(0);
  }
}
