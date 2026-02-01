/**
 * Parser for Claude Code session history (JSONL format)
 *
 * Claude Code stores sessions in ~/.claude/projects/<project-hash>/<session-id>.jsonl
 * Each line is a JSON object representing a message or event.
 */
import type { SessionParser, UnifiedSession, ClaudeCodeSession } from '../types.js';
/**
 * Find all Claude Code session files
 */
export declare function findClaudeCodeSessions(projectPath?: string): string[];
/**
 * Parse a single Claude Code session file
 */
export declare function parseClaudeCodeSession(filePath: string): ClaudeCodeSession;
/**
 * Convert Claude Code session to unified format
 */
export declare function claudeToUnified(session: ClaudeCodeSession): UnifiedSession;
/**
 * Claude Code session parser implementation
 */
export declare const claudeCodeParser: SessionParser<ClaudeCodeSession>;
/**
 * Get recent Claude Code context (last N days)
 */
export declare function getRecentClaudeCodeSessions(days?: number): UnifiedSession[];
//# sourceMappingURL=claude-code.d.ts.map