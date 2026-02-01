import { describe, it, expect } from 'vitest';
import {
  detectErrorResolution,
  detectNonObviousDiscovery,
  detectArchitecturalDecision,
  detectConventionEstablishment,
  detectWorkaroundDiscovery,
  detectAllSignals,
} from '../src/triggers/signals.js';
import { evaluateTrigger, hasObviousSkillContent } from '../src/triggers/evaluator.js';
import type { UnifiedSession } from '../src/types.js';

describe('trigger signals', () => {
  describe('detectErrorResolution', () => {
    it('should detect error followed by fix', () => {
      const session: UnifiedSession = {
        sessionId: 'test',
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: 'Error: Cannot find module',
            timestamp: new Date(),
          },
          {
            id: '2',
            role: 'assistant',
            content: 'Let me fix that',
            timestamp: new Date(),
            toolCalls: [{ name: 'Edit', input: { path: '/src/index.ts' } }],
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      };

      const signal = detectErrorResolution(session);

      expect(signal.triggered).toBe(true);
      expect(signal.confidence).toBeGreaterThan(0);
    });

    it('should not trigger without fix', () => {
      const session: UnifiedSession = {
        sessionId: 'test',
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: 'Error: Something went wrong',
            timestamp: new Date(),
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      };

      const signal = detectErrorResolution(session);

      expect(signal.triggered).toBe(false);
    });
  });

  describe('detectNonObviousDiscovery', () => {
    it('should detect extensive investigation', () => {
      const session: UnifiedSession = {
        sessionId: 'test',
        messages: Array.from({ length: 15 }, (_, i) => ({
          id: String(i),
          role: 'assistant' as const,
          content: '',
          timestamp: new Date(),
          toolCalls: [
            { name: 'Read', input: {} },
            { name: 'Grep', input: {} },
          ],
        })),
        startTime: new Date(),
        endTime: new Date(),
      };

      const signal = detectNonObviousDiscovery(session);

      expect(signal.triggered).toBe(true);
    });
  });

  describe('detectArchitecturalDecision', () => {
    it('should detect architectural discussion', () => {
      const session: UnifiedSession = {
        sessionId: 'test',
        messages: [
          {
            id: '1',
            role: 'user',
            content: "Let's refactor this to use a better architecture",
            timestamp: new Date(),
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      };

      const signal = detectArchitecturalDecision(session);

      expect(signal.triggered).toBe(true);
    });
  });

  describe('detectConventionEstablishment', () => {
    it('should detect convention discussion', () => {
      const session: UnifiedSession = {
        sessionId: 'test',
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: 'The naming convention should always be consistent with the standard',
            timestamp: new Date(),
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      };

      const signal = detectConventionEstablishment(session);

      expect(signal.triggered).toBe(true);
    });
  });

  describe('detectWorkaroundDiscovery', () => {
    it('should detect workaround discussion', () => {
      const session: UnifiedSession = {
        sessionId: 'test',
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: "Due to a bug in the library, we'll need a workaround",
            timestamp: new Date(),
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      };

      const signal = detectWorkaroundDiscovery(session);

      expect(signal.triggered).toBe(true);
    });
  });

  describe('detectAllSignals', () => {
    it('should return all signal types', () => {
      const session: UnifiedSession = {
        sessionId: 'test',
        messages: [],
        startTime: new Date(),
        endTime: new Date(),
      };

      const signals = detectAllSignals(session);

      expect(signals.length).toBe(5);
      expect(signals.map((s) => s.type)).toEqual([
        'error-resolution',
        'non-obvious-discovery',
        'architectural-decision',
        'convention-establishment',
        'workaround-discovery',
      ]);
    });
  });
});

describe('evaluateTrigger', () => {
  it('should evaluate multiple sessions', () => {
    const sessions: UnifiedSession[] = [
      {
        sessionId: 'test-1',
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: 'Error: Failed to compile',
            timestamp: new Date(),
          },
          {
            id: '2',
            role: 'assistant',
            content: 'Fixed',
            timestamp: new Date(),
            toolCalls: [{ name: 'Edit', input: {} }],
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      },
    ];

    const evaluation = evaluateTrigger(sessions, { threshold: 0.3 });

    expect(evaluation.signals.length).toBe(5);
    expect(typeof evaluation.score).toBe('number');
    expect(typeof evaluation.shouldTrigger).toBe('boolean');
  });

  it('should not trigger for empty sessions', () => {
    const evaluation = evaluateTrigger([], { threshold: 0.5 });

    expect(evaluation.shouldTrigger).toBe(false);
    expect(evaluation.score).toBe(0);
  });
});

describe('hasObviousSkillContent', () => {
  it('should return true for error + fix pattern', () => {
    const sessions: UnifiedSession[] = [
      {
        sessionId: 'test',
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: 'Error: Module not found',
            timestamp: new Date(),
          },
          {
            id: '2',
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            toolCalls: [{ name: 'Edit', input: {} }],
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      },
    ];

    expect(hasObviousSkillContent(sessions)).toBe(true);
  });

  it('should return true for architectural discussion', () => {
    const sessions: UnifiedSession[] = [
      {
        sessionId: 'test',
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Please refactor this component',
            timestamp: new Date(),
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      },
    ];

    expect(hasObviousSkillContent(sessions)).toBe(true);
  });

  it('should return false for simple sessions', () => {
    const sessions: UnifiedSession[] = [
      {
        sessionId: 'test',
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Hello',
            timestamp: new Date(),
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      },
    ];

    expect(hasObviousSkillContent(sessions)).toBe(false);
  });
});
