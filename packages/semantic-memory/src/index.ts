/**
 * @4meta5/semantic-memory
 *
 * Standalone semantic memory storage with hybrid search (BM25 + vector + RRF fusion)
 *
 * @example
 * ```typescript
 * import { createMemoryStore } from '@4meta5/semantic-memory';
 *
 * const store = createMemoryStore({ dbPath: './memory.db' });
 * await store.add('JWT tokens for auth', { topics: ['auth'] });
 * const results = await store.search('authentication');
 * ```
 */

// Core
export { MemoryStore, createMemoryStore, type AddOptions } from './core/memory-store.js';

// Types
export type {
  Memory,
  MemoryMetadata,
  SearchResult,
  MemoryStoreConfig,
  EmbeddingProvider,
  StorageBackend,
  StorageStats,
  RRFConfig,
  RankedItem,
  WeightedRanking,
  // Legacy types (deprecated)
  Symbol,
  SymbolKind,
  Context,
  ContextSource,
  IndexStats,
  EngramConfig,
} from './types.js';

// Storage backends
export { SQLiteBackend } from './storage/sqlite/index.js';

// Search
export { reciprocalRankFusion, weightedRRF } from './search/rrf.js';
export { hybridSearch, type HybridSearchOptions } from './search/hybrid.js';

// Embedding providers
export {
  createMockEmbeddingProvider,
  createOpenAIEmbeddingProvider,
  createVoyageEmbeddingProvider,
} from './embeddings/provider.js';
