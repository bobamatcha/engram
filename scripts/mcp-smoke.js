import { spawn } from 'child_process';

const child = spawn('node', ['./dist/cli.js', 'mcp', '--workspace', process.cwd()], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

function send(obj) {
  child.stdin.write(`${JSON.stringify(obj)}\n`);
}

child.stdout.on('data', (chunk) => {
  const text = chunk.toString('utf8');
  for (const line of text.split('\n')) {
    if (line.trim()) {
      console.log('<<', line);
    }
  }
});

send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
setTimeout(() => {
  send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'engram.add',
      arguments: { content: 'mcp smoke test memory', topics: ['smoke'], source: 'script' },
    },
  });
}, 200);

setTimeout(() => {
  send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'engram.search',
      arguments: { query: 'smoke test', limit: 5 },
    },
  });
}, 400);

setTimeout(() => {
  child.kill();
}, 800);
