/**
 * Hybrid search orchestration
 *
 * Combines BM25 full-text search with vector similarity search
 * using Reciprocal Rank Fusion (RRF).
 */
import type { SearchResult, StorageBackend, EmbeddingProvider } from '../types.js';
export interface HybridSearchOptions {
    /** Maximum results to return */
    limit?: number;
    /** Weight for BM25 results (default: 1.0) */
    bm25Weight?: number;
    /** Weight for vector results (default: 1.0) */
    vectorWeight?: number;
    /** Minimum score threshold (default: 0) */
    minScore?: number;
}
/**
 * Perform hybrid search combining BM25 and vector search
 */
export declare function hybridSearch(query: string, backend: StorageBackend, embeddingProvider?: EmbeddingProvider, options?: HybridSearchOptions): Promise<SearchResult[]>;
//# sourceMappingURL=hybrid.d.ts.map