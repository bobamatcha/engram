import { PassThrough } from 'stream';
import { execSync } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { startMcpServer } from '../src/mcp/server.js';

function createIo() {
  const input = new PassThrough();
  const output = new PassThrough();
  const lines: string[] = [];

  output.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    for (const line of text.split('\n')) {
      if (line.trim()) lines.push(line);
    }
  });

  async function waitForId(id: number, timeoutMs = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idx = lines.findIndex((line) => {
        try {
          return JSON.parse(line).id === id;
        } catch {
          return false;
        }
      });
      if (idx >= 0) {
        const line = lines.splice(idx, 1)[0];
        return JSON.parse(line);
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`Timeout waiting for response id=${id}`);
  }

  return { input, output, waitForId };
}

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('engram MCP server', () => {
  it('lists tools', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'engram-mcp-'));
    const { input, output, waitForId } = createIo();

    const server = await startMcpServer({ workspace: tempDir, input, output });
    input.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n');

    const response = await waitForId(1);
    const tools = response.result.tools as Array<{ name: string }>;
    expect(tools.some((t) => t.name === 'engram.search')).toBe(true);
    expect(tools.some((t) => t.name === 'engram.summarize')).toBe(true);

    server.close();
  });

  it('adds and searches memories', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'engram-mcp-'));
    const { input, output, waitForId } = createIo();

    const server = await startMcpServer({ workspace: tempDir, input, output });

    input.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'engram.add',
        arguments: { content: 'Use Vite for frontend builds', topics: ['build'], source: 'manual' },
      },
    }) + '\n');

    const addResponse = await waitForId(2);
    expect(addResponse.result.id).toBeDefined();

    input.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'engram.search',
        arguments: { query: 'Vite', limit: 5 },
      },
    }) + '\n');

    const searchResponse = await waitForId(3);
    const results = searchResponse.result.results as Array<{ content: string }>;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('Vite');

    server.close();
  });

  it('wraps tool errors when enabled', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'engram-mcp-wrap-'));
    const { input, output, waitForId } = createIo();
    const server = await startMcpServer({ workspace: tempDir, input, output, wrapErrors: true });

    input.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'engram.search',
        arguments: { query: '' },
      },
    }) + '\n');

    const response = await waitForId(7);
    expect(response.result.ok).toBe(false);
    expect(response.result.error.code).toBe('missing_query');

    server.close();
  });

  it('returns validation error codes without wrapping', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'engram-mcp-plain-'));
    const { input, output, waitForId } = createIo();
    const server = await startMcpServer({ workspace: tempDir, input, output });

    input.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'engram.search',
        arguments: { query: '' },
      },
    }) + '\n');

    const response = await waitForId(10);
    expect(response.result.error).toBe('missing_query');
    expect(response.result.message).toBeDefined();

    server.close();
  });

  it('returns empty results for limit 0', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'engram-mcp-limit-'));
    const { input, output, waitForId } = createIo();
    const server = await startMcpServer({ workspace: tempDir, input, output });

    input.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'engram.search',
        arguments: { query: 'anything', limit: 0 },
      },
    }) + '\n');

    const response = await waitForId(8);
    expect(response.result.results).toEqual([]);

    server.close();
  });

  it('returns stats', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'engram-mcp-stats-'));
    const { input, output, waitForId } = createIo();
    const server = await startMcpServer({ workspace: tempDir, input, output });

    input.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'engram.stats', arguments: {} },
    }) + '\n');

    const response = await waitForId(9);
    expect(response.result.totalMemories).toBe(0);
    expect(response.result.memoriesWithEmbeddings).toBe(0);

    server.close();
  });

  it('returns a missing API key error for summarize', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'engram-mcp-summary-'));
    const { input, output, waitForId } = createIo();
    const server = await startMcpServer({ workspace: tempDir, input, output });

    input.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'engram.summarize',
        arguments: { days: 1, minConfidence: 0.5 },
      },
    }) + '\n');

    const response = await waitForId(5);
    expect(response.result.error).toBe('missing_anthropic_api_key');

    server.close();
  });

  it('wraps summarize errors when enabled', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'engram-mcp-summary-wrap-'));
    const { input, output, waitForId } = createIo();
    const server = await startMcpServer({ workspace: tempDir, input, output, wrapErrors: true });

    input.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'engram.summarize',
        arguments: { days: 1 },
      },
    }) + '\n');

    const response = await waitForId(11);
    expect(response.result.ok).toBe(false);
    expect(response.result.error.code).toBe('missing_anthropic_api_key');

    server.close();
  });

  it('ingests git log from a repo and is searchable', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'engram-mcp-git-'));
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "tdd@example.com"', { cwd: tempDir });
    execSync('git config user.name "tdd"', { cwd: tempDir });
    execSync('sh -c "echo test > README.md"', { cwd: tempDir });
    execSync('git add README.md', { cwd: tempDir });
    execSync('git commit -m "init"', { cwd: tempDir });

    const { input, output, waitForId } = createIo();
    const server = await startMcpServer({ workspace: tempDir, input, output });

    input.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'engram.ingestGit',
        arguments: { workspace: tempDir, days: 7 },
      },
    }) + '\n');

    const response = await waitForId(4);
    expect(response.result.added).toBe(true);
    expect(response.result.repo).toBeDefined();
    expect(response.result.days).toBe(7);
    expect(response.result.memoryId).toBeDefined();

    input.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'engram.search',
        arguments: { query: 'init', limit: 5 },
      },
    }) + '\n');

    const searchResponse = await waitForId(6);
    const results = searchResponse.result.results as Array<{ content: string }>;
    expect(results.some(r => r.content.includes('init'))).toBe(true);

    server.close();
  });
});
