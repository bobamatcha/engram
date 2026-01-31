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
  .description('Generate a skill from Claude Code history')
  .option('-w, --workspace <path>', 'Workspace path', '.')
  .option('-o, --output <path>', 'Output directory for skill', './skills')
  .option('-d, --days <number>', 'Days of history to analyze', '30')
  .option('--json', 'Output JSON')
  .action(async (options: { workspace: string; output: string; days: string; json?: boolean }) => {
    const { generateProjectSkills } = await import('./generators/skill-generator.js');
    
    const days = parseInt(options.days, 10);
    
    try {
      const { skillPath, patterns } = await generateProjectSkills(
        options.workspace,
        options.output,
        days
      );

      if (options.json) {
        console.log(JSON.stringify({
          type: 'skill_generated',
          skillPath,
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
