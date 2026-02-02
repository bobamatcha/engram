---
name: engram-gh-token
description: |
  Use the GitHub CLI token by default when a GitHub API token is required.
  Trigger when running scout or any GitHub API-based discovery without GITHUB_TOKEN.
category: workflow
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Bash
---

# Engram GitHub Token Default

When a command needs `GITHUB_TOKEN`, prefer the GitHub CLI token if available.

## When to Use

- Running `scout discover/clone/validate` or other GitHub API tooling
- Any automation that expects `GITHUB_TOKEN` but it is not set

## Workflow

### Step 1: Check if GITHUB_TOKEN is set

```bash
echo "${GITHUB_TOKEN:-}" | wc -c
```

If empty, use the GitHub CLI token.

### Step 2: Use `gh auth token` as the default

```bash
GITHUB_TOKEN=$(gh auth token) scout discover
```

For one-off commands, prefer inline export to avoid writing secrets:

```bash
GITHUB_TOKEN=$(gh auth token) npx @4meta5/scout scan
```

## Notes

- Do not persist the token to disk unless explicitly requested.
- If `gh` is not authenticated, run `gh auth login` interactively.
