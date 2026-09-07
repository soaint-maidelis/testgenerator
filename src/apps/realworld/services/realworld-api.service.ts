import type { APIRequestContext } from '@playwright/test';

import type { ArticleData, RealWorldUser } from '../data/realworld-data';

interface UserResponse {
  readonly user: RealWorldUser & { readonly token: string };
}

interface ArticleResponse {
  readonly article: ArticleData & {
    readonly slug: string;
    readonly author: { readonly username: string };
  };
}

export class RealWorldApiService {
  constructor(
    private readonly request: APIRequestContext,
    private readonly apiURL: string,
  ) {}

  async registerUser(user: RealWorldUser): Promise<RealWorldUser & { readonly token: string }> {
    const response = await this.request.post(`${this.apiURL}/users`, { data: { user } });
    if (!response.ok()) throw new Error(`RealWorld user registration failed with HTTP ${response.status()}`);
    const registered = (await response.json() as UserResponse).user;
    return { ...registered, password: user.password };
  }

  async createArticle(token: string, article: ArticleData): Promise<ArticleResponse['article']> {
    let response = await this.request.post(`${this.apiURL}/articles`, {
      headers: this.authorization(token), data: { article },
    });
    if (response.status() === 401) {
      response = await this.request.post(`${this.apiURL}/articles`, {
        headers: this.authorization(token, 'Bearer'), data: { article },
      });
    }
    if (!response.ok()) throw new Error(`RealWorld article creation failed with HTTP ${response.status()}`);
    return (await response.json() as ArticleResponse).article;
  }

  async getArticle(slug: string): Promise<ArticleResponse['article']> {
    const response = await this.request.get(`${this.apiURL}/articles/${encodeURIComponent(slug)}`);
    if (!response.ok()) throw new Error(`RealWorld article lookup failed with HTTP ${response.status()}`);
    return (await response.json() as ArticleResponse).article;
  }

  async deleteArticle(token: string, slug: string): Promise<void> {
    const url = `${this.apiURL}/articles/${encodeURIComponent(slug)}`;
    let response = await this.request.delete(url, {
      headers: this.authorization(token),
    });
    if (response.status() === 401) {
      response = await this.request.delete(url, { headers: this.authorization(token, 'Bearer') });
    }
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`RealWorld article cleanup failed with HTTP ${response.status()}`);
    }
  }

  private authorization(token: string, scheme: 'Token' | 'Bearer' = 'Token'): Readonly<Record<string, string>> {
    return { Authorization: `${scheme} ${token}` };
  }
}
