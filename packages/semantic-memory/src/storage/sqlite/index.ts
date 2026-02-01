/**
 * SQLite storage backend with FTS5 for BM25 search
 */

import Database from 'better-sqlite3';
import type { StorageBackend, StorageStats, Memory } from '../../types.js';

export class SQLiteBackend implements StorageBackend {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      -- Main memories table
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      );

      -- BM25 full-text search index
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content,
        content='memories',
        content_rowid='rowid'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content)
        VALUES (NEW.rowid, NEW.content);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content)
        VALUES ('delete', OLD.rowid, OLD.content);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content)
        VALUES ('delete', OLD.rowid, OLD.content);
        INSERT INTO memories_fts(rowid, content)
        VALUES (NEW.rowid, NEW.content);
      END;

      -- Index for efficient lookups
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    `);
  }

  add(memory: Memory): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories (id, content, embedding, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      memory.id,
      memory.content,
      memory.embedding ? this.serializeEmbedding(memory.embedding) : null,
      memory.metadata ? JSON.stringify(memory.metadata) : null,
      memory.createdAt,
      memory.updatedAt ?? null
    );
  }

  addBatch(memories: Memory[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories (id, content, embedding, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((mems: Memory[]) => {
      for (const m of mems) {
        stmt.run(
          m.id,
          m.content,
          m.embedding ? this.serializeEmbedding(m.embedding) : null,
          m.metadata ? JSON.stringify(m.metadata) : null,
          m.createdAt,
          m.updatedAt ?? null
        );
      }
    });
    tx(memories);
  }

  get(id: string): Memory | null {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    const row = stmt.get(id) as MemoryRow | undefined;
    return row ? this.rowToMemory(row) : null;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  }

  searchBM25(query: string, limit: number): Array<Memory & { score: number }> {
    const stmt = this.db.prepare(`
      SELECT m.*, bm25(memories_fts) as score
      FROM memories_fts
      JOIN memories m ON memories_fts.rowid = m.rowid
      WHERE memories_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `);
    const rows = stmt.all(query, limit) as Array<MemoryRow & { score: number }>;
    return rows.map(r => ({ ...this.rowToMemory(r), score: -r.score }));
  }

  searchVector(embedding: number[], limit: number): Array<Memory & { score: number }> {
    // Get all memories with embeddings and compute cosine similarity
    const stmt = this.db.prepare(`
      SELECT * FROM memories WHERE embedding IS NOT NULL
    `);
    const rows = stmt.all() as MemoryRow[];

    const results = rows
      .map(row => {
        const memory = this.rowToMemory(row);
        if (!memory.embedding) return null;
        const score = this.cosineSimilarity(embedding, memory.embedding);
        return { ...memory, score };
      })
      .filter((r): r is Memory & { score: number } => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  list(limit?: number): Memory[] {
    const stmt = limit
      ? this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?')
      : this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC');
    const rows = (limit ? stmt.all(limit) : stmt.all()) as MemoryRow[];
    return rows.map(r => this.rowToMemory(r));
  }

  getStats(): StorageStats {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number };
    const withEmbeddings = this.db.prepare(
      'SELECT COUNT(*) as count FROM memories WHERE embedding IS NOT NULL'
    ).get() as { count: number };

    return {
      totalMemories: total.count,
      memoriesWithEmbeddings: withEmbeddings.count,
    };
  }

  close(): void {
    this.db.close();
  }

  private rowToMemory(row: MemoryRow): Memory {
    return {
      id: row.id,
      content: row.content,
      embedding: row.embedding ? this.deserializeEmbedding(row.embedding) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? undefined,
    };
  }

  private serializeEmbedding(embedding: number[]): Buffer {
    return Buffer.from(new Float32Array(embedding).buffer);
  }

  private deserializeEmbedding(buffer: Buffer): number[] {
    return Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
}

interface MemoryRow {
  id: string;
  content: string;
  embedding: Buffer | null;
  metadata: string | null;
  created_at: number;
  updated_at: number | null;
}
