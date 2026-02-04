# Engram Hook Recipes

These recipes are opt-in and decoupled. They only call the `engram` CLI.

## Recipe A: Lightweight skill refresh (no LLM)

Use this after a session to keep skills current without summarization.

1) Create a hook script:

```bash
mkdir -p .claude/hooks
cat <<'SH' > .claude/hooks/engram-generate-skill.sh
#!/usr/bin/env bash
set -euo pipefail

# Generate a project skill from recent sessions
npx -y @4meta5/engram generate-skill --workspace . --days 30 --output ./generated-skills >/dev/null
SH
chmod +x .claude/hooks/engram-generate-skill.sh
```

2) Wire it into Claude Code hooks (project-level):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": ".claude/hooks/engram-generate-skill.sh" }
        ]
      }
    ]
  }
}
```

## Recipe B: Summarize sessions into learnings (LLM required)

This uses the `engram summarize` command and requires Claude Code OAuth (sign into Claude Code first).

```bash
mkdir -p .claude/hooks
cat <<'SH' > .claude/hooks/engram-summarize.sh
#!/usr/bin/env bash
set -euo pipefail

npx -y @4meta5/engram summarize --workspace . --days 7 --min-confidence 0.6 >/dev/null
SH
chmod +x .claude/hooks/engram-summarize.sh
```

## Notes

- These hooks are intended to be safe and optional.
- Keep hook scripts short; avoid editing files automatically.
- If you already use a hooks manager, just call the scripts from there.
