/**
 * Confidence scoring for learnings and skills
 */
import { checkQuality, validatePatterns } from './gates.js';
/**
 * Calculate a quality score for a set of learnings
 */
export function scoreLearnings(learnings) {
    if (learnings.length === 0)
        return 0;
    let totalScore = 0;
    for (const learning of learnings) {
        const checks = checkQuality(learning);
        const passedCount = checks.filter((c) => c.passed).length;
        const gateScore = passedCount / checks.length;
        // Combine gate score with confidence
        const learningScore = gateScore * 0.6 + learning.confidence * 0.4;
        totalScore += learningScore;
    }
    return totalScore / learnings.length;
}
/**
 * Calculate a quality score for extracted patterns
 */
export function scorePatterns(patterns) {
    let score = 0;
    let factors = 0;
    // File co-edits (0-0.25)
    const coEditScore = Math.min(patterns.fileCoEdits.size / 10, 1) * 0.25;
    score += coEditScore;
    factors++;
    // Tool sequences (0-0.25)
    const seqScore = patterns.toolSequences.length > 0
        ? Math.min(patterns.toolSequences.reduce((s, t) => s + t.count, 0) / 20, 1) * 0.25
        : 0;
    score += seqScore;
    factors++;
    // Commands (0-0.25)
    const cmdScore = Math.min((patterns.testCommands.length + patterns.buildCommands.length) / 5, 1) * 0.25;
    score += cmdScore;
    factors++;
    // Error patterns (0-0.25)
    const errorScore = Math.min(patterns.errorPatterns.length / 3, 1) * 0.25;
    score += errorScore;
    factors++;
    return score;
}
/**
 * Generate a quality report for a generated skill
 */
export function generateQualityReport(patterns, learnings = []) {
    const checks = [];
    const recommendations = [];
    // Validate patterns
    const patternValidation = validatePatterns(patterns);
    checks.push({
        gate: 'reusable',
        passed: patternValidation.valid,
        reason: patternValidation.issues.join('; ') || undefined,
    });
    // Check learning quality
    if (learnings.length > 0) {
        const qualityLearnings = learnings.filter((l) => {
            const lChecks = checkQuality(l);
            return lChecks.filter((c) => c.passed).length >= 3;
        });
        checks.push({
            gate: 'non-trivial',
            passed: qualityLearnings.length >= learnings.length * 0.5,
            reason: qualityLearnings.length < learnings.length * 0.5
                ? `Only ${qualityLearnings.length}/${learnings.length} learnings pass quality gates`
                : undefined,
        });
    }
    // Generate recommendations
    if (patterns.fileCoEdits.size < 3) {
        recommendations.push('Work on more files to establish co-edit patterns');
    }
    if (patterns.toolSequences.length < 2) {
        recommendations.push('More sessions needed to identify tool sequence patterns');
    }
    if (patterns.testCommands.length === 0) {
        recommendations.push('Run tests to capture testing patterns');
    }
    if (patterns.errorPatterns.length === 0) {
        recommendations.push('Error resolution patterns help future debugging');
    }
    if (learnings.length === 0) {
        recommendations.push('Enable LLM summarization to extract deeper learnings');
    }
    // Calculate overall score
    const patternScore = scorePatterns(patterns);
    const learningScore = learnings.length > 0 ? scoreLearnings(learnings) : 0;
    const score = learnings.length > 0 ? patternScore * 0.5 + learningScore * 0.5 : patternScore;
    return {
        score,
        checks,
        recommendations,
    };
}
/**
 * Determine skill quality level
 */
export function getQualityLevel(score) {
    if (score >= 0.7)
        return 'high';
    if (score >= 0.4)
        return 'medium';
    return 'low';
}
//# sourceMappingURL=scoring.js.map