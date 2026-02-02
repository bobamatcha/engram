# Engram MCP Server Plan (Decoupled)

This plan keeps Engram as a standalone CLI/library and adds an optional MCP server wrapper.

## Goals

- Expose Engram memory/search/summarize as MCP tools
- Keep implementation optional and loosely coupled
- No dependency on other tools (skills/scout/etc.)

## Minimal Tool Surface

1) `engram.search`
   - Input: `{ "query": string, "limit"?: number }`
   - Output: `{ results: Array<{ content, score, metadata }> }`

2) `engram.add`
   - Input: `{ "content": string, "topics"?: string[], "source"?: string }`
   - Output: `{ id, createdAt }`

3) `engram.stats`
   - Input: `{}`
   - Output: `{ totalMemories, memoriesWithEmbeddings }`

4) `engram.ingestGit`
   - Input: `{ "workspace"?: string, "days"?: number }`
   - Output: `{ added: boolean, memoryId?: string }`

5) `engram.summarize`
   - Input: `{ "workspace"?: string, "days"?: number, "minConfidence"?: number }`
   - Output: `{ learnings: Array<...> }` (requires `ANTHROPIC_API_KEY`)

## Implementation Sketch

- Create a new package `packages/mcp-server` (optional build target).
- Use MCP stdio server pattern; map each tool to the CLI or directly to library APIs.
- Avoid importing Scout/Skills; only call Engram core libs.

## Decoupling Rules

- No hard dependency on `@4meta5/skills-cli` or `@4meta5/scout`.
- Use environment variables for auth (e.g., `ANTHROPIC_API_KEY`).
- Keep token handling in the caller; do not store secrets.

## Suggested CLI Wiring

- `engram mcp` command starts the MCP server via stdio.
- Document a one-line MCP config snippet for major IDEs.

## Minimal Client Snippet

```json
{
  "command": "node",
  "args": [
    "/absolute/path/to/engram/dist/cli.js",
    "mcp",
    "--workspace",
    "/path/to/project"
  ]
}
```

## Error Contract (Optional)

By default, tool errors are returned as `{ error: "code", message?: "..." }` in the tool result.
If the client prefers a normalized shape, start the server with `--wrap-errors` to return:

```json
{
  "ok": false,
  "error": { "code": "missing_query", "message": "engram.search requires a non-empty query string" }
}
```

## Testing

- Unit test tool handlers with in-memory sqlite (`dbPath: ':memory:'`).
- Integration test with a mock MCP client sending sample tool calls.
