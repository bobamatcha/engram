import { describe, it, expect } from 'vitest';
import { extractPatterns, matchesWorkspace } from '../src/extractors/structural.js';
import type { UnifiedSession } from '../src/types.js';

describe('extractPatterns', () => {
  it('should extract file co-edits', () => {
    const sessions: UnifiedSession[] = [
      {
        sessionId: 'test-1',
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            toolCalls: [
              { name: 'Write', input: { path: '/src/index.ts' } },
              { name: 'Edit', input: { path: '/src/types.ts' } },
            ],
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      },
    ];

    const patterns = extractPatterns(sessions);

    expect(patterns.fileCoEdits.size).toBeGreaterThan(0);
  });

  it('should extract tool sequences', () => {
    const sessions: UnifiedSession[] = [
      {
        sessionId: 'test-1',
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            toolCalls: [
              { name: 'Read', input: {} },
              { name: 'Edit', input: {} },
              { name: 'Bash', input: {} },
            ],
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      },
      {
        sessionId: 'test-2',
        messages: [
          {
            id: '2',
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            toolCalls: [
              { name: 'Read', input: {} },
              { name: 'Edit', input: {} },
              { name: 'Bash', input: {} },
            ],
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      },
    ];

    const patterns = extractPatterns(sessions);

    // Should find the repeated sequence
    expect(patterns.toolSequences.some((s) => s.tools.join(' → ') === 'Read → Edit → Bash')).toBe(
      true
    );
  });

  it('should extract test commands', () => {
    const sessions: UnifiedSession[] = [
      {
        sessionId: 'test-1',
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            toolCalls: [{ name: 'Bash', input: { command: 'npm test' } }],
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      },
    ];

    const patterns = extractPatterns(sessions);

    expect(patterns.testCommands).toContain('npm test');
  });

  it('should extract build commands', () => {
    const sessions: UnifiedSession[] = [
      {
        sessionId: 'test-1',
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            toolCalls: [{ name: 'Bash', input: { command: 'npm run build' } }],
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
      },
    ];

    const patterns = extractPatterns(sessions);

    expect(patterns.buildCommands).toContain('npm run build');
  });

  it('should handle empty sessions', () => {
    const patterns = extractPatterns([]);

    expect(patterns.fileCoEdits.size).toBe(0);
    expect(patterns.toolSequences).toEqual([]);
    expect(patterns.testCommands).toEqual([]);
  });
});

describe('matchesWorkspace', () => {
  it('should match session with matching cwd', () => {
    const session: UnifiedSession = {
      sessionId: 'test-1',
      cwd: '/home/user/project',
      messages: [],
      startTime: new Date(),
      endTime: new Date(),
    };

    expect(matchesWorkspace(session, '/home/user/project')).toBe(true);
  });

  it('should match session with cwd that is subdirectory of workspace', () => {
    const session: UnifiedSession = {
      sessionId: 'test-1',
      cwd: '/home/user/project/src',
      messages: [],
      startTime: new Date(),
      endTime: new Date(),
    };

    expect(matchesWorkspace(session, '/home/user/project')).toBe(true);
  });

  it('should not match session with unrelated cwd', () => {
    const session: UnifiedSession = {
      sessionId: 'test-1',
      cwd: '/home/user/other-project',
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          toolCalls: [{ name: 'Read', input: { path: '/home/user/other-project/file.ts' } }],
        },
      ],
      startTime: new Date(),
      endTime: new Date(),
    };

    expect(matchesWorkspace(session, '/home/user/project')).toBe(false);
  });
});
