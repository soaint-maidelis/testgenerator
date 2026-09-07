import { expect, type Page } from '@playwright/test';

export class ItemsPage {
  constructor(private readonly page: Page) {}

  async expectSignedIn(name: string): Promise<void> {
    await this.page.waitForURL(/\/items$/);
    await expect(this.page.getByText(`Signed in as ${name}`), 'Debe identificar al usuario local').toBeVisible();
  }

  async openNew(): Promise<void> {
    await this.page.getByRole('link', { name: 'Create item' }).click();
    await expect(this.page, 'Debe abrir el formulario de creación').toHaveURL(/\/items\/new$/);
  }

  async openItem(title: string): Promise<void> {
    await this.page.getByRole('link', { name: title }).click();
    await expect(this.page, 'Debe abrir el detalle del elemento').toHaveURL(/\/items\/\d+$/);
  }
}
