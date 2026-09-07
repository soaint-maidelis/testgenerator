import { expect, type Locator, type Page } from '@playwright/test';

export class CartPage {
  constructor(private readonly page: Page) {}

  async expectProduct(name: string): Promise<void> {
    await expect(this.product(name), 'El carrito debe contener el producto elegido').toBeVisible();
  }

  async removeProduct(name: string): Promise<void> {
    await this.product(name).getByRole('button', { name: 'Remove' }).click();
  }

  async expectProductAbsent(name: string): Promise<void> {
    await expect(this.product(name), 'El producto eliminado ya no debe aparecer en el carrito').toHaveCount(0);
  }

  async checkout(): Promise<void> {
    await this.page.getByRole('button', { name: 'Checkout' }).click();
    await expect(this.page, 'Debe abrir los datos de checkout').toHaveURL(/checkout-step-one\.html$/);
  }

  private product(name: string): Locator {
    return this.page.locator('[data-test="inventory-item"]').filter({ hasText: name });
  }
}
