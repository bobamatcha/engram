import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion, weightedRRF } from '../src/search/rrf.js';

interface TestDoc {
  id: string;
  content: string;
}

describe('Reciprocal Rank Fusion', () => {
  const docs: TestDoc[] = [
    { id: 'a', content: 'apple' },
    { id: 'b', content: 'banana' },
    { id: 'c', content: 'cherry' },
    { id: 'd', content: 'date' },
    { id: 'e', content: 'elderberry' },
  ];

  const getId = (doc: TestDoc) => doc.id;

  it('should combine two rankings with RRF', () => {
    // BM25 ranking: a, b, c
    const bm25 = [docs[0], docs[1], docs[2]];
    // Vector ranking: b, c, d
    const vector = [docs[1], docs[2], docs[3]];

    const fused = reciprocalRankFusion([bm25, vector], getId);

    // b and c appear in both, should rank highest
    expect(fused[0].item.id).toBe('b'); // rank 2 in bm25, rank 1 in vector
    expect(fused[1].item.id).toBe('c'); // rank 3 in bm25, rank 2 in vector
    expect(fused.length).toBe(4); // a, b, c, d
  });

  it('should handle single ranking', () => {
    const ranking = [docs[0], docs[1], docs[2]];
    const fused = reciprocalRankFusion([ranking], getId);

    expect(fused.length).toBe(3);
    expect(fused[0].item.id).toBe('a');
    expect(fused[1].item.id).toBe('b');
    expect(fused[2].item.id).toBe('c');
  });

  it('should handle empty rankings', () => {
    const fused = reciprocalRankFusion([], getId);
    expect(fused.length).toBe(0);
  });

  it('should handle disjoint rankings', () => {
    const ranking1 = [docs[0], docs[1]]; // a, b
    const ranking2 = [docs[2], docs[3]]; // c, d

    const fused = reciprocalRankFusion([ranking1, ranking2], getId);

    expect(fused.length).toBe(4);
    // All items should have similar scores since they each appear in one ranking
  });

  it('should boost items that appear in multiple rankings', () => {
    const ranking1 = [docs[0], docs[1], docs[2]]; // a, b, c
    const ranking2 = [docs[1], docs[0], docs[3]]; // b, a, d

    const fused = reciprocalRankFusion([ranking1, ranking2], getId);

    // Both a and b appear in both rankings
    // a: rank 1 + rank 2 = 1/61 + 1/62
    // b: rank 2 + rank 1 = 1/62 + 1/61
    // They should have equal scores
    const aScore = fused.find(r => r.item.id === 'a')?.score ?? 0;
    const bScore = fused.find(r => r.item.id === 'b')?.score ?? 0;
    expect(aScore).toBeCloseTo(bScore, 10);
  });
});

describe('Weighted RRF', () => {
  const docs: TestDoc[] = [
    { id: 'a', content: 'apple' },
    { id: 'b', content: 'banana' },
    { id: 'c', content: 'cherry' },
  ];

  const getId = (doc: TestDoc) => doc.id;

  it('should apply weights to rankings', () => {
    // BM25 ranking with weight 0.6
    const bm25 = { ranking: [docs[0], docs[1]], weight: 0.6 };
    // Vector ranking with weight 0.4
    const vector = { ranking: [docs[1], docs[2]], weight: 0.4 };

    const fused = weightedRRF([bm25, vector], getId);

    expect(fused.length).toBe(3);
    // b appears in both, should be highest
    expect(fused[0].item.id).toBe('b');
  });

  it('should handle zero weight', () => {
    const ranking1 = { ranking: [docs[0], docs[1]], weight: 1.0 };
    const ranking2 = { ranking: [docs[2]], weight: 0 };

    const fused = weightedRRF([ranking1, ranking2], getId);

    // c should have score 0 due to zero weight
    const cScore = fused.find(r => r.item.id === 'c')?.score ?? -1;
    expect(cScore).toBe(0);
  });
});
