/**
 * Quality gates for skill validation
 *
 * Validates that extracted skills meet quality criteria:
 * - Reusable: Applies beyond this instance
 * - Non-trivial: Not documentation lookup
 * - Specific: Concrete and actionable
 * - Verified: Actually worked in the session
 */

import type { Learning, QualityCheck, QualityGate, ExtractedPatterns } from '../types.js';

/**
 * Check if a learning is reusable (applies beyond this instance)
 */
export function checkReusable(learning: Learning): QualityCheck {
  // Learnings with high confidence and clear patterns are more reusable
  const hasGeneralTerms =
    /always|never|should|must|prefer|avoid|when|if/i.test(learning.summary) ||
    /pattern|convention|approach|method|technique/i.test(learning.summary);

  const isSpecificToInstance =
    /this specific|this particular|in this case only/i.test(learning.summary) ||
    /uuid|[a-f0-9]{8}-[a-f0-9]{4}/i.test(learning.summary);

  const passed = hasGeneralTerms && !isSpecificToInstance && learning.confidence >= 0.6;

  return {
    gate: 'reusable',
    passed,
    reason: passed
      ? undefined
      : isSpecificToInstance
        ? 'Too specific to this instance'
        : 'May not apply to other situations',
  };
}

/**
 * Check if a learning is non-trivial (not just documentation lookup)
 */
export function checkNonTrivial(learning: Learning): QualityCheck {
  const trivialPatterns = [
    /install.*npm/i,
    /run.*command/i,
    /use.*syntax/i,
    /import.*from/i,
    /basic.*setup/i,
    /create.*file/i,
    /standard.*approach/i,
  ];

  const isTrivial = trivialPatterns.some((p) => p.test(learning.summary));
  const hasDepth = learning.detail && learning.detail.length > 50;
  const hasFiles = learning.files && learning.files.length > 0;

  const passed = !isTrivial && (hasDepth || hasFiles || learning.confidence >= 0.8);

  return {
    gate: 'non-trivial',
    passed,
    reason: passed
      ? undefined
      : isTrivial
        ? 'This is standard documentation knowledge'
        : 'Lacks depth or context',
  };
}

/**
 * Check if a learning is specific (concrete and actionable)
 */
export function checkSpecific(learning: Learning): QualityCheck {
  const hasActionableVerb =
    /use|add|remove|change|update|configure|set|enable|disable|call|invoke|wrap/i.test(
      learning.summary
    );

  const hasConcreteDetail =
    learning.detail !== undefined ||
    (learning.files && learning.files.length > 0) ||
    /`[^`]+`/.test(learning.summary); // Has code reference

  const isTooVague =
    /sometimes|maybe|might|could|generally|usually/i.test(learning.summary) &&
    !learning.detail;

  const passed = (hasActionableVerb || hasConcreteDetail) && !isTooVague;

  return {
    gate: 'specific',
    passed,
    reason: passed
      ? undefined
      : isTooVague
        ? 'Too vague - needs concrete examples'
        : 'Lacks actionable guidance',
  };
}

/**
 * Check if a learning is verified (actually worked in the session)
 */
export function checkVerified(learning: Learning): QualityCheck {
  // Higher confidence suggests the pattern was observed working
  // Gotchas with files are likely verified (error was fixed)
  // Patterns without high confidence may be theoretical

  const isVerifiedCategory = learning.category === 'gotcha' || learning.category === 'decision';
  const hasHighConfidence = learning.confidence >= 0.75;
  const hasFiles = learning.files && learning.files.length > 0;

  const passed = (isVerifiedCategory && hasFiles) || hasHighConfidence;

  return {
    gate: 'verified',
    passed,
    reason: passed
      ? undefined
      : 'Could not verify this worked in the session',
  };
}

/**
 * Run all quality gates on a learning
 */
export function checkQuality(learning: Learning): QualityCheck[] {
  return [
    checkReusable(learning),
    checkNonTrivial(learning),
    checkSpecific(learning),
    checkVerified(learning),
  ];
}

/**
 * Check if a learning passes all quality gates
 */
export function passesAllGates(learning: Learning): boolean {
  const checks = checkQuality(learning);
  return checks.every((c) => c.passed);
}

/**
 * Filter learnings to only those passing quality gates
 */
export function filterByQuality(
  learnings: Learning[],
  options: { minGatesPassed?: number; requiredGates?: QualityGate[] } = {}
): Learning[] {
  const { minGatesPassed = 3, requiredGates = [] } = options;

  return learnings.filter((learning) => {
    const checks = checkQuality(learning);
    const passedCount = checks.filter((c) => c.passed).length;

    // Check minimum gates
    if (passedCount < minGatesPassed) return false;

    // Check required gates
    for (const required of requiredGates) {
      const check = checks.find((c) => c.gate === required);
      if (!check?.passed) return false;
    }

    return true;
  });
}

/**
 * Validate extracted patterns against quality criteria
 */
export function validatePatterns(patterns: ExtractedPatterns): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check file co-edits
  if (patterns.fileCoEdits.size === 0) {
    issues.push('No file co-edit patterns detected');
  }

  // Check tool sequences
  if (patterns.toolSequences.length === 0) {
    issues.push('No repeated tool sequences found');
  } else {
    const lowCountSeqs = patterns.toolSequences.filter((s) => s.count < 3);
    if (lowCountSeqs.length === patterns.toolSequences.length) {
      issues.push('Tool sequences have low repetition count');
    }
  }

  // Check commands
  if (patterns.testCommands.length === 0 && patterns.buildCommands.length === 0) {
    issues.push('No test or build commands detected');
  }

  return {
    valid: issues.length <= 1, // Allow 1 issue
    issues,
  };
}
