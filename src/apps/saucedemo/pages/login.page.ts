import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'commit' });
    const loginButton = this.page.getByRole('button', { name: 'Login' });
    await loginButton.waitFor({ state: 'visible' });
    await expect(loginButton, 'Debe mostrar el acceso de SauceDemo').toBeVisible();
  }

  async login(username: string, password: string): Promise<void> {
    await this.page.getByPlaceholder('Username').fill(username);
    await this.page.getByPlaceholder('Password').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }

  async expectAccepted(): Promise<void> {
    await this.page.waitForURL(/\/inventory\.html$/);
    await expect(this.page.getByText('Products', { exact: true }), 'Debe abrir el inventario').toBeVisible();
  }

  async expectLockedOut(): Promise<void> {
    await expect(this.page.getByText(/locked out/i), 'Debe explicar que el usuario está bloqueado').toBeVisible();
    await expect(this.page, 'Debe permanecer en login').toHaveURL(/saucedemo\.com\/?$/);
  }
}
