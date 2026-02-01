/**
 * Structural pattern extraction from session history
 *
 * Analyzes sessions to extract:
 * - File co-edits (files frequently modified together)
 * - Tool sequences (common 3-tool patterns)
 * - Test/build commands
 * - Error patterns and fixes
 */
import type { UnifiedSession, ExtractedPatterns } from '../types.js';
/**
 * Analyze sessions and extract structural patterns
 */
export declare function extractPatterns(sessions: UnifiedSession[]): ExtractedPatterns;
/**
 * Check if a session is primarily working in the target workspace.
 * Uses a heuristic: count file operations in the workspace vs total.
 * Requires >50% of file operations to be in the target workspace.
 */
export declare function matchesWorkspace(session: UnifiedSession, targetPath: string): boolean;
//# sourceMappingURL=structural.d.ts.map