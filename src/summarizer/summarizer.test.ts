/**
 * Summarizer tests - TDD Phase 1 (RED)
 * 
 * Tests for LLM-based session summarization that extracts
 * structured learnings from coding sessions.
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  summarizeSession, 
  type SessionSummary, 
  type Learning,
  type LearningCategory,
} from './summarizer.js';
import type { UnifiedSession } from '../generators/skill-generator.js';

describe('summarizeSession', () => {
  // Mock session data
  const mockSession: UnifiedSession = {
    sessionId: 'test-session-1',
    cwd: '/Users/test/project',
    startTime: new Date('2026-01-31T10:00:00Z'),
    endTime: new Date('2026-01-31T11:00:00Z'),
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'I need to fix the blog index.json issue',
        timestamp: new Date('2026-01-31T10:00:00Z'),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'I see the problem. When you renamed the post, the index.json still references the old slug.',
        timestamp: new Date('2026-01-31T10:01:00Z'),
        toolCalls: [
          { name: 'Read', input: { path: 'index.json' } },
          { name: 'Edit', input: { path: 'index.json', oldText: 'hello-im-patch', newText: 'hello-im-boba-matcha' } },
        ],
      },
    ],
  };

  it('should extract learnings from a session', async () => {
    // Mock the LLM call
    const mockLlmResponse = {
      learnings: [
        {
          category: 'gotcha' as LearningCategory,
          summary: 'Blog index.json must be updated when posts are renamed',
          detail: 'The blog uses a static index.json file. Renaming a post without updating the index causes 404 errors.',
          files: ['index.json', 'posts/*.md'],
          confidence: 0.95,
        },
      ],
    };

    const result = await summarizeSession(mockSession, {
      llmClient: {
        complete: vi.fn().mockResolvedValue(JSON.stringify(mockLlmResponse)),
      },
    });

    expect(result).toBeDefined();
    expect(result.learnings).toHaveLength(1);
    expect(result.learnings[0].category).toBe('gotcha');
    expect(result.learnings[0].summary).toContain('index.json');
  });

  it('should categorize learnings correctly', async () => {
    const mockLlmResponse = {
      learnings: [
        { category: 'decision', summary: 'Chose SQLite for local storage', confidence: 0.9 },
        { category: 'pattern', summary: 'Using Result<T, E> for error handling', confidence: 0.85 },
        { category: 'gotcha', summary: 'FTS5 not available on all systems', confidence: 0.9 },
        { category: 'convention', summary: 'Tests are colocated with source files', confidence: 0.8 },
        { category: 'context', summary: 'This is a Rust project', confidence: 0.95 },
      ],
    };

    const result = await summarizeSession(mockSession, {
      llmClient: {
        complete: vi.fn().mockResolvedValue(JSON.stringify(mockLlmResponse)),
      },
    });

    expect(result.learnings).toHaveLength(5);
    
    const categories = result.learnings.map(l => l.category);
    expect(categories).toContain('decision');
    expect(categories).toContain('pattern');
    expect(categories).toContain('gotcha');
    expect(categories).toContain('convention');
    expect(categories).toContain('context');
  });

  it('should filter out low-confidence learnings', async () => {
    const mockLlmResponse = {
      learnings: [
        { category: 'gotcha', summary: 'High confidence learning', confidence: 0.9 },
        { category: 'pattern', summary: 'Low confidence learning', confidence: 0.3 },
      ],
    };

    const result = await summarizeSession(mockSession, {
      llmClient: {
        complete: vi.fn().mockResolvedValue(JSON.stringify(mockLlmResponse)),
      },
      minConfidence: 0.5,
    });

    expect(result.learnings).toHaveLength(1);
    expect(result.learnings[0].summary).toBe('High confidence learning');
  });

  it('should include session metadata in summary', async () => {
    const mockLlmResponse = { learnings: [] };

    const result = await summarizeSession(mockSession, {
      llmClient: {
        complete: vi.fn().mockResolvedValue(JSON.stringify(mockLlmResponse)),
      },
    });

    expect(result.sessionId).toBe('test-session-1');
    expect(result.workspace).toBe('/Users/test/project');
    expect(result.startTime).toEqual(mockSession.startTime);
    expect(result.endTime).toEqual(mockSession.endTime);
  });

  it('should handle empty sessions gracefully', async () => {
    const emptySession: UnifiedSession = {
      sessionId: 'empty-session',
      cwd: '/Users/test/project',
      startTime: new Date(),
      endTime: new Date(),
      messages: [],
    };

    const result = await summarizeSession(emptySession, {
      llmClient: {
        complete: vi.fn().mockResolvedValue(JSON.stringify({ learnings: [] })),
      },
    });

    expect(result.learnings).toHaveLength(0);
  });
});
