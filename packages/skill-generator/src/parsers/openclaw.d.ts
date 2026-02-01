/**
 * Parser for OpenClaw session history (JSONL format)
 *
 * OpenClaw stores sessions in ~/.openclaw/agents/<agentId>/sessions/<session-id>.jsonl
 * Each line is a JSON object representing messages, model changes, or custom events.
 */
import type { SessionParser, UnifiedSession, OpenClawSession } from '../types.js';
/**
 * Find all OpenClaw session files
 */
export declare function findOpenClawSessions(agentId?: string): string[];
/**
 * Parse a single OpenClaw session file
 */
export declare function parseOpenClawSession(filePath: string): OpenClawSession;
/**
 * Convert OpenClaw session to unified format
 */
export declare function openclawToUnified(session: OpenClawSession): UnifiedSession;
/**
 * OpenClaw session parser implementation
 */
export declare const openclawParser: SessionParser<OpenClawSession>;
/**
 * Get session summary statistics
 */
export declare function getSessionStats(sessions: OpenClawSession[]): {
    totalSessions: number;
    totalMessages: number;
    totalCost: number;
    byAgent: Record<string, {
        sessions: number;
        messages: number;
        cost: number;
    }>;
};
/**
 * Get recent OpenClaw sessions (last N days)
 */
export declare function getRecentOpenClawSessions(days?: number, agentId?: string): UnifiedSession[];
//# sourceMappingURL=openclaw.d.ts.map