import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
    const heading = this.page.getByRole('heading', { name: 'Sign in' });
    await heading.waitFor({ state: 'visible' });
    await expect(heading, 'Debe mostrar el formulario de login').toBeVisible();
  }

  async submit(email: string, password: string): Promise<void> {
    await this.page.getByPlaceholder('Email').fill(email);
    await this.page.getByPlaceholder('Password').fill(password);
    await Promise.all([
      this.page.waitForResponse((response) =>
        response.request().method() === 'POST' && response.url().endsWith('/users/login')),
      this.page.getByRole('button', { name: 'Sign in' }).click(),
    ]);
  }

  invalidCredentialsMessage() {
    return this.page.getByText(/credentials invalid/i);
  }
}
