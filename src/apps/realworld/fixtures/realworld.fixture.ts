import { test as base } from '@playwright/test';

import { realWorldProfile } from '../config/realworld.profile';
import { uniqueUser, type RealWorldUser } from '../data/realworld-data';
import { ArticlePage } from '../pages/article.page';
import { CommentsPage } from '../pages/comments.page';
import { EditorPage } from '../pages/editor.page';
import { LoginPage } from '../pages/login.page';
import { NavigationPage } from '../pages/navigation.page';
import { RealWorldApiService } from '../services/realworld-api.service';

interface RealWorldFixtures {
  readonly api: RealWorldApiService;
  readonly user: RealWorldUser & { readonly token: string };
  readonly loginPage: LoginPage;
  readonly navigationPage: NavigationPage;
  readonly editorPage: EditorPage;
  readonly articlePage: ArticlePage;
  readonly commentsPage: CommentsPage;
}

if (!realWorldProfile.capabilities.apiDataSetup || !realWorldProfile.capabilities.authentication) {
  throw new Error('RealWorld fixtures require apiDataSetup and authentication capabilities');
}

export const test = base.extend<RealWorldFixtures>({
  api: async ({ request }, use) => {
    await use(new RealWorldApiService(request, realWorldProfile.apiURL!));
  },
  user: async ({ api }, use) => {
    await use(await api.registerUser(uniqueUser()));
  },
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  navigationPage: async ({ page }, use) => { await use(new NavigationPage(page)); },
  editorPage: async ({ page }, use) => { await use(new EditorPage(page)); },
  articlePage: async ({ page }, use) => { await use(new ArticlePage(page)); },
  commentsPage: async ({ page }, use) => { await use(new CommentsPage(page)); },
});

export { expect } from '@playwright/test';
