/**
 * Core types for @engram/skill-generator
 */
/** A parsed message from a coding session */
export interface ParsedMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    toolCalls?: ToolCall[];
    parentId?: string;
}
/** A tool call made during a session */
export interface ToolCall {
    id?: string;
    name: string;
    input: Record<string, unknown>;
}
/** Unified session format for cross-platform support */
export interface UnifiedSession {
    sessionId: string;
    cwd?: string;
    messages: ParsedMessage[];
    startTime: Date;
    endTime: Date;
}
/** Learning categories */
export type LearningCategory = 'decision' | 'pattern' | 'gotcha' | 'convention' | 'context';
/** A single learning extracted from a session */
export interface Learning {
    category: LearningCategory;
    summary: string;
    detail?: string;
    files?: string[];
    confidence: number;
}
/** Summary of a session with extracted learnings */
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
/** Patterns extracted from session history */
export interface ExtractedPatterns {
    /** Files that are frequently edited together */
    fileCoEdits: Map<string, string[]>;
    /** Common tool sequences */
    toolSequences: ToolSequence[];
    /** Test commands used */
    testCommands: string[];
    /** Build/lint commands used */
    buildCommands: string[];
    /** Common error patterns and fixes */
    errorPatterns: ErrorPattern[];
    /** File types and their conventions */
    fileConventions: FileConvention[];
    /** Project-specific patterns */
    projectPatterns: ProjectPattern[];
}
/** A repeated tool sequence */
export interface ToolSequence {
    tools: string[];
    count: number;
    context: string;
}
/** An error pattern with fix */
export interface ErrorPattern {
    error: string;
    fix: string;
    count: number;
}
/** Convention for a file type */
export interface FileConvention {
    pattern: string;
    convention: string;
    examples: string[];
}
/** A project-specific pattern */
export interface ProjectPattern {
    name: string;
    description: string;
    trigger: string;
    actions: string[];
}
/** Options for skill generation */
export interface GenerateSkillOptions {
    /** Days of history to analyze */
    days?: number;
    /** Include OpenClaw sessions */
    includeOpenClaw?: boolean;
    /** OpenClaw agent ID filter */
    openclawAgent?: string;
    /** Include LLM-extracted learnings */
    includeLearnings?: boolean;
    /** LLM client for learning extraction */
    llmClient?: LlmClient;
}
/** Result of skill generation */
export interface GenerateSkillResult {
    skillPath: string;
    patterns: ExtractedPatterns;
    sessionCount: number;
    filteredCount: number;
    learnings?: Learning[];
    qualityReport?: QualityReport;
}
/** Trigger signal types */
export type TriggerSignalType = 'error-resolution' | 'non-obvious-discovery' | 'architectural-decision' | 'convention-establishment' | 'workaround-discovery';
/** A detected trigger signal */
export interface TriggerSignal {
    type: TriggerSignalType;
    triggered: boolean;
    confidence: number;
    evidence?: string;
}
/** Result of trigger evaluation */
export interface TriggerEvaluation {
    shouldTrigger: boolean;
    score: number;
    signals: TriggerSignal[];
    selfCheckAnswers?: SelfCheckAnswer[];
}
/** Self-check question and answer */
export interface SelfCheckAnswer {
    question: string;
    answer: string;
    contributesToSkill: boolean;
}
/** Quality gate check result */
export interface QualityCheck {
    gate: QualityGate;
    passed: boolean;
    reason?: string;
}
/** Quality gates for skill validation */
export type QualityGate = 'reusable' | 'non-trivial' | 'specific' | 'verified';
/** Quality report for a generated skill */
export interface QualityReport {
    score: number;
    checks: QualityCheck[];
    recommendations: string[];
}
/** Interface for session parsers */
export interface SessionParser<T> {
    /** Find all session files */
    findSessions(filter?: string): string[];
    /** Parse a single session file */
    parseSession(filePath: string): T;
    /** Convert to unified format */
    toUnified(session: T): UnifiedSession;
}
/** A single entry from Claude Code JSONL */
export interface ClaudeCodeEntry {
    uuid: string;
    parentUuid?: string;
    sessionId: string;
    type: 'user' | 'assistant' | 'system';
    userType?: 'external' | 'internal';
    timestamp: string;
    message: ClaudeCodeMessage;
    cwd?: string;
    gitBranch?: string;
    agentId?: string;
    slug?: string;
}
export interface ClaudeCodeMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | ClaudeCodeContent[];
    model?: string;
    id?: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
}
export interface ClaudeCodeContent {
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    name?: string;
    input?: Record<string, unknown>;
}
/** Parsed Claude Code session */
export interface ClaudeCodeSession {
    sessionId: string;
    projectPath: string;
    cwd?: string;
    messages: ParsedMessage[];
    startTime: Date;
    endTime: Date;
}
/** Entry types in OpenClaw JSONL */
export type OpenClawEntryType = 'session' | 'model_change' | 'thinking_level_change' | 'custom' | 'message';
/** Base entry structure */
export interface OpenClawEntry {
    type: OpenClawEntryType;
    id: string;
    parentId: string | null;
    timestamp: string;
}
/** Session header entry */
export interface OpenClawSessionEntry extends OpenClawEntry {
    type: 'session';
    version: number;
    cwd: string;
}
/** Model change entry */
export interface OpenClawModelChange extends OpenClawEntry {
    type: 'model_change';
    provider: string;
    modelId: string;
}
/** Message entry */
export interface OpenClawMessageEntry extends OpenClawEntry {
    type: 'message';
    message: OpenClawMessage;
    api?: string;
    provider?: string;
    model?: string;
    usage?: OpenClawUsage;
    stopReason?: string;
}
export interface OpenClawMessage {
    role: 'user' | 'assistant' | 'toolResult';
    content: OpenClawContent[];
    timestamp?: number;
    api?: string;
    provider?: string;
    model?: string;
    usage?: OpenClawUsage;
    stopReason?: string;
}
export interface OpenClawContent {
    type: 'text' | 'thinking' | 'toolCall' | 'toolResult';
    text?: string;
    thinking?: string;
    id?: string;
    name?: string;
    arguments?: Record<string, unknown>;
    toolCallId?: string;
    toolName?: string;
    content?: OpenClawContent[];
    isError?: boolean;
}
export interface OpenClawUsage {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
    };
}
/** Parsed OpenClaw session */
export interface OpenClawSession {
    sessionId: string;
    agentId: string;
    filePath: string;
    cwd?: string;
    messages: ParsedOpenClawMessage[];
    startTime: Date;
    endTime: Date;
    totalCost: number;
    model?: string;
}
export interface ParsedOpenClawMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    toolCalls?: OpenClawToolCall[];
    thinking?: string;
    parentId?: string;
    cost?: number;
}
export interface OpenClawToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map