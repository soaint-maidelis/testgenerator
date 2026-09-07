import { uniqueComment, uniqueItem } from '../../../src/apps/demo-local/data/demo-local.data';
import { demoUser, test } from '../../../src/apps/demo-local/fixtures/demo-local.fixture';

test('@smoke @comment [DL-COMMENT-001] create and delete a unique comment', async ({ service, loginPage, itemsPage, itemPage }) => {
  test.info().annotations.push({ type: 'caseId', description: 'DL-COMMENT-001' });
  const item = await service.createItem(uniqueItem('Comment item'));
  const comment = uniqueComment();
  const user = demoUser();
  await test.step('Given an authenticated user opens an existing item', async () => {
    await loginPage.goto(); await loginPage.submit(user.email, user.password); await itemsPage.expectSignedIn(user.name); await itemPage.goto(item.id);
  });
  await test.step('When a unique comment is added', async () => { await itemPage.addComment(comment); });
  await test.step('Then the same comment can be deleted', async () => { await itemPage.removeComment(comment); });
});
