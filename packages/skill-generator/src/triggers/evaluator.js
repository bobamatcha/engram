/**
 * Trigger evaluation for skill generation
 *
 * Evaluates sessions to determine if they warrant skill generation,
 * using signal detection and self-check questions.
 */
import { detectAllSignals } from './signals.js';
/**
 * Self-check questions for forced evaluation
 */
export const SELF_CHECK_QUESTIONS = [
    'What was non-obvious about this that a future agent would benefit from?',
    'What would I wish I had known before starting?',
    'Did I encounter errors with reusable solutions?',
    'Are there project-specific patterns demonstrated here?',
];
/**
 * Evaluate if a session should trigger skill generation
 */
export function evaluateTrigger(sessions, options = {}) {
    const { threshold = 0.5 } = options;
    // Detect signals across all sessions
    const allSignals = [];
    for (const session of sessions) {
        const sessionSignals = detectAllSignals(session);
        allSignals.push(...sessionSignals);
    }
    // Aggregate signals by type
    const signalsByType = new Map();
    for (const signal of allSignals) {
        const existing = signalsByType.get(signal.type) || [];
        existing.push(signal);
        signalsByType.set(signal.type, existing);
    }
    // Calculate aggregate signals (max confidence per type)
    const aggregatedSignals = [];
    for (const [type, signals] of signalsByType) {
        const triggered = signals.some((s) => s.triggered);
        const maxConfidence = Math.max(...signals.map((s) => s.confidence));
        const evidence = signals.find((s) => s.evidence)?.evidence;
        aggregatedSignals.push({
            type: type,
            triggered,
            confidence: maxConfidence,
            evidence,
        });
    }
    // Calculate overall score
    const triggeredSignals = aggregatedSignals.filter((s) => s.triggered);
    const score = triggeredSignals.length > 0
        ? triggeredSignals.reduce((sum, s) => sum + s.confidence, 0) / triggeredSignals.length
        : 0;
    const shouldTrigger = score >= threshold && triggeredSignals.length >= 1;
    return {
        shouldTrigger,
        score,
        signals: aggregatedSignals,
    };
}
/**
 * Evaluate with LLM-based self-check questions
 */
export async function evaluateTriggerWithLLM(sessions, llmClient, options = {}) {
    // First do structural evaluation
    const structuralEval = evaluateTrigger(sessions, options);
    // If already below threshold, skip LLM call
    if (!structuralEval.shouldTrigger && structuralEval.score < 0.3) {
        return structuralEval;
    }
    // Build transcript summary for self-check
    const transcriptSummary = sessions
        .map((s) => {
        const msgSummary = s.messages
            .slice(0, 10)
            .map((m) => `[${m.role}]: ${m.content?.slice(0, 100)}...`)
            .join('\n');
        return `Session ${s.sessionId}:\n${msgSummary}`;
    })
        .join('\n\n')
        .slice(0, 4000);
    // Ask self-check questions
    const prompt = `You are evaluating a coding session to determine if it contains skill-worthy knowledge.

SESSION SUMMARY:
${transcriptSummary}

Answer each question with a brief response (1-2 sentences) and indicate if it contributes to skill generation:

${SELF_CHECK_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Respond in JSON format:
{
  "answers": [
    {"question": "...", "answer": "...", "contributesToSkill": true/false},
    ...
  ]
}`;
    try {
        const response = await llmClient.complete(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const selfCheckAnswers = parsed.answers;
            const contributingAnswers = selfCheckAnswers.filter((a) => a.contributesToSkill);
            // Boost score based on self-check
            const selfCheckBoost = contributingAnswers.length / SELF_CHECK_QUESTIONS.length;
            const adjustedScore = structuralEval.score * 0.6 + selfCheckBoost * 0.4;
            return {
                shouldTrigger: adjustedScore >= (options.threshold ?? 0.5),
                score: adjustedScore,
                signals: structuralEval.signals,
                selfCheckAnswers,
            };
        }
    }
    catch {
        // Fall back to structural evaluation
    }
    return structuralEval;
}
/**
 * Quick check if any session has obvious skill-worthy content
 */
export function hasObviousSkillContent(sessions) {
    for (const session of sessions) {
        // Check for error resolution
        const hasError = session.messages.some((m) => m.content &&
            (/error[:\s]/i.test(m.content) ||
                /failed[:\s]/i.test(m.content) ||
                /exception/i.test(m.content)));
        const hasFix = session.messages.some((m) => m.toolCalls?.some((t) => ['Edit', 'Write', 'edit', 'write'].includes(t.name)));
        if (hasError && hasFix)
            return true;
        // Check for architectural discussion
        const hasArchitectural = session.messages.some((m) => m.content &&
            m.role === 'user' &&
            (/refactor/i.test(m.content) ||
                /restructure/i.test(m.content) ||
                /architecture/i.test(m.content)));
        if (hasArchitectural)
            return true;
    }
    return false;
}
//# sourceMappingURL=evaluator.js.map