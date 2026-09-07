import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByRole('heading', { name: 'Sign in' }), 'Debe mostrar el login local').toBeVisible();
  }

  async submit(email: string, password: string): Promise<number> {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    const responsePromise = this.page.waitForResponse((response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/login'));
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    return (await responsePromise).status();
  }

  errorMessage() {
    return this.page.getByRole('alert');
  }
}
