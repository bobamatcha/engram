/**
 * Main MemoryStore facade
 *
 * Provides a simple API for storing and searching memories
 * with pluggable storage backends and embedding providers.
 */
import { SQLiteBackend } from '../storage/sqlite/index.js';
import { hybridSearch } from '../search/hybrid.js';
export class MemoryStore {
    backend;
    embeddingProvider;
    constructor(config) {
        this.backend = new SQLiteBackend(config.dbPath);
        this.embeddingProvider = config.embeddingProvider;
    }
    /**
     * Add a memory to the store
     */
    async add(content, metadata, options = {}) {
        const { id = crypto.randomUUID(), embed = !!this.embeddingProvider } = options;
        let embedding;
        if (embed && this.embeddingProvider) {
            embedding = await this.embeddingProvider.embed(content);
        }
        const memory = {
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
    async addBatch(items, options = {}) {
        const { embed = !!this.embeddingProvider } = options;
        let embeddings;
        if (embed && this.embeddingProvider?.embedBatch) {
            embeddings = await this.embeddingProvider.embedBatch(items.map(i => i.content));
        }
        else if (embed && this.embeddingProvider) {
            embeddings = await Promise.all(items.map(i => this.embeddingProvider.embed(i.content)));
        }
        const memories = items.map((item, i) => ({
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
    get(id) {
        return this.backend.get(id);
    }
    /**
     * Delete a memory by ID
     */
    delete(id) {
        this.backend.delete(id);
    }
    /**
     * Search memories using hybrid search (BM25 + vector)
     */
    async search(query, options = {}) {
        return hybridSearch(query, this.backend, this.embeddingProvider, options);
    }
    /**
     * Search using BM25 only (faster, no embedding needed)
     */
    searchBM25(query, limit = 10) {
        const results = this.backend.searchBM25(query, limit);
        return results.map(r => ({
            memory: r,
            score: r.score,
            matchType: 'bm25',
        }));
    }
    /**
     * Search using vector similarity only
     */
    async searchVector(query, limit = 10) {
        if (!this.embeddingProvider || !this.backend.searchVector) {
            throw new Error('Vector search requires an embedding provider');
        }
        const queryEmbedding = await this.embeddingProvider.embed(query);
        const results = this.backend.searchVector(queryEmbedding, limit);
        return results.map(r => ({
            memory: r,
            score: r.score,
            matchType: 'vector',
        }));
    }
    /**
     * List all memories
     */
    list(limit) {
        return this.backend.list(limit);
    }
    /**
     * Get store statistics
     */
    getStats() {
        return this.backend.getStats();
    }
    /**
     * Close the store
     */
    close() {
        this.backend.close();
    }
}
/**
 * Create a new MemoryStore instance
 */
export function createMemoryStore(config) {
    return new MemoryStore(config);
}
//# sourceMappingURL=memory-store.js.map