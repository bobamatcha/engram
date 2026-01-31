/**
 * Parser for OpenClaw session history (JSONL format)
 * 
 * OpenClaw stores sessions in ~/.openclaw/agents/<agentId>/sessions/<session-id>.jsonl
 * Each line is a JSON object representing messages, model changes, or custom events.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type { Context } from '../types.js';

/** Entry types in OpenClaw JSONL */
export type OpenClawEntryType = 
  | 'session' 
  | 'model_change' 
  | 'thinking_level_change' 
  | 'custom' 
  | 'message';

/** Base entry structure */
export interface OpenClawEntry {
  type: OpenClawEntryType;
  id: string;
  parentId: string | null;
  timestamp: string;
}

/** Session header entry */
export interface OpenClawSessionEntry extends OpenClawEntry {
  type: 'session';
  version: number;
  cwd: string;
}

/** Model change entry */
export interface OpenClawModelChange extends OpenClawEntry {
  type: 'model_change';
  provider: string;
  modelId: string;
}

/** Message entry */
export interface OpenClawMessageEntry extends OpenClawEntry {
  type: 'message';
  message: OpenClawMessage;
  api?: string;
  provider?: string;
  model?: string;
  usage?: OpenClawUsage;
  stopReason?: string;
}

export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'toolResult';
  content: OpenClawContent[];
  timestamp?: number;
  // Usage is embedded in assistant messages
  api?: string;
  provider?: string;
  model?: string;
  usage?: OpenClawUsage;
  stopReason?: string;
}

export interface OpenClawContent {
  type: 'text' | 'thinking' | 'toolCall' | 'toolResult';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  toolCallId?: string;
  toolName?: string;
  content?: OpenClawContent[];
  isError?: boolean;
}

export interface OpenClawUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

/** Parsed session with messages */
export interface OpenClawSession {
  sessionId: string;
  agentId: string;
  filePath: string;
  cwd?: string;
  messages: ParsedOpenClawMessage[];
  startTime: Date;
  endTime: Date;
  totalCost: number;
  model?: string;
}

export interface ParsedOpenClawMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  thinking?: string;
  parentId?: string;
  cost?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Find all OpenClaw session files
 */
export function findOpenClawSessions(agentId?: string): string[] {
  const openclawDir = join(homedir(), '.openclaw', 'agents');
  const sessions: string[] = [];

  try {
    const agents = agentId ? [agentId] : readdirSync(openclawDir);
    
    for (const agent of agents) {
      const sessionsDir = join(openclawDir, agent, 'sessions');
      
      try {
        if (!statSync(sessionsDir).isDirectory()) continue;
        
        const files = readdirSync(sessionsDir);
        for (const file of files) {
          if (file.endsWith('.jsonl')) {
            sessions.push(join(sessionsDir, file));
          }
        }
      } catch {
        // No sessions directory for this agent
      }
    }
  } catch {
    // OpenClaw not installed or no agents
  }

  return sessions;
}

/**
 * Parse a single OpenClaw session file
 */
export function parseOpenClawSession(filePath: string): OpenClawSession {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  
  const messages: ParsedOpenClawMessage[] = [];
  let sessionId = basename(filePath, '.jsonl');
  let agentId = '';
  let cwd: string | undefined;
  let startTime = new Date();
  let endTime = new Date();
  let totalCost = 0;
  let model: string | undefined;

  // Extract agentId from path (e.g., .../agents/main/sessions/...)
  const pathParts = filePath.split('/');
  const agentsIdx = pathParts.indexOf('agents');
  if (agentsIdx >= 0 && pathParts[agentsIdx + 1]) {
    agentId = pathParts[agentsIdx + 1];
  }

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      
      const timestamp = new Date(entry.timestamp);
      if (messages.length === 0 && entry.type !== 'session') {
        startTime = timestamp;
      }
      endTime = timestamp;

      switch (entry.type) {
        case 'session': {
          const sessionEntry = entry as OpenClawSessionEntry;
          sessionId = sessionEntry.id;
          cwd = sessionEntry.cwd;
          startTime = timestamp;
          break;
        }

        case 'model_change': {
          const modelChange = entry as OpenClawModelChange;
          model = modelChange.modelId;
          break;
        }

        case 'message': {
          const msgEntry = entry as OpenClawMessageEntry;
          const msg = msgEntry.message;
          
          // Skip tool results - they're handled separately
          if (msg.role === 'toolResult') continue;
          
          // Extract text content
          let textContent = '';
          let thinking = '';
          const toolCalls: ToolCall[] = [];

          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === 'text' && block.text) {
                textContent += block.text + '\n';
              } else if (block.type === 'thinking' && block.thinking) {
                thinking = block.thinking;
              } else if (block.type === 'toolCall' && block.name) {
                toolCalls.push({
                  id: block.id ?? '',
                  name: block.name,
                  arguments: block.arguments ?? {},
                });
              }
            }
          }

          // Track cost - usage is inside the message object for assistant messages
          const cost = msg.usage?.cost?.total ?? 0;
          totalCost += cost;

          if (textContent.trim() || toolCalls.length > 0) {
            messages.push({
              id: msgEntry.id,
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: textContent.trim(),
              timestamp,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              thinking: thinking || undefined,
              parentId: msgEntry.parentId ?? undefined,
              cost: cost > 0 ? cost : undefined,
            });
          }
          break;
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  return {
    sessionId,
    agentId,
    filePath,
    cwd,
    messages,
    startTime,
    endTime,
    totalCost,
    model,
  };
}

/**
 * Convert OpenClaw sessions to engram Context objects
 */
export function sessionsToContexts(sessions: OpenClawSession[]): Context[] {
  const contexts: Context[] = [];

  for (const session of sessions) {
    // Create a context for each significant exchange
    for (const msg of session.messages) {
      // Skip empty messages
      if (!msg.content && !msg.toolCalls?.length) continue;

      // Look for tool calls that modify files
      const fileEdits = msg.toolCalls?.filter(t => 
        ['Write', 'Edit', 'write', 'edit'].includes(t.name)
      );

      if (fileEdits && fileEdits.length > 0) {
        // This message modified files - create context linking decision to code
        for (const edit of fileEdits) {
          const file = (edit.arguments as any).path || 
                       (edit.arguments as any).file_path ||
                       (edit.arguments as any).filePath;
          if (file) {
            contexts.push({
              id: `${msg.id}-${file}`,
              file: file,
              content: msg.content || `Tool: ${edit.name}`,
              source: 'chat',
              timestamp: msg.timestamp.getTime(),
              metadata: {
                sessionId: session.sessionId,
                agentId: session.agentId,
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
            agentId: session.agentId,
            role: msg.role,
          },
        });
      } else if (msg.role === 'assistant' && msg.thinking) {
        // Assistant thinking - valuable reasoning context
        contexts.push({
          id: `${msg.id}-thinking`,
          content: msg.thinking,
          source: 'chat',
          timestamp: msg.timestamp.getTime(),
          metadata: {
            sessionId: session.sessionId,
            agentId: session.agentId,
            role: 'thinking',
          },
        });
      }
    }
  }

  return contexts;
}

/**
 * Get recent OpenClaw context (last N days)
 */
export function getRecentOpenClawContext(days = 7, agentId?: string): Context[] {
  const sessions = findOpenClawSessions(agentId);
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  const parsedSessions = sessions
    .map(parseOpenClawSession)
    .filter(s => s.endTime.getTime() > cutoff);

  return sessionsToContexts(parsedSessions);
}

/**
 * Get session summary statistics
 */
export function getSessionStats(sessions: OpenClawSession[]): {
  totalSessions: number;
  totalMessages: number;
  totalCost: number;
  byAgent: Record<string, { sessions: number; messages: number; cost: number }>;
} {
  const byAgent: Record<string, { sessions: number; messages: number; cost: number }> = {};
  
  for (const session of sessions) {
    if (!byAgent[session.agentId]) {
      byAgent[session.agentId] = { sessions: 0, messages: 0, cost: 0 };
    }
    byAgent[session.agentId].sessions++;
    byAgent[session.agentId].messages += session.messages.length;
    byAgent[session.agentId].cost += session.totalCost;
  }

  return {
    totalSessions: sessions.length,
    totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
    totalCost: sessions.reduce((sum, s) => sum + s.totalCost, 0),
    byAgent,
  };
}
