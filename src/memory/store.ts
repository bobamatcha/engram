/**
 * SQLite-based memory store for engram
 * 
 * Local-first storage for symbols and context.
 */

import Database from 'better-sqlite3';
import type { Symbol, Context, IndexStats, EngramConfig } from '../types.js';

export class MemoryStore {
  private db: Database.Database;

  constructor(config: EngramConfig) {
    this.db = new Database(config.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      -- Symbols table: code entities
      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        scoped_name TEXT NOT NULL,
        kind TEXT NOT NULL,
        file TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        signature TEXT,
        doc_comment TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      -- Context table: decisions, notes, conversations
      CREATE TABLE IF NOT EXISTS contexts (
        id TEXT PRIMARY KEY,
        file TEXT,
        symbol_id TEXT,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (symbol_id) REFERENCES symbols(id)
      );

      -- BM25 search index for symbols
      CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
        name,
        scoped_name,
        signature,
        doc_comment,
        content='symbols',
        content_rowid='rowid'
      );

      -- BM25 search index for context
      CREATE VIRTUAL TABLE IF NOT EXISTS contexts_fts USING fts5(
        content,
        content='contexts',
        content_rowid='rowid'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS symbols_ai AFTER INSERT ON symbols BEGIN
        INSERT INTO symbols_fts(rowid, name, scoped_name, signature, doc_comment)
        VALUES (NEW.rowid, NEW.name, NEW.scoped_name, NEW.signature, NEW.doc_comment);
      END;

      CREATE TRIGGER IF NOT EXISTS symbols_ad AFTER DELETE ON symbols BEGIN
        INSERT INTO symbols_fts(symbols_fts, rowid, name, scoped_name, signature, doc_comment)
        VALUES ('delete', OLD.rowid, OLD.name, OLD.scoped_name, OLD.signature, OLD.doc_comment);
      END;

      CREATE TRIGGER IF NOT EXISTS contexts_ai AFTER INSERT ON contexts BEGIN
        INSERT INTO contexts_fts(rowid, content)
        VALUES (NEW.rowid, NEW.content);
      END;

      CREATE TRIGGER IF NOT EXISTS contexts_ad AFTER DELETE ON contexts BEGIN
        INSERT INTO contexts_fts(contexts_fts, rowid, content)
        VALUES ('delete', OLD.rowid, OLD.content);
      END;

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file);
      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_contexts_file ON contexts(file);
      CREATE INDEX IF NOT EXISTS idx_contexts_symbol ON contexts(symbol_id);
    `);
  }

  /** Add a symbol to the store */
  addSymbol(symbol: Symbol): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO symbols 
      (id, name, scoped_name, kind, file, start_line, end_line, signature, doc_comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      symbol.id,
      symbol.name,
      symbol.scopedName,
      symbol.kind,
      symbol.file,
      symbol.startLine,
      symbol.endLine,
      symbol.signature ?? null,
      symbol.docComment ?? null
    );
  }

  /** Add multiple symbols in a transaction */
  addSymbols(symbols: Symbol[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO symbols 
      (id, name, scoped_name, kind, file, start_line, end_line, signature, doc_comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((syms: Symbol[]) => {
      for (const s of syms) {
        stmt.run(s.id, s.name, s.scopedName, s.kind, s.file, s.startLine, s.endLine, s.signature ?? null, s.docComment ?? null);
      }
    });
    tx(symbols);
  }

  /** Add context */
  addContext(context: Context): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO contexts
      (id, file, symbol_id, content, source, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      context.id,
      context.file ?? null,
      context.symbolId ?? null,
      context.content,
      context.source,
      context.timestamp,
      context.metadata ? JSON.stringify(context.metadata) : null
    );
  }

  /** Find symbols by name (exact or prefix) */
  findSymbolsByName(name: string, limit = 10): Symbol[] {
    const stmt = this.db.prepare(`
      SELECT * FROM symbols 
      WHERE name = ? OR name LIKE ? 
      LIMIT ?
    `);
    const rows = stmt.all(name, `${name}%`, limit) as any[];
    return rows.map(this.rowToSymbol);
  }

  /** BM25 search for symbols */
  searchSymbols(query: string, limit = 10): Array<Symbol & { score: number }> {
    const stmt = this.db.prepare(`
      SELECT s.*, bm25(symbols_fts) as score
      FROM symbols_fts
      JOIN symbols s ON symbols_fts.rowid = s.rowid
      WHERE symbols_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `);
    const rows = stmt.all(query, limit) as any[];
    return rows.map(r => ({ ...this.rowToSymbol(r), score: -r.score }));
  }

  /** BM25 search for context */
  searchContexts(query: string, limit = 10): Array<Context & { score: number }> {
    const stmt = this.db.prepare(`
      SELECT c.*, bm25(contexts_fts) as score
      FROM contexts_fts
      JOIN contexts c ON contexts_fts.rowid = c.rowid
      WHERE contexts_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `);
    const rows = stmt.all(query, limit) as any[];
    return rows.map(r => ({ ...this.rowToContext(r), score: -r.score }));
  }

  /** Get contexts for a file */
  getContextsForFile(file: string): Context[] {
    const stmt = this.db.prepare('SELECT * FROM contexts WHERE file = ?');
    const rows = stmt.all(file) as any[];
    return rows.map(this.rowToContext);
  }

  /** Get contexts for a symbol */
  getContextsForSymbol(symbolId: string): Context[] {
    const stmt = this.db.prepare('SELECT * FROM contexts WHERE symbol_id = ?');
    const rows = stmt.all(symbolId) as any[];
    return rows.map(this.rowToContext);
  }

  /** Clear all symbols for a file (for re-indexing) */
  clearFile(file: string): void {
    this.db.prepare('DELETE FROM symbols WHERE file = ?').run(file);
  }

  /** Get index statistics */
  getStats(): IndexStats {
    const symbols = this.db.prepare('SELECT COUNT(*) as count FROM symbols').get() as { count: number };
    const contexts = this.db.prepare('SELECT COUNT(*) as count FROM contexts').get() as { count: number };
    const files = this.db.prepare('SELECT COUNT(DISTINCT file) as count FROM symbols').get() as { count: number };
    return {
      files: files.count,
      symbols: symbols.count,
      contexts: contexts.count,
    };
  }

  /** Close the database */
  close(): void {
    this.db.close();
  }

  private rowToSymbol(row: any): Symbol {
    return {
      id: row.id,
      name: row.name,
      scopedName: row.scoped_name,
      kind: row.kind,
      file: row.file,
      startLine: row.start_line,
      endLine: row.end_line,
      signature: row.signature ?? undefined,
      docComment: row.doc_comment ?? undefined,
    };
  }

  private rowToContext(row: any): Context {
    return {
      id: row.id,
      file: row.file ?? undefined,
      symbolId: row.symbol_id ?? undefined,
      content: row.content,
      source: row.source,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
