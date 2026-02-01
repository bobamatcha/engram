/**
 * Hook integration for automatic skill trigger
 *
 * Provides utilities for integrating with Claude Code hooks
 * to automatically evaluate sessions for skill generation.
 */

import type { UnifiedSession, TriggerEvaluation, LlmClient } from '../types.js';
import { evaluateTrigger, evaluateTriggerWithLLM, hasObviousSkillContent } from './evaluator.js';

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
export function createHookHandler(config: HookConfig = {}) {
  const { threshold = 0.5, useLLM = false, llmClient, onTrigger, onSkip } = config;

  return async (sessions: UnifiedSession[]): Promise<TriggerEvaluation> => {
    // Quick check first
    if (!hasObviousSkillContent(sessions)) {
      const evaluation: TriggerEvaluation = {
        shouldTrigger: false,
        score: 0,
        signals: [],
      };
      onSkip?.(evaluation);
      return evaluation;
    }

    // Full evaluation
    let evaluation: TriggerEvaluation;

    if (useLLM && llmClient) {
      evaluation = await evaluateTriggerWithLLM(sessions, llmClient, { threshold });
    } else {
      evaluation = evaluateTrigger(sessions, { threshold });
    }

    if (evaluation.shouldTrigger) {
      await onTrigger?.(evaluation);
    } else {
      onSkip?.(evaluation);
    }

    return evaluation;
  };
}

/**
 * Generate a shell script for Claude Code hooks
 */
export function generateHookScript(options: {
  workspace?: string;
  days?: number;
  threshold?: number;
}): string {
  const { workspace = '.', days = 7, threshold = 0.5 } = options;

  return `#!/bin/bash
# Skill trigger hook for Claude Code
# Add to .claude/hooks/post-session.sh

# Evaluate session for skill generation
npx engram evaluate-skill \\
  --workspace "${workspace}" \\
  --days ${days} \\
  --threshold ${threshold} \\
  --json

# Check exit code
if [ $? -eq 0 ]; then
  echo "Skill generation triggered"
  npx engram generate-skill --workspace "${workspace}"
fi
`;
}

/**
 * Example hook configuration for CLAUDE.md
 */
export const HOOK_DOCUMENTATION = `
## Automatic Skill Generation

This project uses engram for automatic skill generation. When working on this
codebase, the system will evaluate your sessions and generate skills when:

1. You resolve errors (error → investigation → fix pattern)
2. You make non-obvious discoveries (extended investigation)
3. You make architectural decisions
4. You establish project conventions
5. You discover workarounds

### Hook Setup

Add to \`.claude/hooks/post-session.sh\`:

\`\`\`bash
#!/bin/bash
npx engram evaluate-skill --threshold 0.5 && npx engram generate-skill
\`\`\`

### Manual Generation

\`\`\`bash
# Generate skill from recent sessions
npx engram generate-skill --workspace . --days 7

# Evaluate without generating
npx engram evaluate-skill --workspace . --json
\`\`\`
`;
