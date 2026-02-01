#!/usr/bin/env node
/**
 * engram CLI - Memory system for developers and AI agents
 */

import { Command } from 'commander';
import { MemoryStore } from './memory/store.js';
import type { EngramConfig } from './types.js';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const program = new Command();

program
  .name('engram')
  .description('Cognitive repository for developer memory')
  .version('0.1.0');

function getConfig(workspace: string): EngramConfig {
  const workspacePath = resolve(workspace);
  const engramDir = join(workspacePath, '.engram');
  
  if (!existsSync(engramDir)) {
    mkdirSync(engramDir, { recursive: true });
  }

  return {
    dbPath: join(engramDir, 'memory.db'),
    workspacePath,
    useVectors: false, // Not yet implemented
  };
}

program
  .command('index')
  .description('Index a codebase')
  .argument('[path]', 'Path to workspace', '.')
  .option('--json', 'Output JSON')
  .action(async (path: string, options: { json?: boolean }) => {
    const config = getConfig(path);
    const store = new MemoryStore(config);
    
    // TODO: Implement tree-sitter indexing
    const stats = store.getStats();
    
    if (options.json) {
      console.log(JSON.stringify({ type: 'index', ...stats }, null, 2));
    } else {
      console.log(`Indexed ${stats.files} files, ${stats.symbols} symbols`);
      console.log(`Workspace: ${config.workspacePath}`);
    }
    
    store.close();
  });

program
  .command('search')
  .description('Search for code or context')
  .argument('<query>', 'Search query')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('-n, --limit <number>', 'Max results', '10')
  .option('--json', 'Output JSON')
  .action(async (query: string, options: { workspace: string; limit: string; json?: boolean }) => {
    const config = getConfig(options.workspace);
    const store = new MemoryStore(config);
    const limit = parseInt(options.limit, 10);

    const symbolResults = store.searchSymbols(query, limit);
    const contextResults = store.searchContexts(query, limit);

    if (options.json) {
      console.log(JSON.stringify({
        type: 'search',
        query,
        symbols: symbolResults,
        contexts: contextResults,
      }, null, 2));
    } else {
      console.log(`Search: "${query}"`);
      console.log(`\nSymbols (${symbolResults.length}):`);
      for (const r of symbolResults) {
        console.log(`  ${r.score.toFixed(2)} ${r.scopedName} (${r.kind}) at ${r.file}:${r.startLine}`);
      }
      console.log(`\nContexts (${contextResults.length}):`);
      for (const r of contextResults) {
        console.log(`  ${r.score.toFixed(2)} [${r.source}] ${r.content.slice(0, 60)}...`);
      }
    }

    store.close();
  });

program
  .command('symbol')
  .description('Find symbol definitions')
  .argument('<name>', 'Symbol name')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('-n, --limit <number>', 'Max results', '10')
  .option('--json', 'Output JSON')
  .action(async (name: string, options: { workspace: string; limit: string; json?: boolean }) => {
    const config = getConfig(options.workspace);
    const store = new MemoryStore(config);
    const limit = parseInt(options.limit, 10);

    const results = store.findSymbolsByName(name, limit);

    if (options.json) {
      console.log(JSON.stringify({ type: 'symbols', query: name, results }, null, 2));
    } else {
      console.log(`Symbol: "${name}"`);
      console.log(`Found ${results.length} matches:`);
      for (const s of results) {
        console.log(`  ${s.scopedName} (${s.kind}) at ${s.file}:${s.startLine}`);
      }
    }

    store.close();
  });

program
  .command('context')
  .description('Manage context (why code exists)')
  .argument('<action>', 'Action: get, add')
  .option('-f, --file <path>', 'File to get/add context for')
  .option('-s, --symbol <id>', 'Symbol ID to get/add context for')
  .option('-n, --note <text>', 'Note to add (for add action)')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('--json', 'Output JSON')
  .action(async (action: string, options: { 
    file?: string; 
    symbol?: string; 
    note?: string;
    workspace: string;
    json?: boolean;
  }) => {
    const config = getConfig(options.workspace);
    const store = new MemoryStore(config);

    if (action === 'get') {
      let contexts;
      if (options.file) {
        contexts = store.getContextsForFile(options.file);
      } else if (options.symbol) {
        contexts = store.getContextsForSymbol(options.symbol);
      } else {
        console.error('Error: --file or --symbol required for get');
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify({ type: 'contexts', contexts }, null, 2));
      } else {
        console.log(`Found ${contexts.length} contexts:`);
        for (const c of contexts) {
          console.log(`  [${c.source}] ${c.content}`);
        }
      }
    } else if (action === 'add') {
      if (!options.note) {
        console.error('Error: --note required for add');
        process.exit(1);
      }

      const context = {
        id: crypto.randomUUID(),
        file: options.file,
        symbolId: options.symbol,
        content: options.note,
        source: 'manual' as const,
        timestamp: Date.now(),
      };

      store.addContext(context);

      if (options.json) {
        console.log(JSON.stringify({ type: 'context_added', context }, null, 2));
      } else {
        console.log('Context added.');
      }
    } else {
      console.error(`Unknown action: ${action}. Use 'get' or 'add'.`);
      process.exit(1);
    }

    store.close();
  });

program
  .command('generate-skill')
  .description('Generate a skill from session history (filters by workspace)')
  .option('-w, --workspace <path>', 'Workspace path to filter sessions', '.')
  .option('-o, --output <path>', 'Output directory for skill', './skills')
  .option('-d, --days <number>', 'Days of history to analyze', '30')
  .option('--no-openclaw', 'Exclude OpenClaw sessions')
  .option('-a, --agent <id>', 'OpenClaw agent ID filter')
  .option('--json', 'Output JSON')
  .action(async (options: { 
    workspace: string; 
    output: string; 
    days: string; 
    openclaw: boolean;
    agent?: string;
    json?: boolean;
  }) => {
    const { generateProjectSkills } = await import('./generators/skill-generator.js');
    
    const days = parseInt(options.days, 10);
    
    try {
      const { skillPath, patterns, sessionCount, filteredCount } = await generateProjectSkills(
        options.workspace,
        options.output,
        {
          days,
          includeOpenClaw: options.openclaw,
          openclawAgent: options.agent,
        }
      );

      if (options.json) {
        console.log(JSON.stringify({
          type: 'skill_generated',
          skillPath,
          workspace: options.workspace,
          sessionsUsed: sessionCount,
          sessionsFiltered: filteredCount,
          patterns: {
            fileCoEdits: Object.fromEntries(patterns.fileCoEdits),
            toolSequences: patterns.toolSequences.length,
            testCommands: patterns.testCommands.length,
            buildCommands: patterns.buildCommands.length,
            errorPatterns: patterns.errorPatterns.length,
          },
        }, null, 2));
      } else {
        console.log(`✅ Skill generated: ${skillPath}`);
        console.log('');
        console.log(`Sessions: ${sessionCount} matched workspace (${filteredCount} filtered out)`);
        console.log('');
        console.log('Patterns found:');
        console.log(`  - File co-edits: ${patterns.fileCoEdits.size} groups`);
        console.log(`  - Tool sequences: ${patterns.toolSequences.length}`);
        console.log(`  - Test commands: ${patterns.testCommands.length}`);
        console.log(`  - Build commands: ${patterns.buildCommands.length}`);
        console.log(`  - Error patterns: ${patterns.errorPatterns.length}`);
      }
    } catch (err) {
      console.error('Error:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('ingest-claude')
  .description('Ingest Claude Code session history')
  .option('-d, --days <number>', 'Days of history to ingest', '7')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('--json', 'Output JSON')
  .action(async (options: { days: string; workspace: string; json?: boolean }) => {
    // Dynamic import to avoid loading parser unless needed
    const { getRecentClaudeContext } = await import('./parsers/claude-code.js');
    
    const config = getConfig(options.workspace);
    const store = new MemoryStore(config);
    const days = parseInt(options.days, 10);

    const contexts = getRecentClaudeContext(days);
    
    for (const ctx of contexts) {
      store.addContext(ctx);
    }

    const stats = store.getStats();

    if (options.json) {
      console.log(JSON.stringify({ 
        type: 'ingest_complete',
        source: 'claude-code',
        contextsAdded: contexts.length,
        totalContexts: stats.contexts,
      }, null, 2));
    } else {
      console.log(`Ingested ${contexts.length} contexts from Claude Code history (last ${days} days)`);
      console.log(`Total contexts in store: ${stats.contexts}`);
    }

    store.close();
  });

program
  .command('ingest-openclaw')
  .description('Ingest OpenClaw session history')
  .option('-d, --days <number>', 'Days of history to ingest', '7')
  .option('-a, --agent <id>', 'Agent ID to ingest (default: all)')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('--json', 'Output JSON')
  .action(async (options: { days: string; agent?: string; workspace: string; json?: boolean }) => {
    // Dynamic import to avoid loading parser unless needed
    const { getRecentOpenClawContext, findOpenClawSessions, parseOpenClawSession, getSessionStats } = 
      await import('./parsers/openclaw.js');
    
    const config = getConfig(options.workspace);
    const store = new MemoryStore(config);
    const days = parseInt(options.days, 10);

    const contexts = getRecentOpenClawContext(days, options.agent);
    
    for (const ctx of contexts) {
      store.addContext(ctx);
    }

    // Get session stats for reporting
    const sessionFiles = findOpenClawSessions(options.agent);
    const sessions = sessionFiles.map(parseOpenClawSession);
    const sessionStats = getSessionStats(sessions);

    const stats = store.getStats();

    if (options.json) {
      console.log(JSON.stringify({ 
        type: 'ingest_complete',
        source: 'openclaw',
        contextsAdded: contexts.length,
        totalContexts: stats.contexts,
        sessions: sessionStats,
      }, null, 2));
    } else {
      console.log(`Ingested ${contexts.length} contexts from OpenClaw history (last ${days} days)`);
      console.log(`Sessions: ${sessionStats.totalSessions}, Messages: ${sessionStats.totalMessages}`);
      console.log(`Total cost: $${sessionStats.totalCost.toFixed(4)}`);
      if (Object.keys(sessionStats.byAgent).length > 1) {
        console.log('\nBy agent:');
        for (const [agent, agentStats] of Object.entries(sessionStats.byAgent)) {
          console.log(`  ${agent}: ${agentStats.sessions} sessions, ${agentStats.messages} messages, $${agentStats.cost.toFixed(4)}`);
        }
      }
      console.log(`\nTotal contexts in store: ${stats.contexts}`);
    }

    store.close();
  });

program
  .command('sessions')
  .description('List and inspect session history')
  .option('-s, --source <type>', 'Source: claude-code, openclaw, all', 'all')
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
      const { findClaudeCodeSessions, parseClaudeCodeSession } = await import('./parsers/claude-code.js');
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
      const { findOpenClawSessions, parseOpenClawSession } = await import('./parsers/openclaw.js');
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
  .command('stats')
  .description('Show index statistics')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('--json', 'Output JSON')
  .action(async (options: { workspace: string; json?: boolean }) => {
    const config = getConfig(options.workspace);
    const store = new MemoryStore(config);
    const stats = store.getStats();

    if (options.json) {
      console.log(JSON.stringify({ type: 'stats', ...stats }, null, 2));
    } else {
      console.log('engram statistics:');
      console.log(`  Files:    ${stats.files}`);
      console.log(`  Symbols:  ${stats.symbols}`);
      console.log(`  Contexts: ${stats.contexts}`);
    }

    store.close();
  });

program.parse();
