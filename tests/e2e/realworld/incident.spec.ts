import { uniqueArticle } from '../../../src/apps/realworld/data/realworld-data';
import { expect, test } from '../../../src/apps/realworld/fixtures/realworld.fixture';

test('@incident @simulated [RW-INCIDENT-001] controlled DELETE failure creates preview evidence', async ({
  api, user, page, navigationPage, articlePage,
}) => {
  const caseId = 'RW-INCIDENT-001';
  test.info().annotations.push({ type: 'caseId', description: caseId });
  const article = await api.createArticle(user.token, uniqueArticle('Synthetic incident'));
  const deletePattern = '**/api/articles/**';

  await page.route(deletePattern, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'DELETE' && /\/api\/articles\/[^/]+$/.test(pathname)) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'SIMULATED_DEMO_FAILURE' }) });
      return;
    }
    await route.continue();
  });

  try {
    await test.step('Given the generated author opens an execution-scoped article', async () => {
      await navigationPage.authenticateWithExecutionToken(user.token, user.username);
      await articlePage.goto(article.slug);
    });
    await test.step('When only the article DELETE operation is forced to HTTP 500', async () => {
      const responsePromise = page.waitForResponse((response) =>
        response.request().method() === 'DELETE' && /\/api\/articles\/[^/]+$/.test(new URL(response.url()).pathname));
      await articlePage.delete();
      const response = await responsePromise;
      await test.info().attach('SIMULATED_DEMO_FAILURE', {
        body: Buffer.from(JSON.stringify({
          caseId, classification: 'PRODUCT_DEFECT', url: page.url(), browser: test.info().project.name,
        })),
        contentType: 'application/json',
      });
      expect(response.status(), 'SIMULATED_DEMO_FAILURE: la eliminación sintética debía responder exitosamente').toBeLessThan(400);
    });
  } finally {
    await page.unroute(deletePattern);
    await api.deleteArticle(user.token, article.slug);
  }
});
