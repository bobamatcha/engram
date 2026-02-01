import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion, weightedRRF } from '../src/search/rrf.js';

interface TestItem {
  id: string;
  value: number;
}

describe('reciprocalRankFusion', () => {
  it('should combine rankings from multiple sources', () => {
    const ranking1: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ];
    const ranking2: TestItem[] = [
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
      { id: 'd', value: 4 },
    ];

    const result = reciprocalRankFusion([ranking1, ranking2], (item) => item.id);

    // 'b' appears in both rankings at good positions
    expect(result[0].item.id).toBe('b');
    expect(result.length).toBe(4); // a, b, c, d
  });

  it('should handle empty rankings', () => {
    const result = reciprocalRankFusion([], (item: TestItem) => item.id);
    expect(result).toEqual([]);
  });

  it('should handle single ranking', () => {
    const ranking: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ];

    const result = reciprocalRankFusion([ranking], (item) => item.id);

    expect(result.length).toBe(2);
    expect(result[0].item.id).toBe('a');
  });

  it('should respect k parameter', () => {
    const ranking1: TestItem[] = [{ id: 'a', value: 1 }];
    const ranking2: TestItem[] = [{ id: 'a', value: 1 }];

    const result1 = reciprocalRankFusion([ranking1, ranking2], (item) => item.id, { k: 60 });
    const result2 = reciprocalRankFusion([ranking1, ranking2], (item) => item.id, { k: 1 });

    // With lower k, the score should be higher for same rank
    expect(result2[0].score).toBeGreaterThan(result1[0].score);
  });
});

describe('weightedRRF', () => {
  it('should apply weights to rankings', () => {
    const ranking1: TestItem[] = [{ id: 'a', value: 1 }];
    const ranking2: TestItem[] = [{ id: 'b', value: 2 }];

    const result = weightedRRF(
      [
        { ranking: ranking1, weight: 2.0 },
        { ranking: ranking2, weight: 1.0 },
      ],
      (item) => item.id
    );

    // 'a' should score higher due to 2x weight
    expect(result[0].item.id).toBe('a');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('should handle equal weights', () => {
    const ranking1: TestItem[] = [{ id: 'a', value: 1 }];
    const ranking2: TestItem[] = [{ id: 'b', value: 2 }];

    const result = weightedRRF(
      [
        { ranking: ranking1, weight: 1.0 },
        { ranking: ranking2, weight: 1.0 },
      ],
      (item) => item.id
    );

    // Should have equal scores for equal positions and weights
    expect(result[0].score).toBe(result[1].score);
  });
});
