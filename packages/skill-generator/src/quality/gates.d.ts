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
export declare function checkReusable(learning: Learning): QualityCheck;
/**
 * Check if a learning is non-trivial (not just documentation lookup)
 */
export declare function checkNonTrivial(learning: Learning): QualityCheck;
/**
 * Check if a learning is specific (concrete and actionable)
 */
export declare function checkSpecific(learning: Learning): QualityCheck;
/**
 * Check if a learning is verified (actually worked in the session)
 */
export declare function checkVerified(learning: Learning): QualityCheck;
/**
 * Run all quality gates on a learning
 */
export declare function checkQuality(learning: Learning): QualityCheck[];
/**
 * Check if a learning passes all quality gates
 */
export declare function passesAllGates(learning: Learning): boolean;
/**
 * Filter learnings to only those passing quality gates
 */
export declare function filterByQuality(learnings: Learning[], options?: {
    minGatesPassed?: number;
    requiredGates?: QualityGate[];
}): Learning[];
/**
 * Validate extracted patterns against quality criteria
 */
export declare function validatePatterns(patterns: ExtractedPatterns): {
    valid: boolean;
    issues: string[];
};
//# sourceMappingURL=gates.d.ts.map