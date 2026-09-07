import { expect, type Page, type Response } from '@playwright/test';

import type { DemoItemInput } from '../data/demo-local.data';

export class ItemPage {
  constructor(private readonly page: Page) {}

  async goto(id: number): Promise<void> {
    await this.page.goto(`/items/${id}`, { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByRole('heading', { name: 'Item details' }), 'Debe mostrar el detalle').toBeVisible();
  }

  async fill(item: DemoItemInput): Promise<void> {
    await this.page.getByLabel('Title').fill(item.title);
    await this.page.getByLabel('Description').fill(item.description);
  }

  async save(method: 'POST' | 'PUT'): Promise<void> {
    const responsePromise = this.page.waitForResponse((response) =>
      response.request().method() === method && /\/api\/items(?:\/\d+)?$/.test(new URL(response.url()).pathname));
    await this.page.getByRole('button', { name: 'Save item' }).click();
    const response = await responsePromise;
    if (!response.ok()) throw new Error(`Item save failed with HTTP ${response.status()}`);
    await expect(this.page, 'Debe navegar al elemento guardado').toHaveURL(/\/items\/\d+$/);
  }

  async expectItem(item: DemoItemInput): Promise<void> {
    await expect(this.page.getByRole('heading', { name: item.title }), 'Debe mostrar el título persistido').toBeVisible();
    await expect(this.page.getByText(item.description, { exact: true }), 'Debe mostrar la descripción persistida').toBeVisible();
  }

  async edit(): Promise<void> {
    await this.page.getByRole('button', { name: 'Edit item' }).click();
    await expect(this.page.getByRole('heading', { name: 'Edit item' }), 'Debe mostrar el formulario de edición').toBeVisible();
  }

  async delete(): Promise<Response> {
    const responsePromise = this.page.waitForResponse((response) =>
      response.request().method() === 'DELETE' && /\/api\/items\/\d+$/.test(new URL(response.url()).pathname));
    await this.page.getByRole('button', { name: 'Delete item' }).click();
    return responsePromise;
  }

  async addComment(body: string): Promise<void> {
    await this.page.getByLabel('Comment').fill(body);
    const responsePromise = this.page.waitForResponse((response) =>
      response.request().method() === 'POST' && /\/api\/items\/\d+\/comments$/.test(new URL(response.url()).pathname));
    await this.page.getByRole('button', { name: 'Add comment' }).click();
    if (!(await responsePromise).ok()) throw new Error('Comment creation failed');
    await expect(this.page.getByText(body, { exact: true }), 'Debe mostrar el comentario').toBeVisible();
  }

  async removeComment(body: string): Promise<void> {
    const row = this.page.getByRole('listitem').filter({ hasText: body });
    const responsePromise = this.page.waitForResponse((response) =>
      response.request().method() === 'DELETE' && /\/api\/items\/\d+\/comments\/\d+$/.test(new URL(response.url()).pathname));
    await row.getByRole('button', { name: 'Delete comment' }).click();
    if (!(await responsePromise).ok()) throw new Error('Comment deletion failed');
    await expect(this.page.getByText(body, { exact: true }), 'Debe eliminar el comentario').toHaveCount(0);
  }
}
