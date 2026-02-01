# @4meta5/semantic-memory

Standalone semantic memory storage with hybrid search.

## Installation

```bash
npm install @4meta5/semantic-memory
```

## Usage

```typescript
import { createMemoryStore } from '@4meta5/semantic-memory';

const store = createMemoryStore({ dbPath: './memory.db' });

// Add memories
await store.add('JWT tokens for auth', { topics: ['auth'] });
await store.add('Use Vitest for testing', { topics: ['testing'] });

// Search with BM25
const results = store.searchBM25('authentication', 10);

// Get stats
console.log(store.getStats());

store.close();
```

## Features

- BM25 full-text search via SQLite FTS5
- Optional vector search with pluggable embedding providers
- RRF fusion for hybrid ranking
- Local-first SQLite storage

## API

### `createMemoryStore(config)`

Create a memory store instance.

```typescript
interface MemoryStoreConfig {
  dbPath: string;                    // Path to SQLite database
  embeddingProvider?: EmbeddingProvider;  // Optional for vector search
  useVectors?: boolean;              // Enable vector search
}
```

### `store.add(content, metadata?, options?)`

Add a memory to the store.

### `store.searchBM25(query, limit)`

Search using BM25 full-text ranking.

### `store.searchHybrid(query, limit)`

Search using hybrid BM25 + vector with RRF fusion. Requires embedding provider.

### `store.getStats()`

Get storage statistics.

## License

MIT
