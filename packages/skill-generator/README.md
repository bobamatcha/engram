# @4meta5/skill-generator

Extract learnings from AI coding sessions and generate skills.

## Installation

```bash
npm install @4meta5/skill-generator
```

## Usage

```typescript
import {
  findClaudeCodeSessions,
  parseClaudeCodeSession,
  claudeToUnified,
  extractPatterns,
  generateProjectSkill,
} from '@4meta5/skill-generator';

// Parse Claude Code sessions
const sessions = findClaudeCodeSessions()
  .map(parseClaudeCodeSession)
  .map(claudeToUnified);

// Extract patterns
const patterns = extractPatterns(sessions);
console.log('File co-edits:', patterns.fileCoEdits);
console.log('Test commands:', patterns.testCommands);

// Generate a skill file
const result = await generateProjectSkill('.', './skills', { days: 30 });
console.log(`Generated: ${result.skillPath}`);
```

## Features

- Parse Claude Code and OpenClaw session formats
- Extract file co-edits, tool sequences, error patterns
- Quality gates filter noise from learnings
- Generate markdown skills for Claude Code

## Session Parsers

### Claude Code

```typescript
import {
  findClaudeCodeSessions,
  parseClaudeCodeSession,
  claudeToUnified,
} from '@4meta5/skill-generator';
```

### OpenClaw

```typescript
import {
  findOpenClawSessions,
  parseOpenClawSession,
  openclawToUnified,
} from '@4meta5/skill-generator';
```

## Pattern Extraction

```typescript
import { extractPatterns, matchesWorkspace } from '@4meta5/skill-generator';

const patterns = extractPatterns(sessions);
// patterns.fileCoEdits - Map of files edited together
// patterns.toolSequences - Common tool call sequences
// patterns.testCommands - Test commands used
// patterns.buildCommands - Build/lint commands
// patterns.errorPatterns - Errors and their fixes
```

## Skill Generation

```typescript
import { generateProjectSkill } from '@4meta5/skill-generator';

const result = await generateProjectSkill(workspacePath, outputDir, {
  days: 30,
  includeOpenClaw: true,
});
```

## License

MIT
