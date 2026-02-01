/**
 * Structural pattern extraction from session history
 *
 * Analyzes sessions to extract:
 * - File co-edits (files frequently modified together)
 * - Tool sequences (common 3-tool patterns)
 * - Test/build commands
 * - Error patterns and fixes
 */

import { resolve } from 'path';
import type {
  UnifiedSession,
  ExtractedPatterns,
  ToolSequence,
  ErrorPattern,
} from '../types.js';

/**
 * Analyze sessions and extract structural patterns
 */
export function extractPatterns(sessions: UnifiedSession[]): ExtractedPatterns {
  const fileCoEdits = new Map<string, string[]>();
  const toolSequences: ToolSequence[] = [];
  const testCommands: string[] = [];
  const buildCommands: string[] = [];
  const errorPatterns: ErrorPattern[] = [];

  // Track tool sequences per session
  const toolSeqCounts = new Map<string, { count: number; context: string }>();

  for (const session of sessions) {
    const filesEditedInSession = new Set<string>();
    const toolsInSession: string[] = [];

    for (const msg of session.messages) {
      // Track file edits
      if (msg.toolCalls) {
        for (const tool of msg.toolCalls) {
          toolsInSession.push(tool.name);
          const toolNameLower = tool.name.toLowerCase();

          // Extract file edits
          if (['write', 'edit', 'write_file', 'edit_file'].includes(toolNameLower)) {
            const file =
              (tool.input as Record<string, unknown>).path ||
              (tool.input as Record<string, unknown>).file_path ||
              (tool.input as Record<string, unknown>).file;
            if (typeof file === 'string') {
              filesEditedInSession.add(normalizeFilePath(file));
            }
          }

          // Extract test commands
          if (['bash', 'exec', 'run_command'].includes(toolNameLower)) {
            const cmd = (tool.input as Record<string, unknown>).command;
            if (typeof cmd === 'string') {
              if (isTestCommand(cmd)) {
                if (!testCommands.includes(cmd)) {
                  testCommands.push(cmd);
                }
              }
              if (isBuildCommand(cmd)) {
                if (!buildCommands.includes(cmd)) {
                  buildCommands.push(cmd);
                }
              }
            }
          }
        }
      }

      // Look for error mentions in content
      if (msg.content && msg.role === 'assistant') {
        const errorMatch = msg.content.match(/error[:\s]+(.{20,100})/i);
        if (errorMatch) {
          // Look for fix in subsequent messages
          const fixIdx = session.messages.indexOf(msg);
          if (fixIdx < session.messages.length - 1) {
            const nextMsg = session.messages[fixIdx + 1];
            if (nextMsg.toolCalls?.length) {
              errorPatterns.push({
                error: errorMatch[1].trim(),
                fix: nextMsg.toolCalls.map((t) => t.name).join(' → '),
                count: 1,
              });
            }
          }
        }
      }
    }

    // Record file co-edits
    const files = Array.from(filesEditedInSession);
    for (const file of files) {
      const others = files.filter((f) => f !== file);
      if (others.length > 0) {
        const existing = fileCoEdits.get(file) || [];
        fileCoEdits.set(file, [...new Set([...existing, ...others])]);
      }
    }

    // Record tool sequences (sliding window of 3)
    for (let i = 0; i < toolsInSession.length - 2; i++) {
      const seq = toolsInSession.slice(i, i + 3).join(' → ');
      const existing = toolSeqCounts.get(seq);
      if (existing) {
        existing.count++;
      } else {
        toolSeqCounts.set(seq, { count: 1, context: 'general' });
      }
    }
  }

  // Convert tool sequences to array
  for (const [seq, data] of toolSeqCounts.entries()) {
    if (data.count >= 2) {
      // Only include repeated sequences
      toolSequences.push({
        tools: seq.split(' → '),
        count: data.count,
        context: data.context,
      });
    }
  }

  // Sort by frequency
  toolSequences.sort((a, b) => b.count - a.count);

  return {
    fileCoEdits,
    toolSequences: toolSequences.slice(0, 10), // Top 10
    testCommands: [...new Set(testCommands)].slice(0, 5),
    buildCommands: [...new Set(buildCommands)].slice(0, 5),
    errorPatterns: dedupeErrors(errorPatterns).slice(0, 5),
    fileConventions: [],
    projectPatterns: [],
  };
}

/**
 * Check if a session is primarily working in the target workspace.
 * Uses a heuristic: count file operations in the workspace vs total.
 * Requires >50% of file operations to be in the target workspace.
 */
export function matchesWorkspace(session: UnifiedSession, targetPath: string): boolean {
  const resolvedTarget = resolve(targetPath);

  // First check session cwd
  if (session.cwd) {
    const resolvedCwd = resolve(session.cwd);
    if (resolvedCwd === resolvedTarget || resolvedCwd.startsWith(resolvedTarget + '/')) {
      return true;
    }
  }

  // Fall back to analyzing file operations
  let inWorkspace = 0;
  let total = 0;

  for (const msg of session.messages) {
    if (!msg.toolCalls) continue;

    for (const tool of msg.toolCalls) {
      // Look for file operations
      if (
        [
          'Write',
          'Edit',
          'Read',
          'write',
          'edit',
          'read',
          'write_file',
          'read_file',
          'edit_file',
        ].includes(tool.name)
      ) {
        const filePath =
          (tool.input as Record<string, unknown>).path ||
          (tool.input as Record<string, unknown>).file_path ||
          (tool.input as Record<string, unknown>).file ||
          (tool.input as Record<string, unknown>).filePath;

        if (typeof filePath === 'string') {
          total++;
          const resolvedFile = resolve(filePath);
          if (resolvedFile.startsWith(resolvedTarget + '/') || resolvedFile === resolvedTarget) {
            inWorkspace++;
          }
        }
      }
    }
  }

  // Require >50% of file operations in workspace, with minimum of 5 operations
  if (total >= 5) {
    return inWorkspace / total > 0.5;
  }

  // If too few file operations, require at least 3 in workspace
  return inWorkspace >= 3;
}

// Helper functions

function normalizeFilePath(path: string): string {
  // Remove absolute path prefix, keep relative
  return path.replace(/^\/[^/]+\/[^/]+\//, '');
}

function isTestCommand(cmd: string): boolean {
  // Skip multi-line commands or very long commands
  if (cmd.includes('\n') || cmd.length > 200) return false;

  const testPatterns = [
    /\btest\b/i,
    /\bvitest\b/i,
    /\bjest\b/i,
    /\bpytest\b/i,
    /cargo test/i,
    /npm run test/i,
    /pnpm test/i,
    /npm test/i,
  ];
  return testPatterns.some((p) => p.test(cmd));
}

function isBuildCommand(cmd: string): boolean {
  // Skip multi-line commands or very long commands
  if (cmd.includes('\n') || cmd.length > 200) return false;

  const buildPatterns = [
    /\bbuild\b/i,
    /\bcompile\b/i,
    /cargo build/i,
    /npm run build/i,
    /pnpm build/i,
    /tsc\b/i,
  ];
  return buildPatterns.some((p) => p.test(cmd));
}

function dedupeErrors(errors: ErrorPattern[]): ErrorPattern[] {
  const seen = new Map<string, ErrorPattern>();
  for (const err of errors) {
    const key = err.error.slice(0, 30);
    const existing = seen.get(key);
    if (existing) {
      existing.count++;
    } else {
      seen.set(key, err);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.count - a.count);
}
