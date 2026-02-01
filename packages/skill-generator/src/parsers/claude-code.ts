/**
 * Parser for Claude Code session history (JSONL format)
 *
 * Claude Code stores sessions in ~/.claude/projects/<project-hash>/<session-id>.jsonl
 * Each line is a JSON object representing a message or event.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type {
  SessionParser,
  UnifiedSession,
  ClaudeCodeEntry,
  ClaudeCodeSession,
  ParsedMessage,
  ToolCall,
} from '../types.js';

/**
 * Find all Claude Code session files
 */
export function findClaudeCodeSessions(projectPath?: string): string[] {
  const claudeDir = join(homedir(), '.claude', 'projects');
  const sessions: string[] = [];

  try {
    const projects = readdirSync(claudeDir);

    for (const project of projects) {
      const projectDir = join(claudeDir, project);
      if (!statSync(projectDir).isDirectory()) continue;

      // Find main session files (JSONL) - these are the primary sessions
      const files = readdirSync(projectDir);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          // Prioritize main sessions (add them first)
          sessions.unshift(join(projectDir, file));
        }
      }

      // Also check subagents directory
      const subagentsDir = join(projectDir, 'subagents');
      try {
        const subagentFiles = readdirSync(subagentsDir);
        for (const file of subagentFiles) {
          if (file.endsWith('.jsonl')) {
            sessions.push(join(subagentsDir, file));
          }
        }
      } catch {
        // No subagents directory
      }
    }
  } catch {
    // Claude Code not installed or no sessions
  }

  return sessions;
}

/**
 * Parse a single Claude Code session file
 */
export function parseClaudeCodeSession(filePath: string): ClaudeCodeSession {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  const messages: ParsedMessage[] = [];
  let sessionId = '';
  let cwd: string | undefined;
  let startTime = new Date();
  let endTime = new Date();

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as ClaudeCodeEntry;

      if (!sessionId && entry.sessionId) {
        sessionId = entry.sessionId;
      }

      // Extract cwd from first entry that has it
      if (!cwd && entry.cwd) {
        cwd = entry.cwd;
      }

      const timestamp = new Date(entry.timestamp);
      if (messages.length === 0) {
        startTime = timestamp;
      }
      endTime = timestamp;

      // Extract text content
      let textContent = '';
      const toolCalls: ToolCall[] = [];

      if (typeof entry.message === 'string') {
        textContent = entry.message;
      } else if (entry.message?.content) {
        if (typeof entry.message.content === 'string') {
          textContent = entry.message.content;
        } else if (Array.isArray(entry.message.content)) {
          for (const block of entry.message.content) {
            if (block.type === 'text' && block.text) {
              textContent += block.text + '\n';
            } else if (block.type === 'tool_use' && block.name) {
              toolCalls.push({
                name: block.name,
                input: block.input ?? {},
              });
            }
          }
        }
      }

      if (textContent.trim() || toolCalls.length > 0) {
        messages.push({
          id: entry.uuid,
          role: entry.type === 'user' ? 'user' : 'assistant',
          content: textContent.trim(),
          timestamp,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          parentId: entry.parentUuid,
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return {
    sessionId: sessionId || basename(filePath, '.jsonl'),
    cwd,
    projectPath: filePath,
    messages,
    startTime,
    endTime,
  };
}

/**
 * Convert Claude Code session to unified format
 */
export function claudeToUnified(session: ClaudeCodeSession): UnifiedSession {
  return {
    sessionId: session.sessionId,
    cwd: session.cwd,
    messages: session.messages,
    startTime: session.startTime,
    endTime: session.endTime,
  };
}

/**
 * Claude Code session parser implementation
 */
export const claudeCodeParser: SessionParser<ClaudeCodeSession> = {
  findSessions: findClaudeCodeSessions,
  parseSession: parseClaudeCodeSession,
  toUnified: claudeToUnified,
};

/**
 * Get recent Claude Code context (last N days)
 */
export function getRecentClaudeCodeSessions(days = 7): UnifiedSession[] {
  const sessions = findClaudeCodeSessions();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return sessions
    .map(parseClaudeCodeSession)
    .filter((s) => s.endTime.getTime() > cutoff)
    .map(claudeToUnified);
}
