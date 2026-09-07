export interface DemoItemInput {
  readonly title: string;
  readonly description: string;
}

export interface DemoItem extends DemoItemInput {
  readonly id: number;
  readonly comments: readonly { readonly id: number; readonly body: string }[];
}

export function demoUser() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return Object.freeze({
    email: `presenter-${suffix}@demo.local`,
    password: `Demo-${suffix}!`,
    name: 'Demo User',
  });
}

export function uniqueItem(prefix = 'Demo item'): DemoItemInput {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { title: `${prefix} ${suffix}`, description: `Deterministic content ${suffix}` };
}

export function uniqueComment(): string {
  return `Demo comment ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
