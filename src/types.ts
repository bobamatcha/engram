/**
 * Core types for engram
 */

/** A symbol extracted from code (function, class, variable, etc.) */
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

export type SymbolKind = 
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'variable'
  | 'method'
  | 'property'
  | 'enum'
  | 'module';

/** A piece of context linked to code (decision, conversation, note) */
export interface Context {
  id: string;
  file?: string;
  symbolId?: string;
  content: string;
  source: ContextSource;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type ContextSource =
  | 'manual'      // Added by user
  | 'commit'      // Extracted from commit message
  | 'chat'        // From chat/conversation
  | 'document';   // From documentation

/** A search result with relevance score */
export interface SearchResult {
  symbol?: Symbol;
  context?: Context;
  score: number;
  matchType: 'bm25' | 'vector' | 'hybrid';
}

/** Index statistics */
export interface IndexStats {
  files: number;
  symbols: number;
  contexts: number;
  lastIndexed?: number;
}

/** Configuration for engram */
export interface EngramConfig {
  dbPath: string;
  workspacePath: string;
  useVectors: boolean;
}
