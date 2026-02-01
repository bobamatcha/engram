/**
 * Reciprocal Rank Fusion (RRF) for hybrid search
 *
 * Combines results from multiple retrieval methods (BM25, vector, etc.)
 * without needing score normalization.
 *
 * RRF score = sum(1 / (k + rank)) for each ranking
 */
import type { RankedItem, RRFConfig, WeightedRanking } from '../types.js';
/**
 * Fuse multiple ranked lists using Reciprocal Rank Fusion
 *
 * @param rankings - Array of ranked lists, each list is sorted by relevance (best first)
 * @param getId - Function to extract a unique ID from an item
 * @param config - RRF configuration
 * @returns Fused ranking sorted by RRF score (best first)
 */
export declare function reciprocalRankFusion<T>(rankings: T[][], getId: (item: T) => string, config?: RRFConfig): RankedItem<T>[];
/**
 * Weighted RRF - allows different weights for different ranking sources
 *
 * @param rankings - Array of { ranking, weight } objects
 * @param getId - Function to extract a unique ID from an item
 * @param config - RRF configuration
 */
export declare function weightedRRF<T>(rankings: WeightedRanking<T>[], getId: (item: T) => string, config?: RRFConfig): RankedItem<T>[];
//# sourceMappingURL=rrf.d.ts.map