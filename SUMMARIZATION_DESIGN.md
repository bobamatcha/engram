# Engram Summarization Design

## Problem Statement

From Boba's blog post on Building Engram:

> "Filtering by workspace helped, but I suspect the real value will come from summarization — distilling sessions into learnings rather than indexing every tool call."

Currently:
- **OpenClaw memory_search**: Indexes raw session text with embeddings + FTS5 hybrid search
- **Engram**: Extracts structural patterns (file co-edits, tool sequences, commands)

Neither distills the *meaning* of sessions into reusable learnings.

## Research: SOTA Approaches (2025-2026)

### 1. Mem0 (mem0ai)
Paper: "Building Production-Ready AI Agents with Scalable Long-Term Memory" (arXiv:2504.19413)

**Key insights:**
- **LLM-based fact extraction**: Uses prompts to extract structured facts from conversations
- **Custom extraction prompts**: Domain-specific extraction with few-shot examples
- **Graph memory**: Captures entity relationships (optional Neo4j backend)
- **Consolidation**: Updates/merges memories over time
- **Results**: +26% accuracy over OpenAI Memory, 91% faster, 90% fewer tokens vs full-context

**How it works:**
```python
# After each conversation
memory.add(messages, user_id=user_id)

# Under the hood: LLM extracts facts like
# "User prefers dark mode"
# "User's dog is named Max"
```

### 2. MemGPT / Letta
Paper: "MemGPT: Towards LLMs as Operating Systems" (arXiv:2310.08560)

**Key insights:**
- Virtual context management (OS-inspired memory hierarchy)
- Memory tiers: fast (context) vs slow (external storage)
- Interrupts for control flow
- Focus: managing context *during* conversations

Less relevant for our use case (post-session learning extraction).

### 3. OpenClaw's Approach
Current implementation in `src/memory/`:

- Chunks markdown files and session transcripts
- Embeds chunks with text-embedding-3-small (or local/gemini)
- Hybrid search: vector similarity + FTS5 keyword
- No summarization - relies on semantic search to find relevant raw text

## Proposed Design: Session Summarization for Engram

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        engram                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   Parsers    │   │  Summarizer  │   │   Storage    │        │
│  │              │   │   (NEW)      │   │              │        │
│  │ - Claude Code│──▶│ - Extract    │──▶│ - SQLite DB  │        │
│  │ - OpenClaw   │   │   learnings  │   │ - Embeddings │        │
│  │ - JSONL      │   │ - Categorize │   │ - Full-text  │        │
│  └──────────────┘   │ - Structure  │   └──────────────┘        │
│                     └──────────────┘          │                 │
│                            ▲                  │                 │
│                            │                  ▼                 │
│                     ┌──────────────┐   ┌──────────────┐        │
│                     │  Extraction  │   │    Query     │        │
│                     │   Prompts    │   │   Interface  │        │
│                     │              │   │              │        │
│                     │ - Decisions  │   │ - recall     │        │
│                     │ - Patterns   │   │ - search     │        │
│                     │ - Gotchas    │   │ - context    │        │
│                     │ - Conventions│   └──────────────┘        │
│                     └──────────────┘                           │
├─────────────────────────────────────────────────────────────────┤
│                     Skill Generator                              │
│  (existing, but now powered by summarized learnings)            │
└─────────────────────────────────────────────────────────────────┘
```

### Learning Categories

1. **Decisions** - Architectural and design choices
   - "Chose SQLite over PostgreSQL because this is a local CLI tool"
   - "Used zod for schema validation to get TypeScript inference"

2. **Patterns** - Code patterns and idioms
   - "This project uses the Result<T, E> pattern for error handling"
   - "Tests are colocated with source files (*.test.ts)"

3. **Gotchas** - Things that went wrong and fixes
   - "The FTS5 extension isn't available on all SQLite builds - need fallback"
   - "index.json must be updated when blog posts are renamed"

4. **Conventions** - Project-specific norms
   - "Commit messages use emoji prefixes"
   - "All exports go through index.ts barrel files"

5. **Context** - Background knowledge
   - "This is a Rust project using the 2021 edition"
   - "The API uses REST, not GraphQL"

### Extraction Prompt (Domain-Specific)

```markdown
You are analyzing a coding session transcript. Extract learnings that would help 
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

Example output:
{
  "learnings": [
    {
      "category": "gotcha",
      "summary": "Blog index.json must be updated when posts are renamed",
      "detail": "The blog uses a static index.json file. Renaming a post without updating the index causes 404 errors.",
      "files": ["index.json", "posts/*.md"],
      "confidence": 0.95
    }
  ]
}
```

### CLI Interface

```bash
# Summarize a single session
engram summarize <session-id>

# Summarize all sessions for a workspace (incremental)
engram summarize --workspace ./project

# Recall relevant learnings for current work
engram recall "working with the blog system"
engram recall --workspace ./project --limit 10

# Generate skill from summarized learnings (enhanced)
engram generate-skill --workspace ./project --days 30

# Consolidate learnings (merge duplicates, update confidence)
engram consolidate --workspace ./project

# Export learnings for a project
engram export --workspace ./project --format json
```

### Storage Schema

```sql
CREATE TABLE learnings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workspace TEXT,
  category TEXT NOT NULL,  -- decision, pattern, gotcha, convention, context
  summary TEXT NOT NULL,
  detail TEXT,
  files TEXT,  -- JSON array
  confidence REAL DEFAULT 0.5,
  embedding BLOB,  -- for vector search
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,  -- claude-code, openclaw
  workspace TEXT,
  summarized_at INTEGER,
  message_count INTEGER,
  start_time INTEGER,
  end_time INTEGER
);

-- FTS for keyword search
CREATE VIRTUAL TABLE learnings_fts USING fts5(
  summary, detail, id UNINDEXED
);

-- Index for workspace filtering
CREATE INDEX idx_learnings_workspace ON learnings(workspace);
CREATE INDEX idx_learnings_category ON learnings(category);
```

### Integration with Skill Generator

Current skill generator extracts:
- File co-edits (structural)
- Tool sequences (structural)
- Test/build commands (structural)

Enhanced with summarization:
- Include high-confidence learnings in SKILL.md
- Group learnings by category
- Reference specific files and contexts

Example enhanced SKILL.md output:

```markdown
# myproject Conventions

## Key Decisions
- **SQLite over PostgreSQL**: This is a local CLI tool, no need for server DB
- **Zod for validation**: Gets us TypeScript inference for free

## Patterns
- Result<T, E> pattern for error handling (see `src/result.ts`)
- Colocated tests (`*.test.ts` next to source)

## Gotchas
- FTS5 extension may not be available - always have a fallback
- The blog's `index.json` must be updated when posts are renamed

## Testing
```bash
npm test
npm run test:watch
```
```

### Implementation Phases

**Phase 1: Core Summarizer**
- Add summarize command to CLI
- Implement extraction prompt
- Store learnings in SQLite
- Basic recall query

**Phase 2: Integration**
- Enhance generate-skill to use summarized learnings
- Add consolidation (merge duplicates)
- Incremental summarization (only new sessions)

**Phase 3: Advanced**
- Vector embeddings for semantic search
- Confidence scoring and filtering
- Graph relationships between learnings
- Export/import for sharing

### Cost Considerations

LLM summarization costs tokens. Mitigations:
- Only summarize sessions with significant content (>N messages)
- Cache summaries (only re-summarize if session changed)
- Use smaller model for extraction (gpt-4o-mini)
- Batch sessions to reduce API calls
- Option for local LLM (ollama)

### Comparison: Before vs After

**Before (current engram):**
```
# myproject Conventions

## Files Often Changed Together
- src/index.ts → also check: src/types.ts, tests/index.test.ts

## Common Workflows
- Read → Edit → Bash (used 15x)
```

**After (with summarization):**
```
# myproject Conventions

## Key Decisions
- Chose TypeScript for type safety and better IDE support
- Using vitest over jest for faster test execution

## Gotchas
- The config loader silently fails on malformed YAML - always validate
- index.json must stay in sync with posts/ directory

## Patterns
- All async functions return Promise<Result<T, Error>>
- Error messages include the operation context for debugging

## Files Often Changed Together
- src/index.ts → also check: src/types.ts, tests/index.test.ts
```

## Next Steps

1. Review this design with Amar
2. Prototype the extraction prompt with real session data
3. Implement Phase 1 (core summarizer)
4. Test on garden repos
5. Iterate based on quality of extracted learnings

---

*Research conducted 2026-01-31 by Boba Matcha*
*References: Mem0 (arXiv:2504.19413), MemGPT (arXiv:2310.08560), OpenClaw source*
