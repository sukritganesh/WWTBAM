import generatedCatalog from '../generated/catalog.json';
import type { RuntimeContentCatalog, SerializedContentCatalog } from '../types';
import { createRuntimeCatalog } from './createCatalog';

let cachedCatalog: RuntimeContentCatalog | null = null;

function assertGeneratedCatalog(value: unknown): asserts value is SerializedContentCatalog {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Generated content catalog is not an object.');
  }
  const object = value as Record<string, unknown>;
  if (object.schemaVersion !== '1.0.0') throw new Error('Generated content catalog schema is unsupported.');
  if (!Array.isArray(object.questions) || !Array.isArray(object.sets) || !Array.isArray(object.sources)) {
    throw new Error('Generated content catalog is incomplete.');
  }
  if (typeof object.summary !== 'object' || object.summary === null) {
    throw new Error('Generated content catalog has no coverage summary.');
  }
}

export function loadBuiltInCatalog(): RuntimeContentCatalog {
  if (cachedCatalog !== null) return cachedCatalog;
  const serialized: unknown = generatedCatalog;
  assertGeneratedCatalog(serialized);
  cachedCatalog = createRuntimeCatalog(serialized);
  return cachedCatalog;
}

export function clearBuiltInCatalogCacheForTests(): void {
  cachedCatalog = null;
}
