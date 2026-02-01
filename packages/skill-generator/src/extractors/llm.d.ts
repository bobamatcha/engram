/**
 * LLM-based learning extraction from session transcripts
 *
 * Uses LLM to analyze session transcripts and extract:
 * - Decisions (architectural/design choices)
 * - Patterns (code patterns and idioms)
 * - Gotchas (things that went wrong and fixes)
 * - Conventions (project-specific norms)
 * - Context (background knowledge)
 */
import type { UnifiedSession, Learning, LearningCategory, SessionSummary, SummarizeOptions } from '../types.js';
/**
 * Summarize a session and extract learnings
 */
export declare function summarizeSession(session: UnifiedSession, options: SummarizeOptions): Promise<SessionSummary>;
/**
 * Summarize multiple sessions and aggregate learnings
 */
export declare function summarizeSessions(sessions: UnifiedSession[], options: SummarizeOptions): Promise<{
    summaries: SessionSummary[];
    allLearnings: Learning[];
    byCategory: Record<LearningCategory, Learning[]>;
}>;
//# sourceMappingURL=llm.d.ts.map