/**
 * Main MemoryStore facade
 *
 * Provides a simple API for storing and searching memories
 * with pluggable storage backends and embedding providers.
 */
import type { Memory, MemoryMetadata, SearchResult, MemoryStoreConfig, StorageStats } from '../types.js';
import { HybridSearchOptions } from '../search/hybrid.js';
export interface AddOptions {
    /** Custom ID (auto-generated if not provided) */
    id?: string;
    /** Generate embedding for this memory */
    embed?: boolean;
}
export declare class MemoryStore {
    private backend;
    private embeddingProvider?;
    constructor(config: MemoryStoreConfig);
    /**
     * Add a memory to the store
     */
    add(content: string, metadata?: MemoryMetadata, options?: AddOptions): Promise<Memory>;
    /**
     * Add multiple memories in batch
     */
    addBatch(items: Array<{
        content: string;
        metadata?: MemoryMetadata;
    }>, options?: {
        embed?: boolean;
    }): Promise<Memory[]>;
    /**
     * Get a memory by ID
     */
    get(id: string): Memory | null;
    /**
     * Delete a memory by ID
     */
    delete(id: string): void;
    /**
     * Search memories using hybrid search (BM25 + vector)
     */
    search(query: string, options?: HybridSearchOptions): Promise<SearchResult[]>;
    /**
     * Search using BM25 only (faster, no embedding needed)
     */
    searchBM25(query: string, limit?: number): SearchResult[];
    /**
     * Search using vector similarity only
     */
    searchVector(query: string, limit?: number): Promise<SearchResult[]>;
    /**
     * List all memories
     */
    list(limit?: number): Memory[];
    /**
     * Get store statistics
     */
    getStats(): StorageStats;
    /**
     * Close the store
     */
    close(): void;
}
/**
 * Create a new MemoryStore instance
 */
export declare function createMemoryStore(config: MemoryStoreConfig): MemoryStore;
//# sourceMappingURL=memory-store.d.ts.map