import { expect, type Locator, type Page } from '@playwright/test';

export class InventoryPage {
  constructor(private readonly page: Page) {}

  async addProduct(name: string): Promise<void> {
    const product = this.product(name);
    await product.getByRole('button', { name: 'Add to cart' }).click();
    await this.expectCartCount(1);
  }

  async expectCartCount(count: number): Promise<void> {
    if (count === 0) {
      await expect(this.cartBadge(), 'El badge debe desaparecer cuando el carrito queda vacío').toHaveCount(0);
      return;
    }
    await expect(this.cartBadge(), 'El badge debe reflejar la cantidad esperada').toHaveText(String(count));
  }

  async openCart(): Promise<void> {
    await this.page.locator('[data-test="shopping-cart-link"]').click();
    await expect(this.page, 'Debe abrir el carrito').toHaveURL(/\/cart\.html$/);
  }

  cartBadge(): Locator {
    return this.page.locator('[data-test="shopping-cart-badge"]');
  }

  private product(name: string): Locator {
    return this.page.locator('[data-test="inventory-item"]').filter({ hasText: name });
  }
}
