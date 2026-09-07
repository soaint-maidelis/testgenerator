import { selectedProduct, standardUser } from '../../../src/apps/saucedemo/data/saucedemo.data';
import { test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test("@cart [XL-SD-CART-001] add product to cart", async ({ session, loginPage, inventoryPage, cartPage }) => {
  test.info().annotations.push({ type: 'caseId', description: "XL-SD-CART-001" });
  await test.step('Given the standard user is authenticated', async () => { await loginPage.goto(); await loginPage.login(standardUser.username, standardUser.password); await loginPage.expectAccepted(); });
  await test.step('When a product is added and the cart is opened', async () => { await inventoryPage.addProduct(selectedProduct); await inventoryPage.openCart(); });
  await test.step('Then the selected product is present', async () => { await cartPage.expectProduct(selectedProduct); });
});
