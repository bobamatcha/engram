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
// Core
export { MemoryStore, createMemoryStore } from './core/memory-store.js';
// Storage backends
export { SQLiteBackend } from './storage/sqlite/index.js';
// Search
export { reciprocalRankFusion, weightedRRF } from './search/rrf.js';
export { hybridSearch } from './search/hybrid.js';
// Embedding providers
export { createMockEmbeddingProvider, createOpenAIEmbeddingProvider, createVoyageEmbeddingProvider, } from './embeddings/provider.js';
//# sourceMappingURL=index.js.map