/**
 * Parser for OpenClaw session history (JSONL format)
 *
 * OpenClaw stores sessions in ~/.openclaw/agents/<agentId>/sessions/<session-id>.jsonl
 * Each line is a JSON object representing messages, model changes, or custom events.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type {
  SessionParser,
  UnifiedSession,
  OpenClawSession,
  OpenClawSessionEntry,
  OpenClawModelChange,
  OpenClawMessageEntry,
  ParsedOpenClawMessage,
  OpenClawToolCall,
  ParsedMessage,
} from '../types.js';

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
          const toolCalls: OpenClawToolCall[] = [];

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
 * Convert OpenClaw session to unified format
 */
export function openclawToUnified(session: OpenClawSession): UnifiedSession {
  return {
    sessionId: session.sessionId,
    cwd: session.cwd,
    messages: session.messages.map((m): ParsedMessage => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      toolCalls: m.toolCalls?.map((t) => ({
        id: t.id,
        name: t.name,
        input: t.arguments,
      })),
      parentId: m.parentId,
    })),
    startTime: session.startTime,
    endTime: session.endTime,
  };
}

/**
 * OpenClaw session parser implementation
 */
export const openclawParser: SessionParser<OpenClawSession> = {
  findSessions: findOpenClawSessions,
  parseSession: parseOpenClawSession,
  toUnified: openclawToUnified,
};

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

/**
 * Get recent OpenClaw sessions (last N days)
 */
export function getRecentOpenClawSessions(days = 7, agentId?: string): UnifiedSession[] {
  const sessions = findOpenClawSessions(agentId);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return sessions
    .map(parseOpenClawSession)
    .filter((s) => s.endTime.getTime() > cutoff)
    .map(openclawToUnified);
}
