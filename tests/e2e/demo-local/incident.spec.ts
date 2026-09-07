import { uniqueItem } from '../../../src/apps/demo-local/data/demo-local.data';
import { demoUser, expect, test } from '../../../src/apps/demo-local/fixtures/demo-local.fixture';

test('@incident @simulated [DL-INCIDENT-001] controlled DELETE failure creates preview evidence', async ({ service, loginPage, itemsPage, itemPage, page }) => {
  const caseId = 'DL-INCIDENT-001';
  test.info().annotations.push({ type: 'caseId', description: caseId });
  const item = await service.createItem(uniqueItem('Synthetic incident'));
  const user = demoUser();
  const pattern = '**/api/items/*';
  await page.route(pattern, async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'SIMULATED_DEMO_FAILURE' }) });
    } else await route.continue();
  });
  try {
    await test.step('Given an authenticated user opens an existing item', async () => {
      await loginPage.goto(); await loginPage.submit(user.email, user.password); await itemsPage.expectSignedIn(user.name); await itemPage.goto(item.id);
    });
    await test.step('When only item deletion is forced to HTTP 500', async () => {
      const response = await itemPage.delete();
      await test.info().attach('SIMULATED_DEMO_FAILURE', {
        body: Buffer.from(JSON.stringify({ caseId, classification: 'PRODUCT_DEFECT', url: page.url(), browser: test.info().project.name })),
        contentType: 'application/json',
      });
      expect(response.status(), 'SIMULATED_DEMO_FAILURE: synthetic deletion should succeed').toBeLessThan(400);
    });
  } finally {
    await page.unroute(pattern);
    await service.deleteItem(item.id);
  }
});
