import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createMemoryStore } from '@4meta5/semantic-memory';
import {
  findClaudeCodeSessions,
  parseClaudeCodeSession,
  claudeToUnified,
  findOpenClawSessions,
  parseOpenClawSession,
  openclawToUnified,
  matchesWorkspace,
  summarizeSession,
  type UnifiedSession,
} from '@4meta5/skill-generator';
import { getAnthropicOAuthToken } from '../auth/claude-oauth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
interface McpRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

interface McpResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

const TOOL_DEFS = [
  {
    name: 'engram.search',
    description: 'Search memories with BM25',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
        workspace: { type: 'string' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'engram.add',
    description: 'Add a memory',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        topics: { type: 'array', items: { type: 'string' } },
        source: { type: 'string' },
        workspace: { type: 'string' },
      },
      required: ['content'],
      additionalProperties: false,
    },
  },
  {
    name: 'engram.stats',
    description: 'Get memory stats',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'engram.ingestGit',
    description: 'Ingest recent git log summaries into memory',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { type: 'string' },
        days: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'engram.summarize',
    description: 'Summarize recent sessions and extract learnings (requires Claude Code OAuth). OpenClaw off by default; set includeOpenClaw=true to include.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { type: 'string' },
        days: { type: 'number' },
        minConfidence: { type: 'number' },
        includeOpenClaw: { type: 'boolean' },
        openclawAgent: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
];

function writeResponse(output: NodeJS.WritableStream, response: McpResponse): void {
  output.write(`${JSON.stringify(response)}\n`);
}

function errorResponse(
  output: NodeJS.WritableStream,
  id: McpResponse['id'],
  message: string,
  code = -32000
): void {
  writeResponse(output, { jsonrpc: '2.0', id, error: { code, message } });
}

function getWorkspacePath(inputWorkspace: unknown, fallback: string): string {
  if (typeof inputWorkspace === 'string' && inputWorkspace.trim()) {
    return resolve(inputWorkspace.trim());
  }
  return resolve(fallback);
}

async function handleToolCall(name: string, args: Record<string, unknown>, defaultWorkspace: string) {
  const validationError = validateArgs(name, args);
  if (validationError) {
    return { error: validationError, message: describeValidationError(validationError) };
  }

  const workspace = getWorkspacePath(args.workspace, defaultWorkspace);
  const engramDir = resolve(workspace, '.engram');
  if (!existsSync(engramDir)) {
    mkdirSync(engramDir, { recursive: true });
  }
  const store = createMemoryStore({ dbPath: resolve(engramDir, 'memory.db') });

  try {
    if (name === 'engram.search') {
      const query = String(args.query || '');
      const limit = typeof args.limit === 'number' ? args.limit : 10;
      const results = store.searchBM25(query, limit).map(r => ({
        content: r.memory.content,
        score: r.score,
        metadata: r.memory.metadata,
      }));
      return { results };
    }

    if (name === 'engram.add') {
      const content = String(args.content || '');
      const topics = Array.isArray(args.topics) ? args.topics.filter(t => typeof t === 'string') : undefined;
      const source = typeof args.source === 'string' ? args.source : 'manual';
      const memory = await store.add(content, { topics, source, workspace });
      return { id: memory.id, createdAt: memory.createdAt };
    }

    if (name === 'engram.stats') {
      return store.getStats();
    }

    if (name === 'engram.ingestGit') {
      const days = typeof args.days === 'number' ? args.days : 30;
      let gitRoot = '';
      try {
        gitRoot = execSync('git rev-parse --show-toplevel', {
          cwd: workspace,
          encoding: 'utf8',
        }).trim();
      } catch {
        return { added: false, reason: 'not_a_git_repo' };
      }

      const repoName = basename(gitRoot);
      const log = execSync(
        `git log --since="${days} days ago" --pretty=format:%h%x20%ad%x20%s --date=short`,
        { cwd: gitRoot, encoding: 'utf8' }
      ).trim();

      if (!log) {
        return { added: false, reason: 'no_commits', repo: repoName, days };
      }

      const content = `git log summary (${days} days) for ${repoName}:\n${log}`;
      const memory = await store.add(content, {
        topics: ['gitlog', repoName],
        source: 'gitlog',
        workspace: gitRoot,
      });

      return { added: true, memoryId: memory.id, repo: repoName, days };
    }

    if (name === 'engram.summarize') {
      // OAuth-only authentication
      const oauthResult = await getAnthropicOAuthToken();
      if (!oauthResult.ok) {
        return { error: 'missing_oauth', message: 'Open Claude Code and sign in.' };
      }

      const days = typeof args.days === 'number' ? args.days : 30;
      const minConfidence = typeof args.minConfidence === 'number' ? args.minConfidence : 0.5;
      const includeOpenClaw = typeof args.includeOpenClaw === 'boolean' ? args.includeOpenClaw : false;
      const openclawAgent = typeof args.openclawAgent === 'string' ? args.openclawAgent : undefined;

      const sessions = collectSessions(workspace, days, includeOpenClaw, openclawAgent);
      if (sessions.length === 0) {
        return { sessionsAnalyzed: 0, learnings: [] };
      }

      const llmClient = {
        complete: async (prompt: string): Promise<string> => {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${oauthResult.token}`,
              'anthropic-version': '2023-06-01',
            },
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

      const learnings: Array<{
        sessionId: string;
        category: string;
        summary: string;
        detail?: string;
        files?: string[];
        confidence: number;
      }> = [];

      for (const session of sessions) {
        if (session.messages.length < 3) continue;
        const summary = await summarizeSession(session, { llmClient, minConfidence });
        for (const learning of summary.learnings) {
          learnings.push({ sessionId: session.sessionId, ...learning });
        }
      }

      return { sessionsAnalyzed: sessions.length, learnings };
    }

    return { error: 'unknown_tool' };
  } finally {
    store.close();
  }
}

function validateArgs(name: string, args: Record<string, unknown>): string | null {
  switch (name) {
    case 'engram.search': {
      if (typeof args.query !== 'string' || !args.query.trim()) {
        return 'missing_query';
      }
      if (args.limit !== undefined && typeof args.limit !== 'number') {
        return 'invalid_limit';
      }
      return null;
    }
    case 'engram.add': {
      if (typeof args.content !== 'string' || !args.content.trim()) {
        return 'missing_content';
      }
      if (args.topics !== undefined && !Array.isArray(args.topics)) {
        return 'invalid_topics';
      }
      if (args.source !== undefined && typeof args.source !== 'string') {
        return 'invalid_source';
      }
      return null;
    }
    case 'engram.stats': {
      return null;
    }
    case 'engram.ingestGit': {
      if (args.days !== undefined && typeof args.days !== 'number') {
        return 'invalid_days';
      }
      return null;
    }
    case 'engram.summarize': {
      if (args.days !== undefined && typeof args.days !== 'number') {
        return 'invalid_days';
      }
      if (args.minConfidence !== undefined && typeof args.minConfidence !== 'number') {
        return 'invalid_min_confidence';
      }
      if (args.includeOpenClaw !== undefined && typeof args.includeOpenClaw !== 'boolean') {
        return 'invalid_include_openclaw';
      }
      if (args.openclawAgent !== undefined && typeof args.openclawAgent !== 'string') {
        return 'invalid_openclaw_agent';
      }
      return null;
    }
    default:
      return null;
  }
}

function describeValidationError(code: string): string {
  switch (code) {
    case 'missing_query':
      return 'query must be a non-empty string';
    case 'invalid_limit':
      return 'limit must be a number';
    case 'missing_content':
      return 'engram.add requires non-empty content';
    case 'invalid_topics':
      return 'engram.add topics must be an array of strings';
    case 'invalid_source':
      return 'engram.add source must be a string';
    case 'invalid_days':
      return 'days must be a number';
    case 'invalid_min_confidence':
      return 'minConfidence must be a number';
    case 'invalid_include_openclaw':
      return 'includeOpenClaw must be a boolean';
    case 'invalid_openclaw_agent':
      return 'openclawAgent must be a string';
    default:
      return code;
  }
}

function getServerVersion(): string {
  try {
    const pkgPath = resolve(__dirname, '../../package.json');
    const raw = readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}


function collectSessions(
  workspace: string,
  days: number,
  includeOpenClaw: boolean,
  openclawAgent?: string
): UnifiedSession[] {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const resolvedWorkspace = resolve(workspace);
  const allSessions: UnifiedSession[] = [];

  const claudeSessions = findClaudeCodeSessions()
    .map(parseClaudeCodeSession)
    .filter(s => s.endTime.getTime() > cutoff);

  for (const session of claudeSessions) {
    const unified = claudeToUnified(session);
    if (matchesWorkspace(unified, resolvedWorkspace)) {
      allSessions.push(unified);
    }
  }

  if (includeOpenClaw) {
    const openclawSessions = findOpenClawSessions(openclawAgent)
      .map(parseOpenClawSession)
      .filter(s => s.endTime.getTime() > cutoff);

    for (const session of openclawSessions) {
      const unified = openclawToUnified(session);
      if (matchesWorkspace(unified, resolvedWorkspace)) {
        allSessions.push(unified);
      }
    }
  }

  return allSessions;
}

export async function startMcpServer(options: {
  workspace: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  wrapErrors?: boolean;
}): Promise<{ close: () => void }> {
  const defaultWorkspace = resolve(options.workspace || '.');
  const serverVersion = getServerVersion();
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const wrapErrors = options.wrapErrors ?? false;
  const rl = createInterface({ input, crlfDelay: Infinity });

  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let req: McpRequest;
    try {
      req = JSON.parse(line) as McpRequest;
    } catch {
      errorResponse(output, null, 'Invalid JSON');
      return;
    }

    const id = req.id ?? null;
    const method = req.method || '';

    if (method === 'initialize') {
      writeResponse(output, {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'engram', version: serverVersion },
          defaultWorkspace,
        },
      });
      return;
    }

    if (method === 'tools/list') {
      writeResponse(output, { jsonrpc: '2.0', id, result: { tools: TOOL_DEFS } });
      return;
    }

    if (method === 'tools/call') {
      const params = (req.params || {}) as { name?: string; arguments?: Record<string, unknown> };
      if (!params.name) {
        errorResponse(output, id, 'Missing tool name');
        return;
      }
      try {
        const result = await handleToolCall(params.name, params.arguments || {}, defaultWorkspace);
        if (
          wrapErrors &&
          result &&
          typeof result === 'object' &&
          'error' in result &&
          typeof (result as { error?: unknown }).error === 'string'
        ) {
          const payload = result as { error: string; message?: string };
          writeResponse(output, {
            jsonrpc: '2.0',
            id,
            result: {
              ok: false,
              error: {
                code: payload.error,
                message: payload.message ?? payload.error,
              },
            },
          });
        } else {
          writeResponse(output, { jsonrpc: '2.0', id, result });
        }
      } catch (err) {
        errorResponse(output, id, (err as Error).message || 'Tool call failed');
      }
      return;
    }

    if (id !== null) {
      errorResponse(output, id, `Unknown method: ${method}`);
    }
  });

  return {
    close: () => {
      rl.close();
    },
  };
}
