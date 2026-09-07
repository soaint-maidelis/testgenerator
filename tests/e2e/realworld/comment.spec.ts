import { uniqueArticle, uniqueComment } from '../../../src/apps/realworld/data/realworld-data';
import { test } from '../../../src/apps/realworld/fixtures/realworld.fixture';

test('@comment [RW-COMMENT-001] create and delete a unique comment', async ({
  api, user, navigationPage, articlePage, commentsPage,
}) => {
  const caseId = 'RW-COMMENT-001';
  test.info().annotations.push({ type: 'caseId', description: caseId });
  const article = await api.createArticle(user.token, uniqueArticle('Comment article'));
  const comment = uniqueComment();

  try {
    await test.step('Given the generated user opens an execution-scoped article', async () => {
      await navigationPage.authenticateWithExecutionToken(user.token, user.username);
      await articlePage.goto(article.slug);
    });
    await test.step('When the user posts a unique comment', async () => {
      await commentsPage.add(comment);
    });
    await test.step('Then the same comment can be deleted', async () => {
      await commentsPage.remove(comment);
    });
  } finally {
    await api.deleteArticle(user.token, article.slug);
  }
});
