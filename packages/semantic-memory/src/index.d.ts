/**
 * @engram/semantic-memory
 *
 * Standalone semantic memory storage with hybrid search (BM25 + vector + RRF fusion)
 *
 * @example
 * ```typescript
 * import { createMemoryStore } from '@engram/semantic-memory';
 *
 * const store = createMemoryStore({ dbPath: './memory.db' });
 * await store.add('JWT tokens for auth', { topics: ['auth'] });
 * const results = await store.search('authentication');
 * ```
 */
export { MemoryStore, createMemoryStore, type AddOptions } from './core/memory-store.js';
export type { Memory, MemoryMetadata, SearchResult, MemoryStoreConfig, EmbeddingProvider, StorageBackend, StorageStats, RRFConfig, RankedItem, WeightedRanking, Symbol, SymbolKind, Context, ContextSource, IndexStats, EngramConfig, } from './types.js';
export { SQLiteBackend } from './storage/sqlite/index.js';
export { reciprocalRankFusion, weightedRRF } from './search/rrf.js';
export { hybridSearch, type HybridSearchOptions } from './search/hybrid.js';
export { createMockEmbeddingProvider, createOpenAIEmbeddingProvider, createVoyageEmbeddingProvider, } from './embeddings/provider.js';
//# sourceMappingURL=index.d.ts.map