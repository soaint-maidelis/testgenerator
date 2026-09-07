import { expect, test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test("@incident @simulated [XL-SD-INCIDENT-001] controlled missing button failure", async ({ session, inventoryPage, page }) => {
  test.info().annotations.push({ type: 'caseId', description: "XL-SD-INCIDENT-001" });
  await test.step('Given an isolated artificial cart state with no external dependency', async () => {
    await page.setContent('<main><h1>Simulated cart</h1><span data-test="shopping-cart-badge">0</span></main>');
  });
  await test.step('When an artificial cart persistence condition is evaluated', async () => {
    await test.info().attach('SIMULATED_DEMO_FAILURE', {
      body: Buffer.from(JSON.stringify({ caseId: "XL-SD-INCIDENT-001", classification: 'PRODUCT_DEFECT', url: page.url(), browser: test.info().project.name })),
      contentType: 'application/json',
    });
    await expect(inventoryPage.cartBadge(), 'SIMULATED_DEMO_FAILURE: controlled Excel condition expected one item').toHaveText('1');
  });
});
