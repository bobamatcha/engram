/**
 * Trigger evaluation for skill generation
 *
 * Evaluates sessions to determine if they warrant skill generation,
 * using signal detection and self-check questions.
 */
import type { UnifiedSession, TriggerEvaluation, LlmClient } from '../types.js';
/**
 * Self-check questions for forced evaluation
 */
export declare const SELF_CHECK_QUESTIONS: string[];
/**
 * Evaluate if a session should trigger skill generation
 */
export declare function evaluateTrigger(sessions: UnifiedSession[], options?: {
    threshold?: number;
}): TriggerEvaluation;
/**
 * Evaluate with LLM-based self-check questions
 */
export declare function evaluateTriggerWithLLM(sessions: UnifiedSession[], llmClient: LlmClient, options?: {
    threshold?: number;
}): Promise<TriggerEvaluation>;
/**
 * Quick check if any session has obvious skill-worthy content
 */
export declare function hasObviousSkillContent(sessions: UnifiedSession[]): boolean;
//# sourceMappingURL=evaluator.d.ts.map