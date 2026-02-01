/**
 * Embedding provider interface and implementations
 */
import type { EmbeddingProvider } from '../types.js';
/**
 * Create a mock embedding provider for testing
 * Generates deterministic embeddings based on text hash
 */
export declare function createMockEmbeddingProvider(dimension?: number): EmbeddingProvider;
/**
 * Create an OpenAI embedding provider
 */
export declare function createOpenAIEmbeddingProvider(apiKey: string, model?: string): EmbeddingProvider;
/**
 * Create a Voyage AI embedding provider
 */
export declare function createVoyageEmbeddingProvider(apiKey: string, model?: string): EmbeddingProvider;
//# sourceMappingURL=provider.d.ts.map