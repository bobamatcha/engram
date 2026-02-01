import { describe, it, expect } from 'vitest';
import {
  checkReusable,
  checkNonTrivial,
  checkSpecific,
  checkVerified,
  checkQuality,
  passesAllGates,
  filterByQuality,
} from '../src/quality/gates.js';
import { scoreLearnings, getQualityLevel } from '../src/quality/scoring.js';
import type { Learning } from '../src/types.js';

describe('quality gates', () => {
  describe('checkReusable', () => {
    it('should pass for general learnings', () => {
      const learning: Learning = {
        category: 'pattern',
        summary: 'Always use async/await when dealing with promises',
        confidence: 0.8,
      };

      const result = checkReusable(learning);

      expect(result.passed).toBe(true);
    });

    it('should fail for instance-specific learnings', () => {
      const learning: Learning = {
        category: 'context',
        summary: 'In this specific case only, we used uuid abc123',
        confidence: 0.5,
      };

      const result = checkReusable(learning);

      expect(result.passed).toBe(false);
    });
  });

  describe('checkNonTrivial', () => {
    it('should pass for learnings with depth', () => {
      const learning: Learning = {
        category: 'gotcha',
        summary: 'The TypeScript compiler requires explicit return types',
        detail: 'When using generic functions, always specify return types to avoid inference issues',
        files: ['src/utils.ts'],
        confidence: 0.8,
      };

      const result = checkNonTrivial(learning);

      expect(result.passed).toBe(true);
    });

    it('should fail for trivial learnings', () => {
      const learning: Learning = {
        category: 'pattern',
        summary: 'Install packages using npm install',
        confidence: 0.5,
      };

      const result = checkNonTrivial(learning);

      expect(result.passed).toBe(false);
    });
  });

  describe('checkSpecific', () => {
    it('should pass for actionable learnings', () => {
      const learning: Learning = {
        category: 'convention',
        summary: 'Use `const` instead of `let` when variables are not reassigned',
        confidence: 0.8,
      };

      const result = checkSpecific(learning);

      expect(result.passed).toBe(true);
    });

    it('should fail for vague learnings', () => {
      const learning: Learning = {
        category: 'context',
        summary: 'Sometimes things might not work as expected',
        confidence: 0.4,
      };

      const result = checkSpecific(learning);

      expect(result.passed).toBe(false);
    });
  });

  describe('checkVerified', () => {
    it('should pass for high confidence learnings', () => {
      const learning: Learning = {
        category: 'decision',
        summary: 'We chose SQLite for local-first storage',
        confidence: 0.9,
      };

      const result = checkVerified(learning);

      expect(result.passed).toBe(true);
    });

    it('should pass for gotchas with files', () => {
      const learning: Learning = {
        category: 'gotcha',
        summary: 'Import order matters in this file',
        files: ['src/index.ts'],
        confidence: 0.6,
      };

      const result = checkVerified(learning);

      expect(result.passed).toBe(true);
    });
  });

  describe('checkQuality', () => {
    it('should run all gates', () => {
      const learning: Learning = {
        category: 'pattern',
        summary: 'Test learning',
        confidence: 0.5,
      };

      const checks = checkQuality(learning);

      expect(checks.length).toBe(4);
      expect(checks.map((c) => c.gate)).toEqual(['reusable', 'non-trivial', 'specific', 'verified']);
    });
  });

  describe('passesAllGates', () => {
    it('should return true for high-quality learning', () => {
      const learning: Learning = {
        category: 'gotcha',
        summary: 'Always configure the timeout setting before making API calls',
        detail: 'The default timeout is too short for slow networks',
        files: ['src/api.ts'],
        confidence: 0.9,
      };

      expect(passesAllGates(learning)).toBe(true);
    });
  });

  describe('filterByQuality', () => {
    it('should filter learnings by quality', () => {
      const learnings: Learning[] = [
        {
          category: 'gotcha',
          summary: 'High quality learning with detail',
          detail: 'Important context',
          files: ['src/file.ts'],
          confidence: 0.9,
        },
        {
          category: 'context',
          summary: 'Low quality vague learning maybe',
          confidence: 0.3,
        },
      ];

      const filtered = filterByQuality(learnings, { minGatesPassed: 3 });

      expect(filtered.length).toBe(1);
      expect(filtered[0].summary).toContain('High quality');
    });
  });
});

describe('quality scoring', () => {
  describe('scoreLearnings', () => {
    it('should score learnings', () => {
      const learnings: Learning[] = [
        {
          category: 'gotcha',
          summary: 'Always check for null',
          detail: 'Important',
          files: ['src/index.ts'],
          confidence: 0.8,
        },
      ];

      const score = scoreLearnings(learnings);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return 0 for empty learnings', () => {
      expect(scoreLearnings([])).toBe(0);
    });
  });

  describe('getQualityLevel', () => {
    it('should return high for high scores', () => {
      expect(getQualityLevel(0.8)).toBe('high');
    });

    it('should return medium for medium scores', () => {
      expect(getQualityLevel(0.5)).toBe('medium');
    });

    it('should return low for low scores', () => {
      expect(getQualityLevel(0.2)).toBe('low');
    });
  });
});
