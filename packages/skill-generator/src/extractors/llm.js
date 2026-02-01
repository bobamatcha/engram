/**
 * LLM-based learning extraction from session transcripts
 *
 * Uses LLM to analyze session transcripts and extract:
 * - Decisions (architectural/design choices)
 * - Patterns (code patterns and idioms)
 * - Gotchas (things that went wrong and fixes)
 * - Conventions (project-specific norms)
 * - Context (background knowledge)
 */
/**
 * Build the extraction prompt for the LLM
 */
function buildExtractionPrompt(session) {
    // Format messages into a readable transcript
    const transcript = session.messages
        .map((msg) => {
        let text = `[${msg.role.toUpperCase()}]: ${msg.content || ''}`;
        if (msg.toolCalls?.length) {
            const tools = msg.toolCalls
                .map((t) => `${t.name}(${JSON.stringify(t.input)})`)
                .join(', ');
            text += `\n  Tools: ${tools}`;
        }
        return text;
    })
        .join('\n\n');
    return `You are analyzing a coding session transcript. Extract learnings that would help
a future developer (or AI assistant) work on this codebase.

For each learning, output JSON with:
- category: "decision" | "pattern" | "gotcha" | "convention" | "context"
- summary: One sentence description
- detail: Fuller explanation (optional)
- files: Related files (if any)
- confidence: 0.0-1.0 (how confident this is a real learning vs noise)

Focus on:
1. Architectural decisions and their rationale
2. Code patterns used in this project
3. Bugs encountered and how they were fixed
4. Project conventions discovered
5. Important context about the codebase

Ignore:
- Routine operations (basic git commands, file navigation)
- Debugging output that doesn't lead to insights
- Conversation filler

Respond with JSON only, in this format:
{
  "learnings": [
    {
      "category": "gotcha",
      "summary": "...",
      "detail": "...",
      "files": ["..."],
      "confidence": 0.95
    }
  ]
}

SESSION TRANSCRIPT:
${transcript}

JSON RESPONSE:`;
}
/**
 * Parse LLM response into structured learnings
 */
function parseLlmResponse(response) {
    try {
        // Try to extract JSON from response (may have markdown wrapper)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { learnings: [] };
        }
        return JSON.parse(jsonMatch[0]);
    }
    catch {
        return { learnings: [] };
    }
}
/**
 * Validate and clean a learning
 */
function validateLearning(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const obj = raw;
    const validCategories = [
        'decision',
        'pattern',
        'gotcha',
        'convention',
        'context',
    ];
    if (!validCategories.includes(obj.category))
        return null;
    if (typeof obj.summary !== 'string' || !obj.summary.trim())
        return null;
    const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0.5;
    return {
        category: obj.category,
        summary: obj.summary.trim(),
        detail: typeof obj.detail === 'string' ? obj.detail.trim() : undefined,
        files: Array.isArray(obj.files)
            ? obj.files.filter((f) => typeof f === 'string')
            : undefined,
        confidence: Math.max(0, Math.min(1, confidence)),
    };
}
/**
 * Summarize a session and extract learnings
 */
export async function summarizeSession(session, options) {
    const { llmClient, minConfidence = 0 } = options;
    // Handle empty sessions
    if (!session.messages.length) {
        return {
            sessionId: session.sessionId,
            workspace: session.cwd,
            startTime: session.startTime,
            endTime: session.endTime,
            learnings: [],
        };
    }
    // Build prompt and call LLM
    const prompt = buildExtractionPrompt(session);
    const response = await llmClient.complete(prompt);
    // Parse and validate response
    const parsed = parseLlmResponse(response);
    const learnings = parsed.learnings
        .map(validateLearning)
        .filter((l) => l !== null && l.confidence >= minConfidence);
    return {
        sessionId: session.sessionId,
        workspace: session.cwd,
        startTime: session.startTime,
        endTime: session.endTime,
        learnings,
    };
}
/**
 * Summarize multiple sessions and aggregate learnings
 */
export async function summarizeSessions(sessions, options) {
    const summaries = [];
    const allLearnings = [];
    for (const session of sessions) {
        if (session.messages.length < 3)
            continue; // Skip very short sessions
        const summary = await summarizeSession(session, options);
        summaries.push(summary);
        allLearnings.push(...summary.learnings);
    }
    // Group by category
    const byCategory = {
        decision: [],
        pattern: [],
        gotcha: [],
        convention: [],
        context: [],
    };
    for (const learning of allLearnings) {
        byCategory[learning.category].push(learning);
    }
    return { summaries, allLearnings, byCategory };
}
//# sourceMappingURL=llm.js.map