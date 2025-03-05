/**
 * Vector Store
 * 
 * A component responsible for storing and retrieving embeddings for efficient
 * similarity search and retrieval.
 * 
 * @module rag/vector-store
 * @category RAG
 */

import { z } from 'zod';

/**
 * Distance metric options for similarity search
 */
export enum DistanceMetric {
  /** Cosine similarity */
  COSINE = 'cosine',
  /** Euclidean distance */
  EUCLIDEAN = 'euclidean',
  /** Dot product */
  DOT = 'dot',
}

/**
 * Vector store configuration schema
 */
export const VectorStoreConfigSchema = z.object({
  /** Vector dimension */
  dimension: z.number().default(1536),
  /** Distance metric */
  metric: z.nativeEnum(DistanceMetric).default(DistanceMetric.COSINE),
  /** URL for external vector stores */
  url: z.string().optional(),
  /** API key for external vector stores */
  apiKey: z.string().optional(),
  /** Collection/index name */
  collection: z.string().default('default'),
});

export type VectorStoreConfig = z.infer<typeof VectorStoreConfigSchema>;

/**
 * Result from a vector search
 */
export interface VectorSearchResult {
  /** Document ID */
  id: string;
  /** Similarity score */
  score: number;
  /** Document metadata */
  metadata?: Record<string, any>;
  /** Document content (if available) */
  content?: string;
}

/**
 * Interface for vector stores
 */
export interface VectorStore {
  /**
   * Add a vector to the store
   * @param id Document ID
   * @param vector Embedding vector
   * @param metadata Optional metadata
   * @param content Optional document content
   */
  add(id: string, vector: number[], metadata?: Record<string, any>, content?: string): Promise<void>;
  
  /**
   * Add multiple vectors to the store
   * @param items Array of vectors with IDs and optional metadata
   */
  addBatch(items: Array<{
    id: string; 
    vector: number[]; 
    metadata?: Record<string, any>;
    content?: string;
  }>): Promise<void>;
  
  /**
   * Search for similar vectors
   * @param vector Query vector
   * @param limit Maximum number of results
   * @param minScore Minimum similarity score
   * @returns Array of search results
   */
  search(vector: number[], limit?: number, minScore?: number): Promise<VectorSearchResult[]>;
  
  /**
   * Delete vectors by ID
   * @param ids Array of document IDs to delete
   */
  delete(ids: string[]): Promise<void>;
  
  /**
   * Get vectors by ID
   * @param ids Array of document IDs to retrieve
   * @returns Map of IDs to vectors
   */
  get(ids: string[]): Promise<Map<string, { vector: number[]; metadata?: Record<string, any>; content?: string }>>;
  
  /**
   * Clear the entire vector store
   */
  clear(): Promise<void>;
}

/**
 * In-memory implementation of the VectorStore interface
 * Suitable for testing and small-scale use
 */
export class InMemoryVectorStore implements VectorStore {
  private config: VectorStoreConfig;
  private vectors: Map<string, {
    vector: number[];
    metadata?: Record<string, any>;
    content?: string;
  }> = new Map();
  
  /**
   * Create a new in-memory vector store
   * @param config Vector store configuration
   */
  constructor(config?: Partial<VectorStoreConfig>) {
    this.config = VectorStoreConfigSchema.parse(config || {});
  }
  
  /**
   * Add a vector to the store
   * @param id Document ID
   * @param vector Embedding vector
   * @param metadata Optional metadata
   * @param content Optional document content
   */
  async add(id: string, vector: number[], metadata?: Record<string, any>, content?: string): Promise<void> {
    // Validate vector dimension
    if (vector.length !== this.config.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.config.dimension}, got ${vector.length}`);
    }
    
    this.vectors.set(id, { vector, metadata, content });
  }
  
  /**
   * Add multiple vectors to the store
   * @param items Array of vectors with IDs and optional metadata
   */
  async addBatch(items: Array<{
    id: string; 
    vector: number[]; 
    metadata?: Record<string, any>;
    content?: string;
  }>): Promise<void> {
    for (const item of items) {
      await this.add(item.id, item.vector, item.metadata, item.content);
    }
  }
  
  /**
   * Search for similar vectors
   * @param vector Query vector
   * @param limit Maximum number of results
   * @param minScore Minimum similarity score
   * @returns Array of search results
   */
  async search(vector: number[], limit = 10, minScore = 0): Promise<VectorSearchResult[]> {
    // Validate vector dimension
    if (vector.length !== this.config.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.config.dimension}, got ${vector.length}`);
    }
    
    // Calculate similarity for all vectors
    const results: VectorSearchResult[] = [];
    
    for (const [id, item] of this.vectors.entries()) {
      const score = this.calculateSimilarity(vector, item.vector);
      
      if (score >= minScore) {
        results.push({
          id,
          score,
          metadata: item.metadata,
          content: item.content,
        });
      }
    }
    
    // Sort by similarity score (descending)
    results.sort((a, b) => b.score - a.score);
    
    // Limit results
    return results.slice(0, limit);
  }
  
  /**
   * Delete vectors by ID
   * @param ids Array of document IDs to delete
   */
  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.vectors.delete(id);
    }
  }
  
  /**
   * Get vectors by ID
   * @param ids Array of document IDs to retrieve
   * @returns Map of IDs to vectors
   */
  async get(ids: string[]): Promise<Map<string, { vector: number[]; metadata?: Record<string, any>; content?: string }>> {
    const result = new Map();
    
    for (const id of ids) {
      const item = this.vectors.get(id);
      if (item) {
        result.set(id, item);
      }
    }
    
    return result;
  }
  
  /**
   * Clear the entire vector store
   */
  async clear(): Promise<void> {
    this.vectors.clear();
  }
  
  /**
   * Calculate similarity between two vectors
   * @param a First vector
   * @param b Second vector
   * @returns Similarity score
   */
  private calculateSimilarity(a: number[], b: number[]): number {
    switch (this.config.metric) {
      case DistanceMetric.COSINE:
        return this.cosineSimilarity(a, b);
      case DistanceMetric.EUCLIDEAN:
        return this.euclideanSimilarity(a, b);
      case DistanceMetric.DOT:
        return this.dotProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }
  
  /**
   * Calculate cosine similarity
   * @param a First vector
   * @param b Second vector
   * @returns Cosine similarity (0-1)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Calculate euclidean similarity
   * @param a First vector
   * @param b Second vector
   * @returns Euclidean similarity (0-1)
   */
  private euclideanSimilarity(a: number[], b: number[]): number {
    let sum = 0;
    
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    
    const distance = Math.sqrt(sum);
    // Convert distance to similarity (1 / (1 + distance))
    return 1 / (1 + distance);
  }
  
  /**
   * Calculate dot product
   * @param a First vector
   * @param b Second vector
   * @returns Dot product
   */
  private dotProduct(a: number[], b: number[]): number {
    let result = 0;
    
    for (let i = 0; i < a.length; i++) {
      result += a[i] * b[i];
    }
    
    return result;
  }
}

/**
 * Factory function to create an appropriate vector store
 * @param type Type of vector store to create
 * @param config Vector store configuration
 * @returns VectorStore instance
 */
export function createVectorStore(
  type: 'memory' | 'external',
  config?: Partial<VectorStoreConfig>
): VectorStore {
  switch (type) {
    case 'memory':
      return new InMemoryVectorStore(config);
    case 'external':
      // Add external vector store implementation when needed
      throw new Error('External vector store not implemented yet');
    default:
      return new InMemoryVectorStore(config);
  }
} 