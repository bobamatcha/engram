/**
 * Reciprocal Rank Fusion (RRF) for hybrid search
 * 
 * Combines results from multiple retrieval methods (BM25, vector, etc.)
 * without needing score normalization.
 * 
 * RRF score = sum(1 / (k + rank)) for each ranking
 */

export interface RankedItem<T> {
  item: T;
  score: number;
}

export interface RRFConfig {
  /** Smoothing constant (default: 60) */
  k: number;
}

const DEFAULT_CONFIG: RRFConfig = {
  k: 60,
};

/**
 * Fuse multiple ranked lists using Reciprocal Rank Fusion
 * 
 * @param rankings - Array of ranked lists, each list is sorted by relevance (best first)
 * @param getId - Function to extract a unique ID from an item
 * @param config - RRF configuration
 * @returns Fused ranking sorted by RRF score (best first)
 */
export function reciprocalRankFusion<T>(
  rankings: T[][],
  getId: (item: T) => string,
  config: RRFConfig = DEFAULT_CONFIG
): RankedItem<T>[] {
  const { k } = config;
  const scores = new Map<string, { item: T; score: number }>();

  // Calculate RRF score for each item across all rankings
  for (const ranking of rankings) {
    for (let rank = 0; rank < ranking.length; rank++) {
      const item = ranking[rank];
      const id = getId(item);
      const rrfScore = 1 / (k + rank + 1);

      const existing = scores.get(id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(id, { item, score: rrfScore });
      }
    }
  }

  // Sort by RRF score (highest first)
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score);
}

/**
 * Weighted RRF - allows different weights for different ranking sources
 * 
 * @param rankings - Array of { ranking, weight } objects
 * @param getId - Function to extract a unique ID from an item
 * @param config - RRF configuration
 */
export function weightedRRF<T>(
  rankings: Array<{ ranking: T[]; weight: number }>,
  getId: (item: T) => string,
  config: RRFConfig = DEFAULT_CONFIG
): RankedItem<T>[] {
  const { k } = config;
  const scores = new Map<string, { item: T; score: number }>();

  for (const { ranking, weight } of rankings) {
    for (let rank = 0; rank < ranking.length; rank++) {
      const item = ranking[rank];
      const id = getId(item);
      const rrfScore = weight / (k + rank + 1);

      const existing = scores.get(id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(id, { item, score: rrfScore });
      }
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score);
}
