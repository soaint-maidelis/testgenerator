import { expect, type Page } from '@playwright/test';

interface CheckoutCustomer {
  readonly firstName: string;
  readonly lastName: string;
  readonly postalCode: string;
}

export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async completeInformation(customer: CheckoutCustomer): Promise<void> {
    await this.page.getByPlaceholder('First Name').fill(customer.firstName);
    await this.page.getByPlaceholder('Last Name').fill(customer.lastName);
    await this.page.getByPlaceholder('Zip/Postal Code').fill(customer.postalCode);
    await this.page.getByRole('button', { name: 'Continue' }).click();
    await expect(this.page.getByText('Checkout: Overview', { exact: true }), 'Debe mostrar el resumen de compra').toBeVisible();
  }

  async finish(): Promise<void> {
    await this.page.getByRole('button', { name: 'Finish' }).click();
    await expect(this.page.getByRole('heading', { name: 'Thank you for your order!' }), 'Debe confirmar la compra').toBeVisible();
    await expect(this.page, 'Debe finalizar el checkout').toHaveURL(/checkout-complete\.html$/);
  }
}
