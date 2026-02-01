/**
 * Trigger signal detection for skill generation
 *
 * Detects when a session contains skill-worthy knowledge:
 * - Error resolution patterns
 * - Non-obvious discoveries
 * - Architectural decisions
 * - Convention establishment
 * - Workaround discoveries
 */

import type { UnifiedSession, TriggerSignal, TriggerSignalType } from '../types.js';

/**
 * All trigger signal types
 */
export const TRIGGER_SIGNALS: TriggerSignalType[] = [
  'error-resolution',
  'non-obvious-discovery',
  'architectural-decision',
  'convention-establishment',
  'workaround-discovery',
];

/**
 * Detect error resolution patterns
 * Error → investigation → fix pattern
 */
export function detectErrorResolution(session: UnifiedSession): TriggerSignal {
  let errorCount = 0;
  let fixCount = 0;

  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i];

    // Look for error indicators
    if (msg.content) {
      const hasError =
        /error[:\s]/i.test(msg.content) ||
        /failed[:\s]/i.test(msg.content) ||
        /exception[:\s]/i.test(msg.content) ||
        /traceback/i.test(msg.content);

      if (hasError) {
        errorCount++;

        // Look for subsequent fix (within 3 messages)
        for (let j = i + 1; j < Math.min(i + 4, session.messages.length); j++) {
          const nextMsg = session.messages[j];
          if (nextMsg.toolCalls?.some((t) => ['Edit', 'Write', 'edit', 'write'].includes(t.name))) {
            fixCount++;
            break;
          }
        }
      }
    }
  }

  const triggered = fixCount >= 1;
  const confidence = Math.min(1, fixCount / 3);

  return {
    type: 'error-resolution',
    triggered,
    confidence,
    evidence: triggered ? `Found ${fixCount} error→fix patterns` : undefined,
  };
}

/**
 * Detect non-obvious discoveries
 * Long investigation, not in docs
 */
export function detectNonObviousDiscovery(session: UnifiedSession): TriggerSignal {
  // Estimate investigation time based on message count and tool usage
  const totalMessages = session.messages.length;
  const readCount = session.messages.reduce((count, msg) => {
    return (
      count + (msg.toolCalls?.filter((t) => ['Read', 'read', 'Grep', 'grep'].includes(t.name)).length ?? 0)
    );
  }, 0);

  // Look for investigation patterns
  const hasSearchPattern = session.messages.some(
    (msg) =>
      msg.toolCalls?.some((t) => ['Grep', 'grep', 'Glob', 'glob', 'search'].includes(t.name.toLowerCase()))
  );

  // Estimate: long investigation if many reads and searches
  const triggered = readCount >= 5 && hasSearchPattern && totalMessages >= 10;
  const confidence = Math.min(1, (readCount / 10 + (hasSearchPattern ? 0.3 : 0)) / 1.3);

  return {
    type: 'non-obvious-discovery',
    triggered,
    confidence,
    evidence: triggered
      ? `Investigation with ${readCount} reads and search patterns`
      : undefined,
  };
}

/**
 * Detect architectural decisions
 * Explicit design choice in conversation
 */
export function detectArchitecturalDecision(session: UnifiedSession): TriggerSignal {
  const architecturalKeywords = [
    'architecture',
    'design',
    'pattern',
    'refactor',
    'restructure',
    'migrate',
    'split',
    'extract',
    'decouple',
    'interface',
    'abstract',
    'dependency',
    'module',
    'component',
  ];

  let decisionCount = 0;
  let evidence: string | undefined;

  for (const msg of session.messages) {
    if (msg.role === 'user' && msg.content) {
      const contentLower = msg.content.toLowerCase();
      const hasKeyword = architecturalKeywords.some((k) => contentLower.includes(k));
      const hasDecisionVerb =
        /should (we|i)/i.test(msg.content) ||
        /let's/i.test(msg.content) ||
        /i want to/i.test(msg.content) ||
        /we need to/i.test(msg.content);

      if (hasKeyword && hasDecisionVerb) {
        decisionCount++;
        if (!evidence) {
          evidence = msg.content.slice(0, 100);
        }
      }
    }
  }

  const triggered = decisionCount >= 1;
  const confidence = Math.min(1, decisionCount / 2);

  return {
    type: 'architectural-decision',
    triggered,
    confidence,
    evidence,
  };
}

/**
 * Detect convention establishment
 * Project norm discovered
 */
export function detectConventionEstablishment(session: UnifiedSession): TriggerSignal {
  const conventionKeywords = [
    'convention',
    'naming',
    'style',
    'format',
    'consistent',
    'standard',
    'best practice',
    'always',
    'never',
    'should',
    'must',
    'prefer',
  ];

  let conventionCount = 0;
  let evidence: string | undefined;

  for (const msg of session.messages) {
    if (msg.content) {
      const contentLower = msg.content.toLowerCase();
      const matchCount = conventionKeywords.filter((k) => contentLower.includes(k)).length;

      if (matchCount >= 2) {
        conventionCount++;
        if (!evidence) {
          evidence = msg.content.slice(0, 100);
        }
      }
    }
  }

  const triggered = conventionCount >= 1;
  const confidence = Math.min(1, conventionCount / 3);

  return {
    type: 'convention-establishment',
    triggered,
    confidence,
    evidence,
  };
}

/**
 * Detect workaround discoveries
 * Tool/framework limitation bypass
 */
export function detectWorkaroundDiscovery(session: UnifiedSession): TriggerSignal {
  const workaroundKeywords = [
    'workaround',
    'hack',
    'trick',
    'instead',
    'alternative',
    'bypass',
    "doesn't support",
    "can't use",
    'limitation',
    'bug in',
    'issue with',
  ];

  let workaroundCount = 0;
  let evidence: string | undefined;

  for (const msg of session.messages) {
    if (msg.content) {
      const contentLower = msg.content.toLowerCase();
      const hasWorkaround = workaroundKeywords.some((k) => contentLower.includes(k));

      if (hasWorkaround) {
        workaroundCount++;
        if (!evidence) {
          evidence = msg.content.slice(0, 100);
        }
      }
    }
  }

  const triggered = workaroundCount >= 1;
  const confidence = Math.min(1, workaroundCount / 2);

  return {
    type: 'workaround-discovery',
    triggered,
    confidence,
    evidence,
  };
}

/**
 * Detect all trigger signals for a session
 */
export function detectAllSignals(session: UnifiedSession): TriggerSignal[] {
  return [
    detectErrorResolution(session),
    detectNonObviousDiscovery(session),
    detectArchitecturalDecision(session),
    detectConventionEstablishment(session),
    detectWorkaroundDiscovery(session),
  ];
}
