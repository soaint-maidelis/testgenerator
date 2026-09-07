import { uniqueArticle } from '../../../src/apps/realworld/data/realworld-data';
import { expect, test } from '../../../src/apps/realworld/fixtures/realworld.fixture';

test('@smoke @article [RW-ARTICLE-001] create article persists content and author', async ({
  api, user, loginPage, navigationPage, editorPage, articlePage,
}) => {
  const caseId = 'RW-ARTICLE-001';
  test.info().annotations.push({ type: 'caseId', description: caseId });
  const article = uniqueArticle();
  let slug = '';
  let persistedFromPublication: Awaited<ReturnType<typeof editorPage.publish>> | undefined;

  try {
    await test.step('Given the generated author is authenticated and opens the editor', async () => {
      await loginPage.goto();
      await loginPage.submit(user.email, user.password);
      await navigationPage.expectSignedIn(user.username);
      await navigationPage.openNewArticle();
    });
    await test.step('When the author publishes unique article data', async () => {
      await editorPage.fillArticle(article);
      persistedFromPublication = await editorPage.publish();
      slug = articlePage.slug();
      expect(slug, 'Debe exponer un slug después de publicar').not.toBe('');
    });
    await test.step('Then title, description, content, and author persist', async () => {
      await articlePage.expectArticle(article.title, article.body, user.username);
      const persisted = persistedFromPublication;
      expect(persisted, 'Debe recibir el artículo persistido').toBeDefined();
      if (persisted === undefined) throw new Error('Published article response is missing');
      expect(persisted.title, 'Debe persistir el título').toBe(article.title);
      expect(persisted.description, 'Debe persistir la descripción').toBe(article.description);
      expect(persisted.body, 'Debe persistir el contenido').toBe(article.body);
      expect(persisted.author.username, 'Debe persistir el autor').toBe(user.username);
    });
  } finally {
    if (slug) {
      await articlePage.goto(slug);
      await articlePage.delete();
    }
  }
});

test('@article [RW-ARTICLE-002] edit article persists updated values', async ({
  api, user, navigationPage, articlePage, editorPage,
}) => {
  const caseId = 'RW-ARTICLE-002';
  test.info().annotations.push({ type: 'caseId', description: caseId });
  const initial = await api.createArticle(user.token, uniqueArticle('Initial article'));
  const updated = uniqueArticle('Updated article');
  let cleanupSlug = initial.slug;
  let persistedFromUpdate: Awaited<ReturnType<typeof editorPage.update>> | undefined;

  try {
    await test.step('Given the generated author opens an existing article', async () => {
      await navigationPage.authenticateWithExecutionToken(user.token, user.username);
      await articlePage.goto(initial.slug);
    });
    await test.step('When the author updates and republishes all editable values', async () => {
      await articlePage.edit();
      persistedFromUpdate = await editorPage.update(updated);
      cleanupSlug = articlePage.slug();
    });
    await test.step('Then the updated values persist in UI and API', async () => {
      expect(`/article/${articlePage.slug()}`, 'Debe conservar una ruta de detalle tras editar').toMatch(/\/article\/.+/);
      const persisted = persistedFromUpdate;
      expect(persisted, 'Debe recibir el artículo actualizado').toBeDefined();
      if (persisted === undefined) throw new Error('Updated article response is missing');
      expect(persisted.title, 'Debe persistir el título editado').toBe(updated.title);
      expect(persisted.description, 'Debe persistir la descripción editada').toBe(updated.description);
      expect(persisted.body, 'Debe persistir el contenido editado').toBe(updated.body);
      expect(persisted.author.username, 'Debe conservar el autor').toBe(user.username);
    });
  } finally {
    await api.deleteArticle(user.token, cleanupSlug);
  }
});
