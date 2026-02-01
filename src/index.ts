/**
 * engram - Cognitive repository for developer memory
 *
 * This package re-exports from two decoupled packages:
 * - @4meta5/semantic-memory: Standalone semantic memory storage
 * - @4meta5/skill-generator: Extract learnings from AI coding sessions
 *
 * @example
 * ```typescript
 * // Memory storage
 * import { createMemoryStore } from 'engram';
 * const store = createMemoryStore({ dbPath: './memory.db' });
 * await store.add('JWT tokens for auth', { topics: ['auth'] });
 *
 * // Skill generation
 * import { generateProjectSkill } from 'engram';
 * const result = await generateProjectSkill('.', './skills');
 * ```
 */

// ============================================================================
// Re-export from @4meta5/semantic-memory
// ============================================================================

export {
  // Core
  MemoryStore,
  createMemoryStore,
  type AddOptions,
  // Types
  type Memory,
  type MemoryMetadata,
  type SearchResult,
  type MemoryStoreConfig,
  type EmbeddingProvider,
  type StorageBackend,
  type StorageStats,
  type RRFConfig,
  type RankedItem,
  type WeightedRanking,
  // Storage backends
  SQLiteBackend,
  // Search
  reciprocalRankFusion,
  weightedRRF,
  hybridSearch,
  type HybridSearchOptions,
  // Embedding providers
  createMockEmbeddingProvider,
  createOpenAIEmbeddingProvider,
  createVoyageEmbeddingProvider,
  // Legacy types (deprecated)
  type Symbol,
  type SymbolKind,
  type Context,
  type ContextSource,
  type IndexStats,
  type EngramConfig,
} from '@4meta5/semantic-memory';

// ============================================================================
// Re-export from @4meta5/skill-generator
// ============================================================================

export {
  // Types
  type ParsedMessage,
  type ToolCall,
  type UnifiedSession,
  type LearningCategory,
  type Learning,
  type SessionSummary,
  type LlmClient,
  type SummarizeOptions,
  type ExtractedPatterns,
  type ToolSequence,
  type ErrorPattern,
  type FileConvention,
  type ProjectPattern,
  type GenerateSkillOptions,
  type GenerateSkillResult,
  type TriggerSignalType,
  type TriggerSignal,
  type TriggerEvaluation,
  type SelfCheckAnswer,
  type QualityCheck,
  type QualityGate,
  type QualityReport,
  type SessionParser,
  type ClaudeCodeSession,
  type OpenClawSession,
  // Parsers
  findClaudeCodeSessions,
  parseClaudeCodeSession,
  claudeToUnified,
  claudeCodeParser,
  getRecentClaudeCodeSessions,
  findOpenClawSessions,
  parseOpenClawSession,
  openclawToUnified,
  openclawParser,
  getSessionStats,
  getRecentOpenClawSessions,
  // Extractors
  extractPatterns,
  matchesWorkspace,
  summarizeSession,
  summarizeSessions,
  // Triggers
  TRIGGER_SIGNALS,
  detectAllSignals,
  SELF_CHECK_QUESTIONS,
  evaluateTrigger,
  evaluateTriggerWithLLM,
  hasObviousSkillContent,
  shouldGenerateSkill,
  createHookHandler,
  generateHookScript,
  HOOK_DOCUMENTATION,
  type HookConfig,
  // Quality
  checkQuality,
  passesAllGates,
  filterByQuality,
  validatePatterns,
  scoreLearnings,
  scorePatterns,
  generateQualityReport,
  getQualityLevel,
  // Generators
  generateSkillMarkdown,
  generateProjectSkill,
  generateProjectSkills,
  optimizeLearning,
  optimizeLearnings,
  generateTriggerConditions,
  generateSearchKeywords,
} from '@4meta5/skill-generator';

// ============================================================================
// Legacy exports for backward compatibility
// ============================================================================

// Re-export MemoryStore as the legacy store interface
import { MemoryStore as SemanticMemoryStore } from '@4meta5/semantic-memory';
import type { EngramConfig as LegacyEngramConfig, Context } from '@4meta5/semantic-memory';

/**
 * @deprecated Use createMemoryStore() from @4meta5/semantic-memory instead
 */
export class LegacyMemoryStore {
  private store: SemanticMemoryStore;

  constructor(config: LegacyEngramConfig) {
    this.store = new SemanticMemoryStore({ dbPath: config.dbPath });
  }

  addContext(context: Context): void {
    this.store.add(context.content, {
      source: context.source,
      file: context.file,
      symbolId: context.symbolId,
      ...context.metadata,
    }, { id: context.id });
  }

  searchContexts(query: string, limit = 10) {
    const results = this.store.searchBM25(query, limit);
    return results.map((r) => ({
      ...r.memory.metadata,
      id: r.memory.id,
      content: r.memory.content,
      source: r.memory.metadata?.source || 'manual',
      timestamp: r.memory.createdAt,
      score: r.score,
    }));
  }

  getStats() {
    const stats = this.store.getStats();
    return {
      files: 0,
      symbols: 0,
      contexts: stats.totalMemories,
    };
  }

  close(): void {
    this.store.close();
  }
}

// Alias for backward compatibility
export { LegacyMemoryStore as MemoryStoreLegacy };
