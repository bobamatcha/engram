/**
 * Parser for Claude Code session history (JSONL format)
 * 
 * Claude Code stores sessions in ~/.claude/projects/<project-hash>/<session-id>.jsonl
 * Each line is a JSON object representing a message or event.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type { Context } from '../types.js';

/** A single entry from Claude Code JSONL */
export interface ClaudeCodeEntry {
  uuid: string;
  parentUuid?: string;
  sessionId: string;
  type: 'user' | 'assistant' | 'system';
  userType?: 'external' | 'internal';
  timestamp: string;
  message: ClaudeCodeMessage;
  cwd?: string;
  gitBranch?: string;
  agentId?: string;
  slug?: string;
}

export interface ClaudeCodeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ClaudeCodeContent[];
  model?: string;
  id?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeCodeContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/** Parsed session with messages */
export interface ClaudeCodeSession {
  sessionId: string;
  projectPath: string;
  /** Working directory (cwd) for the session */
  cwd?: string;
  messages: ParsedMessage[];
  startTime: Date;
  endTime: Date;
}

export interface ParsedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  parentId?: string;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

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
      let content = '';
      const toolCalls: ToolCall[] = [];

      if (typeof entry.message === 'string') {
        content = entry.message;
      } else if (entry.message?.content) {
        if (typeof entry.message.content === 'string') {
          content = entry.message.content;
        } else if (Array.isArray(entry.message.content)) {
          for (const block of entry.message.content) {
            if (block.type === 'text' && block.text) {
              content += block.text + '\n';
            } else if (block.type === 'tool_use' && block.name) {
              toolCalls.push({
                name: block.name,
                input: block.input ?? {},
              });
            }
          }
        }
      }

      if (content.trim() || toolCalls.length > 0) {
        messages.push({
          id: entry.uuid,
          role: entry.type === 'user' ? 'user' : 'assistant',
          content: content.trim(),
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
 * Convert Claude Code sessions to engram Context objects
 */
export function sessionsToContexts(sessions: ClaudeCodeSession[]): Context[] {
  const contexts: Context[] = [];

  for (const session of sessions) {
    // Create a context for each significant exchange
    for (let i = 0; i < session.messages.length; i++) {
      const msg = session.messages[i];
      
      // Skip empty messages
      if (!msg.content && !msg.toolCalls?.length) continue;

      // Look for tool calls that modify files
      const fileEdits = msg.toolCalls?.filter(t => 
        ['Write', 'Edit', 'write_file', 'edit_file'].includes(t.name)
      );

      if (fileEdits && fileEdits.length > 0) {
        // This message modified files - create context linking decision to code
        for (const edit of fileEdits) {
          const file = (edit.input as any).path || (edit.input as any).file_path;
          if (file) {
            contexts.push({
              id: `${msg.id}-${file}`,
              file: file,
              content: msg.content || `Tool: ${edit.name}`,
              source: 'chat',
              timestamp: msg.timestamp.getTime(),
              metadata: {
                sessionId: session.sessionId,
                toolName: edit.name,
              },
            });
          }
        }
      } else if (msg.role === 'user' && msg.content.length > 20) {
        // User messages with substance - these are decisions/requests
        contexts.push({
          id: msg.id,
          content: msg.content,
          source: 'chat',
          timestamp: msg.timestamp.getTime(),
          metadata: {
            sessionId: session.sessionId,
            role: msg.role,
          },
        });
      }
    }
  }

  return contexts;
}

/**
 * Get recent Claude Code context (last N days)
 */
export function getRecentClaudeContext(days = 7): Context[] {
  const sessions = findClaudeCodeSessions();
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  const parsedSessions = sessions
    .map(parseClaudeCodeSession)
    .filter(s => s.endTime.getTime() > cutoff);

  return sessionsToContexts(parsedSessions);
}
