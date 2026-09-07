export interface RealWorldUser {
  readonly email: string;
  readonly username: string;
  readonly password: string;
  readonly token?: string;
}

export interface ArticleData {
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly tagList: readonly string[];
}

export interface PublishedArticle extends ArticleData {
  readonly slug: string;
  readonly author: { readonly username: string };
}

export function uniqueUser(): RealWorldUser {
  const suffix = uniqueSuffix();
  return {
    email: `tg-${suffix}@example.invalid`,
    username: `tg_${suffix}`,
    password: `Tg!${suffix}Safe`,
  };
}

export function uniqueArticle(prefix = 'TestGenerator demo'): ArticleData {
  const suffix = uniqueSuffix();
  return {
    title: `${prefix} ${suffix}`,
    description: `Synthetic description ${suffix}`,
    body: `Synthetic article content for ${suffix}.`,
    tagList: ['testgenerator-demo'],
  };
}

export function uniqueComment(): string {
  return `Synthetic comment ${uniqueSuffix()}`;
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
