/**
 * Hybrid Search for RAG
 * 
 * Combines vector-based semantic search with keyword-based search
 * for more accurate document retrieval.
 * 
 * @module rag/hybrid-search
 * @category RAG
 */

import { z } from 'zod';
import type { VectorStore, VectorSearchResult } from './vector-store';
import type { EmbeddingGenerator } from './embeddings';

/**
 * Hybrid search configuration schema
 */
export const HybridSearchConfigSchema = z.object({
  /** Weight for semantic search results (0-1) */
  semanticWeight: z.number().min(0).max(1).default(0.7),
  
  /** Weight for keyword search results (0-1) */
  keywordWeight: z.number().min(0).max(1).default(0.3),
  
  /** Maximum number of results to return */
  maxResults: z.number().default(10),
  
  /** Minimum score for results */
  minScore: z.number().default(0.6),
  
  /** Whether to apply reranking to results */
  applyReranking: z.boolean().default(true),
  
  /** Maximum distance between query terms for keyword matching */
  maxKeywordDistance: z.number().default(3),
});

export type HybridSearchConfig = z.infer<typeof HybridSearchConfigSchema>;

/**
 * Result from hybrid search
 */
export interface HybridSearchResult extends VectorSearchResult {
  /** Combined score from semantic and keyword search */
  combinedScore: number;
  
  /** Individual scores */
  scores: {
    semantic: number;
    keyword: number;
  };
  
  /** Relevance stats */
  relevance?: {
    keywordMatches: number;
    keywordMatchPositions: number[];
  };
}

/**
 * Hybrid search implementation combining vector and keyword search
 */
export class HybridSearch {
  private config: HybridSearchConfig;
  private vectorStore: VectorStore;
  private embeddingGenerator: EmbeddingGenerator;
  
  /**
   * Create a new hybrid search instance
   */
  constructor(
    vectorStore: VectorStore,
    embeddingGenerator: EmbeddingGenerator,
    config?: Partial<HybridSearchConfig>
  ) {
    this.vectorStore = vectorStore;
    this.embeddingGenerator = embeddingGenerator;
    this.config = HybridSearchConfigSchema.parse(config || {});
  }
  
  /**
   * Search for documents using hybrid approach
   */
  async search(query: string, limit?: number, minScore?: number): Promise<HybridSearchResult[]> {
    // Apply defaults
    limit = limit || this.config.maxResults;
    minScore = minScore || this.config.minScore;
    
    // 1. Generate query embedding
    const queryEmbedding = await this.embeddingGenerator.embed(query);
    
    // 2. Perform semantic search
    const semanticResults = await this.vectorStore.search(
      queryEmbedding,
      // Get more results than needed for hybrid reranking
      Math.max(limit * 2, 20),
      0 // No minimum score for initial semantic results
    );
    
    // 3. Perform keyword search - process all results with content
    const resultsWithContent = semanticResults.filter(r => r.content);
    const keywordScores = new Map<string, number>();
    
    // Extract keywords from query (basic implementation)
    const keywords = this.extractKeywords(query);
    
    // Calculate keyword scores
    for (const result of resultsWithContent) {
      const keywordScore = this.calculateKeywordScore(result.content!, keywords);
      keywordScores.set(result.id, keywordScore);
    }
    
    // 4. Combine scores
    const hybridResults: HybridSearchResult[] = semanticResults.map(result => {
      const semanticScore = result.score;
      const keywordScore = keywordScores.get(result.id) || 0;
      
      // Weighted combination of scores
      const combinedScore = 
        (semanticScore * this.config.semanticWeight) + 
        (keywordScore * this.config.keywordWeight);
      
      return {
        ...result,
        combinedScore,
        scores: {
          semantic: semanticScore,
          keyword: keywordScore
        }
      };
    });
    
    // 5. Apply reranking if enabled
    let finalResults = hybridResults;
    if (this.config.applyReranking) {
      finalResults = this.rerank(finalResults, query);
    }
    
    // 6. Sort by combined score, filter by minimum score, and limit
    return finalResults
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .filter(result => result.combinedScore >= minScore)
      .slice(0, limit);
  }
  
  /**
   * Extract keywords from a query string
   * @param query The search query
   * @returns Array of keywords
   */
  private extractKeywords(query: string): string[] {
    // Basic keyword extraction - remove stop words and split by whitespace
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
      'about', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'of', 'from', 'that', 'this', 'these', 'those', 'it', 'its'
    ]);
    
    return query
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }
  
  /**
   * Calculate keyword-based score for a document
   * @param content Document content
   * @param keywords Query keywords
   * @returns Normalized score between 0-1
   */
  private calculateKeywordScore(content: string, keywords: string[]): number {
    if (!keywords.length) return 0;
    
    const contentLower = content.toLowerCase();
    let matches = 0;
    const matchPositions: number[] = [];
    
    // Count matches and their positions
    for (const keyword of keywords) {
      let pos = -1;
      while ((pos = contentLower.indexOf(keyword, pos + 1)) >= 0) {
        matches++;
        matchPositions.push(pos);
      }
    }
    
    // No matches at all
    if (matches === 0) return 0;
    
    // Calculate proximity bonus for nearby matches
    let proximityBonus = 0;
    if (matchPositions.length > 1) {
      // Sort positions
      matchPositions.sort((a, b) => a - b);
      
      // Check for nearby matches
      for (let i = 0; i < matchPositions.length - 1; i++) {
        const distance = matchPositions[i + 1] - matchPositions[i];
        if (distance <= this.config.maxKeywordDistance) {
          proximityBonus += (this.config.maxKeywordDistance - distance) / this.config.maxKeywordDistance;
        }
      }
    }
    
    // Calculate final score: normalized by document length to avoid bias towards longer documents
    const baseScore = matches / Math.max(1, Math.log2(contentLower.length / 100));
    // Add proximity bonus
    const finalScore = Math.min(1, baseScore + (proximityBonus * 0.3));
    
    return finalScore;
  }
  
  /**
   * Rerank results based on additional factors
   */
  private rerank(results: HybridSearchResult[], query: string): HybridSearchResult[] {
    // Simple implementation - we could use a more advanced reranking algorithm
    // This adjusts scores based on metadata and additional factors
    
    const rerankedResults = results.map(result => {
      let adjustedScore = result.combinedScore;
      
      // 1. Boost short documents (assuming they're more focused)
      if (result.content) {
        const contentLength = result.content.length;
        if (contentLength < 1000) {
          adjustedScore *= 1.1; // 10% boost for short documents
        }
      }
      
      // 2. Boost exact phrase matches
      if (result.content && result.content.includes(query)) {
        adjustedScore *= 1.2; // 20% boost for exact phrase matches
      }
      
      // 3. Apply metadata boosts if available
      if (result.metadata) {
        // Boost recently updated documents
        if (result.metadata.updatedAt) {
          const updatedAt = new Date(result.metadata.updatedAt);
          const now = new Date();
          const daysDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff < 30) {
            adjustedScore *= 1 + (0.2 * (1 - daysDiff/30)); // Up to 20% boost for recent docs
          }
        }
        
        // Boost documents with matching title
        if (result.metadata.title && typeof result.metadata.title === 'string') {
          const titleLower = result.metadata.title.toLowerCase();
          const queryLower = query.toLowerCase();
          if (titleLower.includes(queryLower)) {
            adjustedScore *= 1.3; // 30% boost for title matches
          }
        }
      }
      
      return {
        ...result,
        combinedScore: Math.min(1, adjustedScore) // Cap at 1.0
      };
    });
    
    return rerankedResults;
  }
  
  /**
   * Update hybrid search configuration
   */
  updateConfig(config: Partial<HybridSearchConfig>): void {
    this.config = HybridSearchConfigSchema.parse({
      ...this.config,
      ...config
    });
  }
} 