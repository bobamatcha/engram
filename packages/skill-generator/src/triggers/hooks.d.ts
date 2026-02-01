/**
 * Hook integration for automatic skill trigger
 *
 * Provides utilities for integrating with Claude Code hooks
 * to automatically evaluate sessions for skill generation.
 */
import type { UnifiedSession, TriggerEvaluation, LlmClient } from '../types.js';
export interface HookConfig {
    /** Minimum score to trigger skill generation */
    threshold?: number;
    /** Use LLM for self-check evaluation */
    useLLM?: boolean;
    /** LLM client for evaluation */
    llmClient?: LlmClient;
    /** Callback when skill generation is triggered */
    onTrigger?: (evaluation: TriggerEvaluation) => void | Promise<void>;
    /** Callback when skill generation is skipped */
    onSkip?: (evaluation: TriggerEvaluation) => void;
}
/**
 * Create a hook handler for session evaluation
 */
export declare function createHookHandler(config?: HookConfig): (sessions: UnifiedSession[]) => Promise<TriggerEvaluation>;
/**
 * Generate a shell script for Claude Code hooks
 */
export declare function generateHookScript(options: {
    workspace?: string;
    days?: number;
    threshold?: number;
}): string;
/**
 * Example hook configuration for CLAUDE.md
 */
export declare const HOOK_DOCUMENTATION = "\n## Automatic Skill Generation\n\nThis project uses engram for automatic skill generation. When working on this\ncodebase, the system will evaluate your sessions and generate skills when:\n\n1. You resolve errors (error \u2192 investigation \u2192 fix pattern)\n2. You make non-obvious discoveries (extended investigation)\n3. You make architectural decisions\n4. You establish project conventions\n5. You discover workarounds\n\n### Hook Setup\n\nAdd to `.claude/hooks/post-session.sh`:\n\n```bash\n#!/bin/bash\nnpx engram evaluate-skill --threshold 0.5 && npx engram generate-skill\n```\n\n### Manual Generation\n\n```bash\n# Generate skill from recent sessions\nnpx engram generate-skill --workspace . --days 7\n\n# Evaluate without generating\nnpx engram evaluate-skill --workspace . --json\n```\n";
//# sourceMappingURL=hooks.d.ts.map