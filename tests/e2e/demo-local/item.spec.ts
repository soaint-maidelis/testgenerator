import { uniqueItem } from '../../../src/apps/demo-local/data/demo-local.data';
import { demoUser, test } from '../../../src/apps/demo-local/fixtures/demo-local.fixture';
import type { ItemsPage } from '../../../src/apps/demo-local/pages/items.page';
import type { LoginPage } from '../../../src/apps/demo-local/pages/login.page';

async function signIn(loginPage: LoginPage, itemsPage: ItemsPage): Promise<void> {
  const user = demoUser();
  await loginPage.goto();
  await loginPage.submit(user.email, user.password);
  await itemsPage.expectSignedIn(user.name);
}

test('@smoke @item [DL-ITEM-001] create item persists visible values', async ({ service, loginPage, itemsPage, itemPage }) => {
  test.info().annotations.push({ type: 'caseId', description: 'DL-ITEM-001' });
  const item = uniqueItem();
  await test.step('Given an authenticated user opens create item', async () => { await signIn(loginPage, itemsPage); await itemsPage.openNew(); });
  await test.step('When unique item data is saved', async () => { await itemPage.fill(item); await itemPage.save('POST'); });
  await test.step('Then the created values persist in the detail', async () => { await itemPage.expectItem(item); });
});

test('@item [DL-ITEM-002] edit item persists updated values', async ({ service, loginPage, itemsPage, itemPage }) => {
  test.info().annotations.push({ type: 'caseId', description: 'DL-ITEM-002' });
  const initial = await service.createItem(uniqueItem('Initial item'));
  const updated = uniqueItem('Updated item');
  await test.step('Given an authenticated user opens an existing item', async () => { await signIn(loginPage, itemsPage); await itemPage.goto(initial.id); });
  await test.step('When the item values are edited', async () => { await itemPage.edit(); await itemPage.fill(updated); await itemPage.save('PUT'); });
  await test.step('Then the updated values persist', async () => { await itemPage.expectItem(updated); });
});
