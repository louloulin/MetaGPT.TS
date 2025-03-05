/**
 * Embedding Generator
 * 
 * A component responsible for generating text embeddings to be used in vector stores
 * for semantic search and retrieval.
 * 
 * @module rag/embeddings
 * @category RAG
 */

import { z } from 'zod';
import type { LLMProvider } from '../types/llm';

/**
 * Embedding model provider options
 */
export enum EmbeddingProvider {
  /** OpenAI embeddings */
  OPENAI = 'openai',
  /** Azure OpenAI embeddings */
  AZURE = 'azure',
  /** Hugging Face embeddings */
  HUGGINGFACE = 'huggingface',
  /** Local embeddings */
  LOCAL = 'local',
}

/**
 * Embedding generator configuration schema
 */
export const EmbeddingConfigSchema = z.object({
  /** Provider type */
  provider: z.nativeEnum(EmbeddingProvider).default(EmbeddingProvider.OPENAI),
  /** Model name */
  model: z.string().default('text-embedding-ada-002'),
  /** API key */
  apiKey: z.string().optional(),
  /** Batch size for processing */
  batchSize: z.number().default(8),
  /** Proxy URL if needed */
  proxy: z.string().optional(),
  /** Whether to cache embeddings */
  cache: z.boolean().default(true),
  /** Maximum retries */
  maxRetries: z.number().default(3),
  /** Timeout in milliseconds */
  timeout: z.number().default(30000),
});

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

/**
 * Interface for embedding generators
 */
export interface EmbeddingGenerator {
  /**
   * Generate embedding for a single text
   * @param text Input text
   * @returns Embedding vector
   */
  embed(text: string): Promise<number[]>;
  
  /**
   * Generate embeddings for multiple texts
   * @param texts Input texts
   * @returns Array of embedding vectors
   */
  embedBatch(texts: string[]): Promise<number[][]>;
  
  /**
   * Update the embedding generator configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<EmbeddingConfig>): void;
}

/**
 * OpenAI Embedding Generator implementation
 */
export class OpenAIEmbedding implements EmbeddingGenerator {
  private config: EmbeddingConfig;
  private llmProvider: LLMProvider;
  private cache: Map<string, number[]> = new Map();
  
  /**
   * Create a new OpenAI embedding generator
   * @param llmProvider LLM provider instance
   * @param config Embedding configuration
   */
  constructor(llmProvider: LLMProvider, config?: Partial<EmbeddingConfig>) {
    this.llmProvider = llmProvider;
    this.config = EmbeddingConfigSchema.parse({
      provider: EmbeddingProvider.OPENAI,
      ...(config || {}),
    });
  }
  
  /**
   * Generate embedding for a single text
   * @param text Input text
   * @returns Embedding vector
   */
  async embed(text: string): Promise<number[]> {
    // Check cache if enabled
    if (this.config.cache) {
      const cached = this.cache.get(text);
      if (cached) return cached;
    }
    
    try {
      // Use the LLM provider's embed function
      if (!this.llmProvider.embed) {
        throw new Error('LLM provider does not support embedding');
      }
      
      const embedding = await this.llmProvider.embed(text);
      
      // Cache the result if enabled
      if (this.config.cache) {
        this.cache.set(text, embedding);
      }
      
      return embedding;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }
  
  /**
   * Generate embeddings for multiple texts
   * @param texts Input texts
   * @returns Array of embedding vectors
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const batchSize = this.config.batchSize;
    
    // Process in batches to avoid overloading the API
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.embed(text));
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
  
  /**
   * Update the embedding generator configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<EmbeddingConfig>): void {
    this.config = EmbeddingConfigSchema.parse({
      ...this.config,
      ...config,
    });
  }
  
  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Factory function to create an appropriate embedding generator
 * @param llmProvider LLM provider to use
 * @param config Embedding configuration
 * @returns EmbeddingGenerator instance
 */
export function createEmbeddingGenerator(
  llmProvider: LLMProvider,
  config?: Partial<EmbeddingConfig>
): EmbeddingGenerator {
  const fullConfig = EmbeddingConfigSchema.parse(config || {});
  
  switch (fullConfig.provider) {
    case EmbeddingProvider.OPENAI:
    case EmbeddingProvider.AZURE:
      return new OpenAIEmbedding(llmProvider, fullConfig);
    case EmbeddingProvider.HUGGINGFACE:
      // Implement Hugging Face embeddings when needed
      throw new Error('Hugging Face embeddings not implemented yet');
    case EmbeddingProvider.LOCAL:
      // Implement local embeddings when needed
      throw new Error('Local embeddings not implemented yet');
    default:
      return new OpenAIEmbedding(llmProvider, fullConfig);
  }
} 