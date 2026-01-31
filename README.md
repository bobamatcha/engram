# engram

> A cognitive repository for developer memory. Indexes code AND context — the *why*, not just the *what*.

## What is this?

**engram** is a local-first memory system for developers and AI coding assistants. It bridges the gap between:
- **What** code does (syntax, structure)
- **Why** it was written (conversations, decisions, intent)

Think of it as a "memory layer" for your codebase — one that understands both code structure and human context.

## Features

- **Hybrid search** — BM25 (keywords) + vector embeddings, fused with RRF
- **Code-aware indexing** — Uses tree-sitter for structural understanding
- **Context linking** — Connect commits to conversations, decisions to diffs
- **Local-first** — SQLite-based, runs on your machine, your data stays yours
- **CLI for AI agents** — Designed to be used by coding assistants

## Installation

```bash
npm install -g engram
# or
pnpm add -g engram
```

## Quick Start

```bash
# Generate a skill from your Claude Code history
engram generate-skill --workspace /path/to/repo --output ./skills

# Ingest Claude Code sessions into memory
engram ingest-claude --days 14

# Search past decisions
engram search "authentication flow"

# Get context for a file
engram context get --file src/auth.ts

# Add context (link a decision to code)
engram context add --file src/auth.ts --note "Switched to JWT per security review 2024-01"
```

## Skill Generation

The killer feature: **automatically generate skills from Claude Code history**.

```bash
engram generate-skill --days 30
```

This analyzes your past sessions and generates a SKILL.md that encodes:

- **File co-edits**: Which files are always changed together
- **Test commands**: How tests are run in this project
- **Build commands**: How to build/compile
- **Common workflows**: Frequent tool sequences
- **Error patterns**: Known issues and their fixes

The generated skill helps future sessions start with project knowledge already loaded.

## For AI Agents

engram is designed to be called by AI coding assistants:

```bash
# JSON output for easy parsing
engram search --json "parse configuration"

# Get context for a file (why it exists, related decisions)
engram context get --file src/auth.ts --json
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    CLI                          │
│              engram <command>                   │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│               Search Layer                      │
│     BM25 + Vector Search → RRF Fusion           │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│              Memory Layer                       │
│   SQLite (symbols, context, embeddings)         │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│             Indexer Layer                       │
│      tree-sitter (code) + NLP (context)         │
└─────────────────────────────────────────────────┘
```

## Why "engram"?

In neuroscience, an **engram** is a hypothetical means by which memories are stored. This project is an attempt to give codebases the same thing — persistent memory of not just what was written, but why.

## Integration with 4meta5/skills

engram includes a skill for Claude Code agents:

```bash
# Copy skill to your skills directory
cp -r node_modules/engram/skills/engram-recall ~/.claude/skills/
```

Or add to your skills config. The skill helps agents recall past decisions before starting new work.

## Status

🚧 **Early development** — Built by [Patch](https://github.com/bobamatcha), an AI, with guidance from [Amar](https://github.com/4meta5).

## Research

This project is based on research into:
- Hybrid search (RRF fusion of BM25 + dense retrieval)
- Repository mapping (tree-sitter, PageRank for code)
- Local-first architectures (SQLite, CRDTs)
- Conversation-artifact reconstruction

See [RESEARCH.md](./RESEARCH.md) for the full analysis.

## License

MIT
