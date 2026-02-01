/**
 * Core types for @engram/semantic-memory
 */
/** A memory entry with content and optional metadata */
export interface Memory {
    id: string;
    content: string;
    embedding?: number[];
    metadata?: MemoryMetadata;
    createdAt: number;
    updatedAt?: number;
}
/** Metadata associated with a memory */
export interface MemoryMetadata {
    /** Topics or tags for categorization */
    topics?: string[];
    /** Source of the memory (e.g., 'manual', 'session', 'document') */
    source?: string;
    /** Associated file path */
    file?: string;
    /** Associated symbol ID */
    symbolId?: string;
    /** Additional custom metadata */
    [key: string]: unknown;
}
/** A search result with relevance score */
export interface SearchResult {
    memory: Memory;
    score: number;
    matchType: 'bm25' | 'vector' | 'hybrid';
}
/** Configuration for creating a memory store */
export interface MemoryStoreConfig {
    /** Path to the SQLite database file. Use ':memory:' for in-memory. */
    dbPath: string;
    /** Optional embedding provider for vector search */
    embeddingProvider?: EmbeddingProvider;
    /** Enable vector search (requires embeddingProvider) */
    useVectors?: boolean;
}
/** Interface for embedding providers */
export interface EmbeddingProvider {
    /** Generate embeddings for text */
    embed(text: string): Promise<number[]>;
    /** Generate embeddings for multiple texts (batch) */
    embedBatch?(texts: string[]): Promise<number[][]>;
    /** Embedding dimension */
    dimension: number;
}
/** Interface for storage backends */
export interface StorageBackend {
    /** Add a memory to storage */
    add(memory: Memory): void;
    /** Add multiple memories in a transaction */
    addBatch(memories: Memory[]): void;
    /** Get a memory by ID */
    get(id: string): Memory | null;
    /** Delete a memory by ID */
    delete(id: string): void;
    /** BM25 full-text search */
    searchBM25(query: string, limit: number): Array<Memory & {
        score: number;
    }>;
    /** Vector similarity search (optional) */
    searchVector?(embedding: number[], limit: number): Array<Memory & {
        score: number;
    }>;
    /** Get all memories (with optional limit) */
    list(limit?: number): Memory[];
    /** Get store statistics */
    getStats(): StorageStats;
    /** Close the storage connection */
    close(): void;
}
/** Storage statistics */
export interface StorageStats {
    totalMemories: number;
    memoriesWithEmbeddings: number;
}
/** Configuration for RRF fusion */
export interface RRFConfig {
    /** Smoothing constant (default: 60) */
    k: number;
}
/** A ranked item from RRF fusion */
export interface RankedItem<T> {
    item: T;
    score: number;
}
/** Weighted ranking source for RRF */
export interface WeightedRanking<T> {
    ranking: T[];
    weight: number;
}
/** @deprecated Use Memory instead */
export interface Symbol {
    id: string;
    name: string;
    scopedName: string;
    kind: SymbolKind;
    file: string;
    startLine: number;
    endLine: number;
    signature?: string;
    docComment?: string;
}
/** @deprecated */
export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'variable' | 'method' | 'property' | 'enum' | 'module';
/** @deprecated Use Memory instead */
export interface Context {
    id: string;
    file?: string;
    symbolId?: string;
    content: string;
    source: ContextSource;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
/** @deprecated */
export type ContextSource = 'manual' | 'commit' | 'chat' | 'document';
/** @deprecated Use StorageStats instead */
export interface IndexStats {
    files: number;
    symbols: number;
    contexts: number;
    lastIndexed?: number;
}
/** @deprecated Use MemoryStoreConfig instead */
export interface EngramConfig {
    dbPath: string;
    workspacePath: string;
    useVectors: boolean;
}
//# sourceMappingURL=types.d.ts.map