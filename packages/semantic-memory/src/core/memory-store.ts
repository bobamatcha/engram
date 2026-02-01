/**
 * Main MemoryStore facade
 *
 * Provides a simple API for storing and searching memories
 * with pluggable storage backends and embedding providers.
 */

import type {
  Memory,
  MemoryMetadata,
  SearchResult,
  MemoryStoreConfig,
  EmbeddingProvider,
  StorageBackend,
  StorageStats,
} from '../types.js';
import { SQLiteBackend } from '../storage/sqlite/index.js';
import { hybridSearch, HybridSearchOptions } from '../search/hybrid.js';

export interface AddOptions {
  /** Custom ID (auto-generated if not provided) */
  id?: string;
  /** Generate embedding for this memory */
  embed?: boolean;
}

export class MemoryStore {
  private backend: StorageBackend;
  private embeddingProvider?: EmbeddingProvider;

  constructor(config: MemoryStoreConfig) {
    this.backend = new SQLiteBackend(config.dbPath);
    this.embeddingProvider = config.embeddingProvider;
  }

  /**
   * Add a memory to the store
   */
  async add(
    content: string,
    metadata?: MemoryMetadata,
    options: AddOptions = {}
  ): Promise<Memory> {
    const { id = crypto.randomUUID(), embed = !!this.embeddingProvider } = options;

    let embedding: number[] | undefined;
    if (embed && this.embeddingProvider) {
      embedding = await this.embeddingProvider.embed(content);
    }

    const memory: Memory = {
      id,
      content,
      embedding,
      metadata,
      createdAt: Date.now(),
    };

    this.backend.add(memory);
    return memory;
  }

  /**
   * Add multiple memories in batch
   */
  async addBatch(
    items: Array<{ content: string; metadata?: MemoryMetadata }>,
    options: { embed?: boolean } = {}
  ): Promise<Memory[]> {
    const { embed = !!this.embeddingProvider } = options;

    let embeddings: number[][] | undefined;
    if (embed && this.embeddingProvider?.embedBatch) {
      embeddings = await this.embeddingProvider.embedBatch(items.map(i => i.content));
    } else if (embed && this.embeddingProvider) {
      embeddings = await Promise.all(items.map(i => this.embeddingProvider!.embed(i.content)));
    }

    const memories: Memory[] = items.map((item, i) => ({
      id: crypto.randomUUID(),
      content: item.content,
      embedding: embeddings?.[i],
      metadata: item.metadata,
      createdAt: Date.now(),
    }));

    this.backend.addBatch(memories);
    return memories;
  }

  /**
   * Get a memory by ID
   */
  get(id: string): Memory | null {
    return this.backend.get(id);
  }

  /**
   * Delete a memory by ID
   */
  delete(id: string): void {
    this.backend.delete(id);
  }

  /**
   * Search memories using hybrid search (BM25 + vector)
   */
  async search(query: string, options: HybridSearchOptions = {}): Promise<SearchResult[]> {
    return hybridSearch(query, this.backend, this.embeddingProvider, options);
  }

  /**
   * Search using BM25 only (faster, no embedding needed)
   */
  searchBM25(query: string, limit = 10): SearchResult[] {
    const results = this.backend.searchBM25(query, limit);
    return results.map(r => ({
      memory: r,
      score: r.score,
      matchType: 'bm25' as const,
    }));
  }

  /**
   * Search using vector similarity only
   */
  async searchVector(query: string, limit = 10): Promise<SearchResult[]> {
    if (!this.embeddingProvider || !this.backend.searchVector) {
      throw new Error('Vector search requires an embedding provider');
    }

    const queryEmbedding = await this.embeddingProvider.embed(query);
    const results = this.backend.searchVector(queryEmbedding, limit);
    return results.map(r => ({
      memory: r,
      score: r.score,
      matchType: 'vector' as const,
    }));
  }

  /**
   * List all memories
   */
  list(limit?: number): Memory[] {
    return this.backend.list(limit);
  }

  /**
   * Get store statistics
   */
  getStats(): StorageStats {
    return this.backend.getStats();
  }

  /**
   * Close the store
   */
  close(): void {
    this.backend.close();
  }
}

/**
 * Create a new MemoryStore instance
 */
export function createMemoryStore(config: MemoryStoreConfig): MemoryStore {
  return new MemoryStore(config);
}
