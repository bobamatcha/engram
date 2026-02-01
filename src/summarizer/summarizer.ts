/**
 * Session Summarizer - Extract structured learnings from coding sessions
 * 
 * Uses LLM to analyze session transcripts and extract:
 * - Decisions (architectural/design choices)
 * - Patterns (code patterns and idioms)
 * - Gotchas (things that went wrong and fixes)
 * - Conventions (project-specific norms)
 * - Context (background knowledge)
 */

import type { UnifiedSession } from '../generators/skill-generator.js';

/** Learning categories */
export type LearningCategory = 
  | 'decision'   // Architectural/design choices
  | 'pattern'    // Code patterns and idioms
  | 'gotcha'     // Things that went wrong and fixes
  | 'convention' // Project-specific norms
  | 'context';   // Background knowledge

/** A single learning extracted from a session */
export interface Learning {
  category: LearningCategory;
  summary: string;
  detail?: string;
  files?: string[];
  confidence: number;
}

/** Summary of a session */
export interface SessionSummary {
  sessionId: string;
  workspace?: string;
  startTime: Date;
  endTime: Date;
  learnings: Learning[];
}

/** LLM client interface for dependency injection */
export interface LlmClient {
  complete: (prompt: string) => Promise<string>;
}

/** Options for summarization */
export interface SummarizeOptions {
  llmClient: LlmClient;
  minConfidence?: number;
}

/** Raw response from LLM */
interface LlmResponse {
  learnings: Array<{
    category: LearningCategory;
    summary: string;
    detail?: string;
    files?: string[];
    confidence: number;
  }>;
}

/**
 * Build the extraction prompt for the LLM
 */
function buildExtractionPrompt(session: UnifiedSession): string {
  // Format messages into a readable transcript
  const transcript = session.messages
    .map((msg: { role: string; content?: string; toolCalls?: Array<{ name: string; input: unknown }> }) => {
      let text = `[${msg.role.toUpperCase()}]: ${msg.content || ''}`;
      if (msg.toolCalls?.length) {
        const tools = msg.toolCalls.map((t: { name: string; input: unknown }) => `${t.name}(${JSON.stringify(t.input)})`).join(', ');
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
function parseLlmResponse(response: string): LlmResponse {
  try {
    // Try to extract JSON from response (may have markdown wrapper)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { learnings: [] };
    }
    return JSON.parse(jsonMatch[0]) as LlmResponse;
  } catch {
    return { learnings: [] };
  }
}

/**
 * Validate and clean a learning
 */
function validateLearning(raw: any): Learning | null {
  if (!raw || typeof raw !== 'object') return null;
  
  const validCategories: LearningCategory[] = ['decision', 'pattern', 'gotcha', 'convention', 'context'];
  if (!validCategories.includes(raw.category)) return null;
  if (typeof raw.summary !== 'string' || !raw.summary.trim()) return null;
  
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.5;
  
  return {
    category: raw.category as LearningCategory,
    summary: raw.summary.trim(),
    detail: typeof raw.detail === 'string' ? raw.detail.trim() : undefined,
    files: Array.isArray(raw.files) ? raw.files.filter((f: any) => typeof f === 'string') : undefined,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

/**
 * Summarize a session and extract learnings
 */
export async function summarizeSession(
  session: UnifiedSession,
  options: SummarizeOptions,
): Promise<SessionSummary> {
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
    .filter((l): l is Learning => l !== null && l.confidence >= minConfidence);

  return {
    sessionId: session.sessionId,
    workspace: session.cwd,
    startTime: session.startTime,
    endTime: session.endTime,
    learnings,
  };
}
