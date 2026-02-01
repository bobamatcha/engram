/**
 * SQLite storage backend with FTS5 for BM25 search
 */
import type { StorageBackend, StorageStats, Memory } from '../../types.js';
export declare class SQLiteBackend implements StorageBackend {
    private db;
    constructor(dbPath: string);
    private initSchema;
    add(memory: Memory): void;
    addBatch(memories: Memory[]): void;
    get(id: string): Memory | null;
    delete(id: string): void;
    searchBM25(query: string, limit: number): Array<Memory & {
        score: number;
    }>;
    searchVector(embedding: number[], limit: number): Array<Memory & {
        score: number;
    }>;
    list(limit?: number): Memory[];
    getStats(): StorageStats;
    close(): void;
    private rowToMemory;
    private serializeEmbedding;
    private deserializeEmbedding;
    private cosineSimilarity;
}
//# sourceMappingURL=index.d.ts.map