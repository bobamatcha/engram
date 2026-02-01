/**
 * Embedding provider interface and implementations
 */
/**
 * Create a mock embedding provider for testing
 * Generates deterministic embeddings based on text hash
 */
export function createMockEmbeddingProvider(dimension = 384) {
    return {
        dimension,
        async embed(text) {
            // Simple hash-based embedding for testing
            const embedding = new Array(dimension).fill(0);
            for (let i = 0; i < text.length; i++) {
                const idx = i % dimension;
                embedding[idx] += text.charCodeAt(i) / 1000;
            }
            // Normalize
            const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
            return embedding.map(v => v / (norm || 1));
        },
        async embedBatch(texts) {
            return Promise.all(texts.map(t => this.embed(t)));
        },
    };
}
/**
 * Create an OpenAI embedding provider
 */
export function createOpenAIEmbeddingProvider(apiKey, model = 'text-embedding-3-small') {
    const dimensions = {
        'text-embedding-3-small': 1536,
        'text-embedding-3-large': 3072,
        'text-embedding-ada-002': 1536,
    };
    return {
        dimension: dimensions[model] ?? 1536,
        async embed(text) {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    input: text,
                }),
            });
            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }
            const data = await response.json();
            return data.data[0].embedding;
        },
        async embedBatch(texts) {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    input: texts,
                }),
            });
            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }
            const data = await response.json();
            // Sort by index to maintain order
            return data.data
                .sort((a, b) => a.index - b.index)
                .map(d => d.embedding);
        },
    };
}
/**
 * Create a Voyage AI embedding provider
 */
export function createVoyageEmbeddingProvider(apiKey, model = 'voyage-2') {
    const dimensions = {
        'voyage-2': 1024,
        'voyage-large-2': 1536,
        'voyage-code-2': 1536,
    };
    return {
        dimension: dimensions[model] ?? 1024,
        async embed(text) {
            const response = await fetch('https://api.voyageai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    input: text,
                }),
            });
            if (!response.ok) {
                throw new Error(`Voyage AI API error: ${response.status}`);
            }
            const data = await response.json();
            return data.data[0].embedding;
        },
        async embedBatch(texts) {
            const response = await fetch('https://api.voyageai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    input: texts,
                }),
            });
            if (!response.ok) {
                throw new Error(`Voyage AI API error: ${response.status}`);
            }
            const data = await response.json();
            return data.data.map(d => d.embedding);
        },
    };
}
//# sourceMappingURL=provider.js.map