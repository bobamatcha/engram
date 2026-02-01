/**
 * @engram/skill-generator
 *
 * Extract learnings from AI coding sessions and generate skills
 *
 * @example
 * ```typescript
 * import { generateProjectSkill, shouldGenerateSkill } from '@engram/skill-generator';
 *
 * // Check if session warrants skill generation
 * const evaluation = shouldGenerateSkill(sessions, { threshold: 0.7 });
 * if (evaluation.shouldTrigger) {
 *   const { skill, qualityReport } = await generateProjectSkill({
 *     workspace: './project',
 *     includeLearnings: true,
 *     llmClient,
 *   });
 * }
 * ```
 */
// Parsers
export { findClaudeCodeSessions, parseClaudeCodeSession, claudeToUnified, claudeCodeParser, getRecentClaudeCodeSessions, } from './parsers/claude-code.js';
export { findOpenClawSessions, parseOpenClawSession, openclawToUnified, openclawParser, getSessionStats, getRecentOpenClawSessions, } from './parsers/openclaw.js';
// Extractors
export { extractPatterns, matchesWorkspace } from './extractors/structural.js';
export { summarizeSession, summarizeSessions } from './extractors/llm.js';
// Triggers
export { TRIGGER_SIGNALS, detectErrorResolution, detectNonObviousDiscovery, detectArchitecturalDecision, detectConventionEstablishment, detectWorkaroundDiscovery, detectAllSignals, } from './triggers/signals.js';
export { SELF_CHECK_QUESTIONS, evaluateTrigger, evaluateTriggerWithLLM, hasObviousSkillContent, } from './triggers/evaluator.js';
export { createHookHandler, generateHookScript, HOOK_DOCUMENTATION, } from './triggers/hooks.js';
// Quality
export { checkReusable, checkNonTrivial, checkSpecific, checkVerified, checkQuality, passesAllGates, filterByQuality, validatePatterns, } from './quality/gates.js';
export { scoreLearnings, scorePatterns, generateQualityReport, getQualityLevel, } from './quality/scoring.js';
// Generators
export { generateSkillMarkdown, generateProjectSkill } from './generators/skill-md.js';
export { optimizeLearning, optimizeLearnings, generateTriggerConditions, generateSearchKeywords, } from './generators/semantic.js';
// Convenience aliases
export { evaluateTrigger as shouldGenerateSkill } from './triggers/evaluator.js';
export { generateProjectSkill as generateProjectSkills } from './generators/skill-md.js';
//# sourceMappingURL=index.js.map