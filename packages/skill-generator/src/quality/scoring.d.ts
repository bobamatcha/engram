/**
 * Confidence scoring for learnings and skills
 */
import type { Learning, ExtractedPatterns, QualityReport } from '../types.js';
/**
 * Calculate a quality score for a set of learnings
 */
export declare function scoreLearnings(learnings: Learning[]): number;
/**
 * Calculate a quality score for extracted patterns
 */
export declare function scorePatterns(patterns: ExtractedPatterns): number;
/**
 * Generate a quality report for a generated skill
 */
export declare function generateQualityReport(patterns: ExtractedPatterns, learnings?: Learning[]): QualityReport;
/**
 * Determine skill quality level
 */
export declare function getQualityLevel(score: number): 'low' | 'medium' | 'high';
//# sourceMappingURL=scoring.d.ts.map