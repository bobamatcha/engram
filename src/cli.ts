#!/usr/bin/env node
/**
 * engram CLI - Memory system for developers and AI agents
 *
 * This CLI wraps functionality from:
 * - @4meta5/semantic-memory: Memory storage and search
 * - @4meta5/skill-generator: Session analysis and skill generation
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';

// Import from workspace packages
import {
  createMemoryStore,
  type MemoryStoreConfig,
} from '@4meta5/semantic-memory';

import {
  findClaudeCodeSessions,
  parseClaudeCodeSession,
  claudeToUnified,
  findOpenClawSessions,
  parseOpenClawSession,
  openclawToUnified,
  getSessionStats,
  extractPatterns,
  matchesWorkspace,
  generateProjectSkill,
  summarizeSession,
  evaluateTrigger,
  type UnifiedSession,
} from '@4meta5/skill-generator';
import { startMcpServer } from './mcp/server.js';
import { getAnthropicOAuthToken } from './auth/claude-oauth.js';

const program = new Command();

program
  .name('engram')
  .description('Cognitive repository for developer memory')
  .version('0.2.0');

function getConfig(workspace: string): MemoryStoreConfig {
  const workspacePath = resolve(workspace);
  const engramDir = join(workspacePath, '.engram');

  if (!existsSync(engramDir)) {
    mkdirSync(engramDir, { recursive: true });
  }

  return {
    dbPath: join(engramDir, 'memory.db'),
  };
}

// ============================================================================
// Memory Commands (from @4meta5/semantic-memory)
// ============================================================================

program
  .command('search')
  .description('Search memories')
  .argument('<query>', 'Search query')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('-n, --limit <number>', 'Max results', '10')
  .option('--json', 'Output JSON')
  .action(async (query: string, options: { workspace: string; limit: string; json?: boolean }) => {
    const config = getConfig(options.workspace);
    const store = createMemoryStore(config);
    const limit = parseInt(options.limit, 10);

    const results = store.searchBM25(query, limit);

    if (options.json) {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        type: 'search',
        query,
        results: results.map(r => ({
          id: r.memory.id,
          content: r.memory.content,
          score: r.score,
          metadata: r.memory.metadata,
        })),
      }, null, 2));
    } else {
      console.log(`Search: "${query}"`);
      console.log(`\nResults (${results.length}):`);
      for (const r of results) {
        const source = r.memory.metadata?.source || 'unknown';
        console.log(`  ${r.score.toFixed(2)} [${source}] ${r.memory.content.slice(0, 60)}...`);
      }
    }

    store.close();
  });

program
  .command('add')
  .description('Add a memory')
  .argument('<content>', 'Memory content')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('-t, --topics <topics>', 'Comma-separated topics')
  .option('-s, --source <source>', 'Source of memory', 'manual')
  .option('--json', 'Output JSON')
  .action(async (content: string, options: {
    workspace: string;
    topics?: string;
    source: string;
    json?: boolean;
  }) => {
    const config = getConfig(options.workspace);
    const store = createMemoryStore(config);

    const memory = await store.add(content, {
      topics: options.topics?.split(',').map(t => t.trim()),
      source: options.source,
    });

    if (options.json) {
      console.log(JSON.stringify({ schemaVersion: '1.0', type: 'memory_added', memory }, null, 2));
    } else {
      console.log(`Memory added: ${memory.id}`);
    }

    store.close();
  });

program
  .command('stats')
  .description('Show memory statistics')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('--json', 'Output JSON')
  .action(async (options: { workspace: string; json?: boolean }) => {
    const config = getConfig(options.workspace);
    const store = createMemoryStore(config);
    const stats = store.getStats();

    if (options.json) {
      console.log(JSON.stringify({ schemaVersion: '1.0', type: 'stats', ...stats }, null, 2));
    } else {
      console.log('engram statistics:');
      console.log(`  Total memories:        ${stats.totalMemories}`);
      console.log(`  With embeddings:       ${stats.memoriesWithEmbeddings}`);
    }

    store.close();
  });

program
  .command('ingest-git')
  .description('Ingest recent git log summaries into memory')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('-d, --days <number>', 'Days of history to analyze', '30')
  .option('--json', 'Output JSON')
  .action(async (options: { workspace: string; days: string; json?: boolean }) => {
    const config = getConfig(options.workspace);
    const store = createMemoryStore(config);
    const days = parseInt(options.days, 10);

    let gitRoot = '';
    try {
      gitRoot = execSync('git rev-parse --show-toplevel', {
        cwd: options.workspace,
        encoding: 'utf8',
      }).trim();
    } catch {
      console.error('Error: Not a git repository (or git not available)');
      process.exit(1);
    }

    const repoName = basename(gitRoot);
    const log = execSync(
      `git log --since="${days} days ago" --pretty=format:%h%x20%ad%x20%s --date=short`,
      { cwd: gitRoot, encoding: 'utf8' }
    ).trim();

    if (!log) {
      if (options.json) {
        console.log(JSON.stringify({
          schemaVersion: '1.0',
          type: 'ingest_git',
          repo: repoName,
          days,
          added: false,
          reason: 'no_commits',
        }, null, 2));
      } else {
        console.log(`No commits found in the last ${days} days for ${repoName}`);
      }
      store.close();
      return;
    }

    const content = `git log summary (${days} days) for ${repoName}:\n${log}`;
    const memory = await store.add(content, {
      topics: ['gitlog', repoName],
      source: 'gitlog',
      workspace: gitRoot,
    });

    if (options.json) {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        type: 'ingest_git',
        repo: repoName,
        days,
        added: true,
        memoryId: memory.id,
      }, null, 2));
    } else {
      console.log(`Ingested git log for ${repoName}: ${memory.id}`);
    }

    store.close();
  });

program
  .command('mcp')
  .description('Start a minimal MCP server over stdio (experimental)')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('--wrap-errors', 'Wrap tool errors in a JSON result object')
  .action(async (options: { workspace: string; wrapErrors?: boolean }) => {
    await startMcpServer({ workspace: options.workspace, wrapErrors: options.wrapErrors });
  });

// ============================================================================
// Skill Generation Commands (from @4meta5/skill-generator)
// ============================================================================

program
  .command('generate-skill')
  .description('Generate a skill from session history (filters by workspace)')
  .option('-w, --workspace <path>', 'Workspace path to filter sessions', '.')
  .option('-o, --output <path>', 'Output directory for skill', './skills')
  .option('-d, --days <number>', 'Days of history to analyze', '30')
  .option('--openclaw', 'Include OpenClaw sessions (off by default)')
  .option('-a, --agent <id>', 'OpenClaw agent ID filter')
  .option('--json', 'Output JSON')
  .action(async (options: {
    workspace: string;
    output: string;
    days: string;
    openclaw?: boolean;
    agent?: string;
    json?: boolean;
  }) => {
    const days = parseInt(options.days, 10);

    try {
      const result = await generateProjectSkill(
        options.workspace,
        options.output,
        {
          days,
          includeOpenClaw: options.openclaw ?? false,
          openclawAgent: options.agent,
        }
      );

      if (options.json) {
        console.log(JSON.stringify({
          schemaVersion: '1.0',
          type: 'skill_generated',
          skillPath: result.skillPath,
          workspace: options.workspace,
          sessionsUsed: result.sessionCount,
          sessionsFiltered: result.filteredCount,
          patterns: {
            fileCoEdits: Object.fromEntries(result.patterns.fileCoEdits),
            toolSequences: result.patterns.toolSequences.length,
            testCommands: result.patterns.testCommands.length,
            buildCommands: result.patterns.buildCommands.length,
            errorPatterns: result.patterns.errorPatterns.length,
          },
          qualityScore: result.qualityReport?.score,
        }, null, 2));
      } else {
        console.log(`Skill generated: ${result.skillPath}`);
        console.log('');
        console.log(`Sessions: ${result.sessionCount} matched workspace (${result.filteredCount} filtered out)`);
        console.log('');
        console.log('Patterns found:');
        console.log(`  - File co-edits: ${result.patterns.fileCoEdits.size} groups`);
        console.log(`  - Tool sequences: ${result.patterns.toolSequences.length}`);
        console.log(`  - Test commands: ${result.patterns.testCommands.length}`);
        console.log(`  - Build commands: ${result.patterns.buildCommands.length}`);
        console.log(`  - Error patterns: ${result.patterns.errorPatterns.length}`);
        if (result.qualityReport) {
          console.log('');
          console.log(`Quality score: ${(result.qualityReport.score * 100).toFixed(0)}%`);
        }
      }
    } catch (err) {
      console.error('Error:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('evaluate-skill')
  .description('Evaluate if current sessions warrant skill generation')
  .option('-w, --workspace <path>', 'Workspace path to filter sessions', '.')
  .option('-d, --days <number>', 'Days of history to analyze', '7')
  .option('-t, --threshold <number>', 'Trigger threshold (0-1)', '0.5')
  .option('--openclaw', 'Include OpenClaw sessions (off by default)')
  .option('-a, --agent <id>', 'OpenClaw agent ID filter')
  .option('--json', 'Output JSON')
  .action(async (options: {
    workspace: string;
    days: string;
    threshold: string;
    openclaw?: boolean;
    agent?: string;
    json?: boolean;
  }) => {
    const days = parseInt(options.days, 10);
    const threshold = parseFloat(options.threshold);
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const resolvedPath = resolve(options.workspace);

    // Collect sessions
    const allSessions: UnifiedSession[] = [];

    // Claude Code sessions
    const claudeSessions = findClaudeCodeSessions()
      .map(parseClaudeCodeSession)
      .filter(s => s.endTime.getTime() > cutoff);

    for (const session of claudeSessions) {
      const unified = claudeToUnified(session);
      if (matchesWorkspace(unified, resolvedPath)) {
        allSessions.push(unified);
      }
    }

    // OpenClaw sessions
    if (options.openclaw) {
      const openclawSessions = findOpenClawSessions(options.agent)
        .map(parseOpenClawSession)
        .filter(s => s.endTime.getTime() > cutoff);

      for (const session of openclawSessions) {
        const unified = openclawToUnified(session);
        if (matchesWorkspace(unified, resolvedPath)) {
          allSessions.push(unified);
        }
      }
    }

    if (allSessions.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ schemaVersion: '1.0', shouldTrigger: false, reason: 'no_sessions' }));
      } else {
        console.log('No sessions found for workspace');
      }
      process.exit(1);
    }

    // Evaluate
    const evaluation = evaluateTrigger(allSessions, { threshold });

    if (options.json) {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        type: 'evaluation',
        ...evaluation,
      }, null, 2));
    } else {
      console.log(`Trigger evaluation for ${allSessions.length} sessions:`);
      console.log('');
      console.log(`  Should trigger: ${evaluation.shouldTrigger ? 'YES' : 'NO'}`);
      console.log(`  Score: ${(evaluation.score * 100).toFixed(0)}% (threshold: ${(threshold * 100).toFixed(0)}%)`);
      console.log('');
      console.log('  Signals detected:');
      for (const signal of evaluation.signals) {
        const status = signal.triggered ? '[x]' : '[ ]';
        console.log(`    ${status} ${signal.type} (${(signal.confidence * 100).toFixed(0)}%)`);
        if (signal.evidence) {
          console.log(`        "${signal.evidence.slice(0, 50)}..."`);
        }
      }
    }

    // Exit with appropriate code for scripting
    process.exit(evaluation.shouldTrigger ? 0 : 1);
  });

program
  .command('sessions')
  .description('List session history')
  .option('-s, --source <type>', 'Source: claude-code, openclaw, all', 'claude-code')
  .option('-d, --days <number>', 'Days of history', '7')
  .option('-a, --agent <id>', 'Agent ID (OpenClaw only)')
  .option('--json', 'Output JSON')
  .action(async (options: { source: string; days: string; agent?: string; json?: boolean }) => {
    const days = parseInt(options.days, 10);
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const allSessions: Array<{
      source: string;
      id: string;
      startTime: Date;
      endTime: Date;
      messages: number;
      cost?: number;
    }> = [];

    // Claude Code sessions
    if (options.source === 'all' || options.source === 'claude-code') {
      const files = findClaudeCodeSessions();
      for (const file of files) {
        try {
          const session = parseClaudeCodeSession(file);
          if (session.endTime.getTime() > cutoff) {
            allSessions.push({
              source: 'claude-code',
              id: session.sessionId,
              startTime: session.startTime,
              endTime: session.endTime,
              messages: session.messages.length,
            });
          }
        } catch {
          // Skip unparseable sessions
        }
      }
    }

    // OpenClaw sessions
    if (options.source === 'all' || options.source === 'openclaw') {
      const files = findOpenClawSessions(options.agent);
      for (const file of files) {
        try {
          const session = parseOpenClawSession(file);
          if (session.endTime.getTime() > cutoff) {
            allSessions.push({
              source: 'openclaw',
              id: session.sessionId,
              startTime: session.startTime,
              endTime: session.endTime,
              messages: session.messages.length,
              cost: session.totalCost,
            });
          }
        } catch {
          // Skip unparseable sessions
        }
      }
    }

    // Sort by start time (newest first)
    allSessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    if (options.json) {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        type: 'sessions',
        count: allSessions.length,
        sessions: allSessions.map(s => ({
          ...s,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime.toISOString(),
        })),
      }, null, 2));
    } else {
      console.log(`Sessions (last ${days} days): ${allSessions.length}\n`);
      for (const s of allSessions.slice(0, 20)) {
        const date = s.startTime.toLocaleDateString();
        const time = s.startTime.toLocaleTimeString();
        const cost = s.cost ? ` $${s.cost.toFixed(4)}` : '';
        console.log(`  [${s.source}] ${date} ${time} - ${s.messages} msgs${cost}`);
        console.log(`    ${s.id.slice(0, 8)}...`);
      }
      if (allSessions.length > 20) {
        console.log(`  ... and ${allSessions.length - 20} more`);
      }
    }
  });

program
  .command('summarize')
  .description('Summarize sessions and extract learnings (requires Claude Code OAuth)')
  .option('-w, --workspace <path>', 'Workspace path to filter sessions', '.')
  .option('-d, --days <number>', 'Days of history to analyze', '30')
  .option('--openclaw', 'Include OpenClaw sessions (off by default)')
  .option('-a, --agent <id>', 'OpenClaw agent ID filter')
  .option('-c, --min-confidence <number>', 'Minimum confidence threshold (0-1)', '0.5')
  .option('-o, --output <path>', 'Output file for learnings JSON')
  .option('--json', 'Output JSON')
  .action(async (options: {
    workspace: string;
    days: string;
    openclaw?: boolean;
    agent?: string;
    minConfidence: string;
    output?: string;
    json?: boolean;
  }) => {
    // Print experimental warning in non-JSON mode
    if (!options.json) {
      console.log('Warning: engram summarize is experimental and may change.');
      console.log('');
    }

    // OAuth-only authentication (Claude Code credentials)
    const oauthResult = await getAnthropicOAuthToken();

    if (!oauthResult.ok) {
      console.error('Error: Claude Code OAuth credentials required.');
      console.error('');
      console.error('Please open Claude Code and sign in, then try again.');
      console.error('');
      console.error(oauthResult.error);
      process.exit(1);
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${oauthResult.token}`,
      'anthropic-version': '2023-06-01',
    };

    const days = parseInt(options.days, 10);
    const minConfidence = parseFloat(options.minConfidence);
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const resolvedWorkspace = resolve(options.workspace);

    // Simple LLM client using Anthropic API
    const llmClient = {
      complete: async (prompt: string): Promise<string> => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!response.ok) {
          throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json() as { content: Array<{ type: string; text?: string }> };
        return data.content[0]?.text || '';
      },
    };

    // Collect sessions
    const allSessions: UnifiedSession[] = [];

    // Claude Code sessions
    const claudeSessions = findClaudeCodeSessions()
      .map(parseClaudeCodeSession)
      .filter(s => s.endTime.getTime() > cutoff);

    for (const session of claudeSessions) {
      const unified = claudeToUnified(session);
      if (matchesWorkspace(unified, resolvedWorkspace)) {
        allSessions.push(unified);
      }
    }

    // OpenClaw sessions
    if (options.openclaw) {
      const openclawSessions = findOpenClawSessions(options.agent)
        .map(parseOpenClawSession)
        .filter(s => s.endTime.getTime() > cutoff);

      for (const session of openclawSessions) {
        const unified = openclawToUnified(session);
        if (matchesWorkspace(unified, resolvedWorkspace)) {
          allSessions.push(unified);
        }
      }
    }

    if (allSessions.length === 0) {
      console.error(`No sessions found for workspace: ${resolvedWorkspace}`);
      process.exit(1);
    }

    console.log(`Found ${allSessions.length} sessions to summarize...`);

    // Summarize each session
    const allLearnings: Array<{
      sessionId: string;
      category: string;
      summary: string;
      detail?: string;
      files?: string[];
      confidence: number;
    }> = [];

    for (const session of allSessions) {
      if (session.messages.length < 3) continue;

      try {
        process.stdout.write(`  Summarizing ${session.sessionId.slice(0, 8)}... `);
        const summary = await summarizeSession(session, { llmClient, minConfidence });

        for (const learning of summary.learnings) {
          allLearnings.push({
            sessionId: session.sessionId,
            ...learning,
          });
        }

        console.log(`${summary.learnings.length} learnings`);
      } catch (err) {
        console.log(`error: ${(err as Error).message}`);
      }
    }

    // Output results
    const result = {
      schemaVersion: '1.0',
      type: 'summarize',
      workspace: resolvedWorkspace,
      sessionsProcessed: allSessions.length,
      totalLearnings: allLearnings.length,
      byCategory: {
        decision: allLearnings.filter(l => l.category === 'decision').length,
        pattern: allLearnings.filter(l => l.category === 'pattern').length,
        gotcha: allLearnings.filter(l => l.category === 'gotcha').length,
        convention: allLearnings.filter(l => l.category === 'convention').length,
        context: allLearnings.filter(l => l.category === 'context').length,
      },
      learnings: allLearnings,
    };

    if (options.output) {
      writeFileSync(options.output, JSON.stringify(result, null, 2));
      console.log(`\nLearnings saved to: ${options.output}`);
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.output) {
      console.log(`\nSummary:`);
      console.log(`  Sessions: ${result.sessionsProcessed}`);
      console.log(`  Learnings: ${result.totalLearnings}`);
      console.log(`\n  By category:`);
      console.log(`    Decisions:   ${result.byCategory.decision}`);
      console.log(`    Patterns:    ${result.byCategory.pattern}`);
      console.log(`    Gotchas:     ${result.byCategory.gotcha}`);
      console.log(`    Conventions: ${result.byCategory.convention}`);
      console.log(`    Context:     ${result.byCategory.context}`);

      if (allLearnings.length > 0) {
        console.log(`\nTop learnings:`);
        const topLearnings = allLearnings
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5);

        for (const learning of topLearnings) {
          console.log(`  [${learning.category}] ${learning.summary}`);
        }
      }
    }
  });

// ============================================================================
// Legacy Commands (backward compatibility)
// ============================================================================

program
  .command('index')
  .description('Index a codebase (placeholder)')
  .argument('[path]', 'Path to workspace', '.')
  .option('--json', 'Output JSON')
  .action(async (path: string, options: { json?: boolean }) => {
    const config = getConfig(path);
    const store = createMemoryStore(config);
    const stats = store.getStats();

    if (options.json) {
      console.log(JSON.stringify({ schemaVersion: '1.0', type: 'index', ...stats }, null, 2));
    } else {
      console.log(`Index: ${stats.totalMemories} memories`);
      console.log('Note: Codebase indexing available via ingest-git');
    }

    store.close();
  });

program
  .command('ingest-claude')
  .description('Ingest Claude Code session history into memory')
  .option('-d, --days <number>', 'Days of history to ingest', '7')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('--json', 'Output JSON')
  .action(async (options: { days: string; workspace: string; json?: boolean }) => {
    const config = getConfig(options.workspace);
    const store = createMemoryStore(config);
    const days = parseInt(options.days, 10);
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const sessions = findClaudeCodeSessions()
      .map(parseClaudeCodeSession)
      .filter(s => s.endTime.getTime() > cutoff);

    let added = 0;
    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.content && msg.content.length > 20) {
          await store.add(msg.content, {
            source: 'chat',
            sessionId: session.sessionId,
            role: msg.role,
          }, { id: msg.id });
          added++;
        }
      }
    }

    const stats = store.getStats();

    if (options.json) {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        type: 'ingest_complete',
        source: 'claude-code',
        memoriesAdded: added,
        totalMemories: stats.totalMemories,
      }, null, 2));
    } else {
      console.log(`Ingested ${added} memories from Claude Code history (last ${days} days)`);
      console.log(`Total memories in store: ${stats.totalMemories}`);
    }

    store.close();
  });

program
  .command('ingest-openclaw')
  .description('Ingest OpenClaw session history into memory')
  .option('-d, --days <number>', 'Days of history to ingest', '7')
  .option('-a, --agent <id>', 'Agent ID to ingest (default: all)')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('--json', 'Output JSON')
  .action(async (options: { days: string; agent?: string; workspace: string; json?: boolean }) => {
    const config = getConfig(options.workspace);
    const store = createMemoryStore(config);
    const days = parseInt(options.days, 10);
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const sessions = findOpenClawSessions(options.agent)
      .map(parseOpenClawSession)
      .filter(s => s.endTime.getTime() > cutoff);

    const sessionStats = getSessionStats(sessions);

    let added = 0;
    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.content && msg.content.length > 20) {
          await store.add(msg.content, {
            source: 'chat',
            sessionId: session.sessionId,
            agentId: session.agentId,
            role: msg.role,
          }, { id: msg.id });
          added++;
        }
      }
    }

    const stats = store.getStats();

    if (options.json) {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        type: 'ingest_complete',
        source: 'openclaw',
        memoriesAdded: added,
        totalMemories: stats.totalMemories,
        sessions: sessionStats,
      }, null, 2));
    } else {
      console.log(`Ingested ${added} memories from OpenClaw history (last ${days} days)`);
      console.log(`Sessions: ${sessionStats.totalSessions}, Messages: ${sessionStats.totalMessages}`);
      console.log(`Total cost: $${sessionStats.totalCost.toFixed(4)}`);
      if (Object.keys(sessionStats.byAgent).length > 1) {
        console.log('\nBy agent:');
        for (const [agent, agentStats] of Object.entries(sessionStats.byAgent)) {
          console.log(`  ${agent}: ${agentStats.sessions} sessions, ${agentStats.messages} messages, $${agentStats.cost.toFixed(4)}`);
        }
      }
      console.log(`\nTotal memories in store: ${stats.totalMemories}`);
    }

    store.close();
  });

// Backward compatibility: handle deprecated --no-openclaw flag
// Only applies to commands that previously supported it (check positional subcommand)
const openclawCommands = ['generate-skill', 'evaluate-skill', 'summarize', 'sessions'];
const subcommand = process.argv[2];
const noOpenclawIndex = process.argv.indexOf('--no-openclaw');
if (noOpenclawIndex !== -1 && openclawCommands.includes(subcommand)) {
  console.error('Warning: --no-openclaw is deprecated (OpenClaw is now off by default).');
  console.error('Use --openclaw to explicitly include OpenClaw sessions.');
  console.error('');
  // Remove the flag so Commander doesn't error on unknown option
  process.argv.splice(noOpenclawIndex, 1);
}

program.parse();
