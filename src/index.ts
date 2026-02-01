/**
 * engram - Cognitive repository for developer memory
 * 
 * @module engram
 */

export * from './types.js';
export { MemoryStore } from './memory/store.js';
export { reciprocalRankFusion, weightedRRF } from './search/rrf.js';
export type { RankedItem, RRFConfig } from './search/rrf.js';

// Parsers - Claude Code
export { 
  parseClaudeCodeSession,
  findClaudeCodeSessions,
  sessionsToContexts as claudeSessionsToContexts,
  getRecentClaudeContext,
} from './parsers/claude-code.js';
export type { 
  ClaudeCodeSession, 
  ClaudeCodeEntry,
  ParsedMessage,
} from './parsers/claude-code.js';

// Parsers - OpenClaw
export {
  parseOpenClawSession,
  findOpenClawSessions,
  sessionsToContexts as openclawSessionsToContexts,
  getRecentOpenClawContext,
  getSessionStats,
} from './parsers/openclaw.js';
export type {
  OpenClawSession,
  OpenClawEntry,
  OpenClawMessageEntry,
  ParsedOpenClawMessage,
} from './parsers/openclaw.js';

// Generators
export {
  extractPatterns,
  generateSkill,
  generateProjectSkills,
} from './generators/skill-generator.js';
export type {
  ExtractedPatterns,
  ToolSequence,
  ErrorPattern,
  GenerateSkillOptions,
} from './generators/skill-generator.js';
