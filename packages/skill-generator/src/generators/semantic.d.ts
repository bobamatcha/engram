/**
 * Semantic optimization for skill descriptions
 *
 * Optimizes skill content for better retrieval:
 * - Include exact error messages
 * - Front-load keywords
 * - Add trigger conditions
 */
import type { Learning, ExtractedPatterns } from '../types.js';
/**
 * Optimize a learning summary for retrieval
 */
export declare function optimizeLearning(learning: Learning): Learning;
/**
 * Optimize all learnings in a collection
 */
export declare function optimizeLearnings(learnings: Learning[]): Learning[];
/**
 * Generate trigger conditions for a learning
 */
export declare function generateTriggerConditions(learning: Learning): string[];
/**
 * Generate search keywords for a skill
 */
export declare function generateSearchKeywords(patterns: ExtractedPatterns, learnings: Learning[]): string[];
//# sourceMappingURL=semantic.d.ts.map