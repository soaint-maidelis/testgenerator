import type { InputAdapter, InputDocument } from './input-adapter.types';

export type InputAdapterRegistry = ReadonlyMap<string, InputAdapter>;

export function createInputAdapterRegistry(adapters: readonly InputAdapter[]): InputAdapterRegistry {
  const registry = new Map<string, InputAdapter>();
  for (const adapter of adapters) {
    if (registry.has(adapter.id)) throw new Error(`Duplicate input adapter id "${adapter.id}"`);
    registry.set(adapter.id, adapter);
  }
  return registry;
}

export function resolveInputAdapter(document: InputDocument, registry: InputAdapterRegistry): InputAdapter {
  const matches = [...registry.values()].filter((adapter) => adapter.canHandle(document));
  if (matches.length !== 1) throw new Error(`Expected one input adapter for "${document.fileName}", found ${matches.length}`);
  return matches[0]!;
}
