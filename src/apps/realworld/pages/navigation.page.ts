import { expect, type Page } from '@playwright/test';

export class NavigationPage {
  constructor(private readonly page: Page) {}

  async authenticateWithExecutionToken(token: string, username: string): Promise<void> {
    await this.page.addInitScript((value) => {
      window.localStorage.setItem('jwtToken', value);
      window.localStorage.setItem('token', value);
    }, token);
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.expectSignedIn(username);
  }

  async expectSignedIn(username: string): Promise<void> {
    await this.page.waitForURL(/^https:\/\/demo\.realworld\.show\/?$/);
    await expect(this.page, 'Debe completar la autenticación y navegar al home').toHaveURL(/^https:\/\/demo\.realworld\.show\/?$/);
    const userLink = this.page.getByRole('link', { name: username });
    await userLink.waitFor({ state: 'visible' });
    await expect(userLink, 'Debe mostrar el usuario autenticado').toBeVisible();
  }

  async openNewArticle(): Promise<void> {
    await this.page.getByRole('link', { name: /new article/i }).click();
    await expect(this.page, 'Debe abrir el editor de artículos').toHaveURL(/\/editor\/?$/);
  }
}
