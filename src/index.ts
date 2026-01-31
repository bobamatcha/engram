/**
 * engram - Cognitive repository for developer memory
 * 
 * @module engram
 */

export * from './types.js';
export { MemoryStore } from './memory/store.js';
export { reciprocalRankFusion, weightedRRF } from './search/rrf.js';
export type { RankedItem, RRFConfig } from './search/rrf.js';

// Parsers
export { 
  parseClaudeCodeSession,
  findClaudeCodeSessions,
  sessionsToContexts,
  getRecentClaudeContext,
} from './parsers/claude-code.js';
export type { 
  ClaudeCodeSession, 
  ClaudeCodeEntry,
  ParsedMessage,
} from './parsers/claude-code.js';
