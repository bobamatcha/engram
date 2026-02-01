/**
 * Hybrid search orchestration
 *
 * Combines BM25 full-text search with vector similarity search
 * using Reciprocal Rank Fusion (RRF).
 */

import type { Memory, SearchResult, StorageBackend, EmbeddingProvider } from '../types.js';
import { weightedRRF } from './rrf.js';

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
export async function hybridSearch(
  query: string,
  backend: StorageBackend,
  embeddingProvider?: EmbeddingProvider,
  options: HybridSearchOptions = {}
): Promise<SearchResult[]> {
  const {
    limit = 10,
    bm25Weight = 1.0,
    vectorWeight = 1.0,
    minScore = 0,
  } = options;

  // Get BM25 results
  const bm25Results = backend.searchBM25(query, limit * 2);

  // Get vector results if provider available
  let vectorResults: Array<Memory & { score: number }> = [];
  if (embeddingProvider && backend.searchVector) {
    const queryEmbedding = await embeddingProvider.embed(query);
    vectorResults = backend.searchVector(queryEmbedding, limit * 2);
  }

  // If only BM25, return directly
  if (vectorResults.length === 0) {
    return bm25Results
      .slice(0, limit)
      .filter(r => r.score >= minScore)
      .map(r => ({
        memory: r,
        score: r.score,
        matchType: 'bm25' as const,
      }));
  }

  // If only vector, return directly
  if (bm25Results.length === 0) {
    return vectorResults
      .slice(0, limit)
      .filter(r => r.score >= minScore)
      .map(r => ({
        memory: r,
        score: r.score,
        matchType: 'vector' as const,
      }));
  }

  // Combine with RRF
  const fused = weightedRRF(
    [
      { ranking: bm25Results, weight: bm25Weight },
      { ranking: vectorResults, weight: vectorWeight },
    ],
    (m) => m.id
  );

  return fused
    .slice(0, limit)
    .filter(r => r.score >= minScore)
    .map(r => ({
      memory: r.item,
      score: r.score,
      matchType: 'hybrid' as const,
    }));
}
