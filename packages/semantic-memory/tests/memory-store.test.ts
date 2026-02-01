import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryStore, MemoryStore } from '../src/core/memory-store.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    // Use in-memory database for tests
    store = createMemoryStore({ dbPath: ':memory:' });
  });

  afterEach(() => {
    store.close();
  });

  describe('add', () => {
    it('should add a memory', async () => {
      const memory = await store.add('Test content', { topics: ['test'] });

      expect(memory.id).toBeDefined();
      expect(memory.content).toBe('Test content');
      expect(memory.metadata?.topics).toEqual(['test']);
      expect(memory.createdAt).toBeDefined();
    });

    it('should use custom ID when provided', async () => {
      const memory = await store.add('Test content', {}, { id: 'custom-id' });

      expect(memory.id).toBe('custom-id');
    });
  });

  describe('get', () => {
    it('should retrieve a memory by ID', async () => {
      const added = await store.add('Test content', { source: 'test' }, { id: 'test-id' });

      const retrieved = store.get('test-id');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe('Test content');
      expect(retrieved?.metadata?.source).toBe('test');
    });

    it('should return null for non-existent ID', () => {
      const result = store.get('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a memory', async () => {
      await store.add('Test content', {}, { id: 'test-id' });

      store.delete('test-id');

      const result = store.get('test-id');
      expect(result).toBeNull();
    });
  });

  describe('searchBM25', () => {
    it('should find memories by content', async () => {
      await store.add('JavaScript is a programming language', { topics: ['js'] });
      await store.add('Python is also a programming language', { topics: ['python'] });
      await store.add('Cooking recipes for dinner', { topics: ['food'] });

      const results = store.searchBM25('programming language', 10);

      expect(results.length).toBe(2);
      expect(results[0].memory.content).toContain('programming language');
    });

    it('should return empty array for no matches', async () => {
      await store.add('JavaScript is great', {});

      const results = store.searchBM25('nonexistent', 10);

      expect(results).toEqual([]);
    });

    it('should respect limit', async () => {
      await store.add('Test one', {});
      await store.add('Test two', {});
      await store.add('Test three', {});

      const results = store.searchBM25('test', 2);

      expect(results.length).toBe(2);
    });
  });

  describe('addBatch', () => {
    it('should add multiple memories', async () => {
      const items = [
        { content: 'Item 1', metadata: { index: 1 } },
        { content: 'Item 2', metadata: { index: 2 } },
        { content: 'Item 3', metadata: { index: 3 } },
      ];

      const memories = await store.addBatch(items, { embed: false });

      expect(memories.length).toBe(3);
      const stats = store.getStats();
      expect(stats.totalMemories).toBe(3);
    });
  });

  describe('list', () => {
    it('should list all memories', async () => {
      await store.add('Memory 1', {});
      await store.add('Memory 2', {});

      const all = store.list();

      expect(all.length).toBe(2);
    });

    it('should respect limit', async () => {
      await store.add('Memory 1', {});
      await store.add('Memory 2', {});
      await store.add('Memory 3', {});

      const limited = store.list(2);

      expect(limited.length).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await store.add('Memory 1', {});
      await store.add('Memory 2', {});

      const stats = store.getStats();

      expect(stats.totalMemories).toBe(2);
      expect(stats.memoriesWithEmbeddings).toBe(0);
    });
  });
});
