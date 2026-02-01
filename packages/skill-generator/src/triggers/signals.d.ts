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
export declare const TRIGGER_SIGNALS: TriggerSignalType[];
/**
 * Detect error resolution patterns
 * Error → investigation → fix pattern
 */
export declare function detectErrorResolution(session: UnifiedSession): TriggerSignal;
/**
 * Detect non-obvious discoveries
 * Long investigation, not in docs
 */
export declare function detectNonObviousDiscovery(session: UnifiedSession): TriggerSignal;
/**
 * Detect architectural decisions
 * Explicit design choice in conversation
 */
export declare function detectArchitecturalDecision(session: UnifiedSession): TriggerSignal;
/**
 * Detect convention establishment
 * Project norm discovered
 */
export declare function detectConventionEstablishment(session: UnifiedSession): TriggerSignal;
/**
 * Detect workaround discoveries
 * Tool/framework limitation bypass
 */
export declare function detectWorkaroundDiscovery(session: UnifiedSession): TriggerSignal;
/**
 * Detect all trigger signals for a session
 */
export declare function detectAllSignals(session: UnifiedSession): TriggerSignal[];
//# sourceMappingURL=signals.d.ts.map