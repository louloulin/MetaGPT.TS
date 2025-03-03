/**
 * RAG System
 * 
 * Retrieval Augmented Generation system that combines document storage,
 * embeddings, vector search, and LLM generation for knowledge-enhanced responses.
 * 
 * @module rag/rag-system
 * @category RAG
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import type { LLMProvider } from '../types/llm';
import type { Chunker } from './chunker';
import { BaseChunker, ChunkingStrategy } from './chunker';
import type { EmbeddingGenerator } from './embeddings';
import { createEmbeddingGenerator } from './embeddings';
import type { VectorStore } from './vector-store';
import { createVectorStore } from './vector-store';
import type { Chunk, SearchResult } from '../types/rag';
import type { HybridSearchResult } from './hybrid-search';
import { HybridSearch, HybridSearchConfigSchema } from './hybrid-search';

/**
 * Search mode for RAG system
 */
export enum SearchMode {
  /** Vector-based semantic search only */
  SEMANTIC = 'semantic',
  /** Keyword-based search only */
  KEYWORD = 'keyword',
  /** Combined semantic and keyword search */
  HYBRID = 'hybrid'
}

/**
 * RAG system configuration schema
 */
export const RAGSystemConfigSchema = z.object({
  /** Maximum number of relevant chunks to retrieve */
  topK: z.number().default(3),
  
  /** Minimum similarity score for retrieval */
  minScore: z.number().default(0.7),
  
  /** Whether to include document content in context */
  includeContent: z.boolean().default(true),
  
  /** Maximum tokens for context window */
  maxContextTokens: z.number().default(4000),
  
  /** System prompt template */
  systemPromptTemplate: z.string().default(
    'You are a helpful assistant. Use the following retrieved documents to answer the user question. ' +
    'If you cannot answer the question with the provided documents, say so.\n\n' +
    'Retrieved documents:\n{{documents}}\n\n' +
    'User question: {{question}}'
  ),

  /** Search mode to use */
  searchMode: z.nativeEnum(SearchMode).default(SearchMode.HYBRID),
  
  /** Hybrid search configuration */
  hybridSearch: HybridSearchConfigSchema.default({}),
  
  /** Whether to use semantic chunking */
  useSemanticChunking: z.boolean().default(false),
  
  /** Chunking strategy to use */
  chunkingStrategy: z.nativeEnum(ChunkingStrategy).default(ChunkingStrategy.PARAGRAPH),
});

export type RAGSystemConfig = z.infer<typeof RAGSystemConfigSchema>;

/**
 * Document to be added to the RAG system
 */
export interface Document {
  /** Document content */
  content: string;
  /** Document metadata */
  metadata?: Record<string, any>;
}

/**
 * Main RAG System implementation
 */
export class RAGSystem {
  private llmProvider: LLMProvider;
  private chunker: Chunker;
  private embeddingGenerator: EmbeddingGenerator;
  private vectorStore: VectorStore;
  private hybridSearch: HybridSearch;
  private config: RAGSystemConfig;
  
  /**
   * Create a new RAG system
   * @param llmProvider LLM provider for generation
   * @param chunker Document chunker
   * @param embeddingGenerator Embedding generator
   * @param vectorStore Vector store
   * @param config RAG system configuration
   */
  constructor(
    llmProvider: LLMProvider,
    chunker: Chunker,
    embeddingGenerator: EmbeddingGenerator,
    vectorStore: VectorStore,
    config?: Partial<RAGSystemConfig>
  ) {
    this.llmProvider = llmProvider;
    this.chunker = chunker;
    this.embeddingGenerator = embeddingGenerator;
    this.vectorStore = vectorStore;
    this.config = RAGSystemConfigSchema.parse(config || {});
    
    // Initialize hybrid search
    this.hybridSearch = new HybridSearch(
      this.vectorStore,
      this.embeddingGenerator,
      this.config.hybridSearch
    );
  }
  
  /**
   * Create a RAG system with default components
   * @param llmProvider LLM provider
   * @param config RAG system configuration
   * @returns RAG system instance
   */
  static create(llmProvider: LLMProvider, config?: Partial<RAGSystemConfig>): RAGSystem {
    const parsedConfig = RAGSystemConfigSchema.parse(config || {});
    
    // Create chunker with specified strategy
    const chunker = new BaseChunker({
      strategy: parsedConfig.chunkingStrategy,
      // Semantic chunking would require a more sophisticated implementation
      // that would be added in the future
    });
    
    const embeddingGenerator = createEmbeddingGenerator(llmProvider);
    const vectorStore = createVectorStore('memory');
    
    return new RAGSystem(
      llmProvider,
      chunker,
      embeddingGenerator,
      vectorStore,
      parsedConfig
    );
  }
  
  /**
   * Add a document to the RAG system
   * @param document Document to add
   * @returns Array of added chunks
   */
  async addDocument(document: Document): Promise<Chunk[]> {
    // 1. Split document into chunks
    const chunks = this.chunker.chunk(document.content, document.metadata);
    
    // 2. Generate embeddings for chunks
    const embeddings = await this.embeddingGenerator.embedBatch(chunks);
    
    // 3. Store chunks in vector store
    const addedChunks: Chunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const id = uuidv4();
      const metadata = {
        ...document.metadata,
        chunkIndex: i,
        totalChunks: chunks.length,
      };
      
      await this.vectorStore.add(id, embeddings[i], metadata, chunks[i]);
      
      addedChunks.push({
        id,
        content: chunks[i],
        embedding: embeddings[i],
        metadata,
      });
    }
    
    return addedChunks;
  }
  
  /**
   * Add multiple documents to the RAG system
   * @param documents Documents to add
   * @returns Array of added chunks
   */
  async addDocuments(documents: Document[]): Promise<Chunk[]> {
    const results: Chunk[] = [];
    
    for (const document of documents) {
      const chunks = await this.addDocument(document);
      results.push(...chunks);
    }
    
    return results;
  }
  
  /**
   * Remove chunks from the RAG system
   * @param ids Chunk IDs to remove
   */
  async removeChunks(ids: string[]): Promise<void> {
    await this.vectorStore.delete(ids);
  }
  
  /**
   * Search for relevant documents
   * @param query Search query
   * @param topK Maximum number of results
   * @param minScore Minimum similarity score
   * @returns Array of search results
   */
  async search(query: string, topK = this.config.topK, minScore = this.config.minScore): Promise<SearchResult[]> {
    try {
      let searchResults: SearchResult[] = [];
      
      // Select search method based on configuration
      switch (this.config.searchMode) {
        case SearchMode.HYBRID:
          // Use hybrid search
          const hybridResults = await this.hybridSearch.search(query, topK, minScore);
          searchResults = this.convertHybridResults(hybridResults);
          break;
          
        case SearchMode.KEYWORD:
          // TODO: Implement pure keyword search
          // For now, fall back to semantic search
          console.warn('Pure keyword search not fully implemented, falling back to semantic search');
          const embedding = await this.embeddingGenerator.embed(query);
          const vectorResults = await this.vectorStore.search(embedding, topK, minScore);
          searchResults = vectorResults.map(result => this.convertToSearchResult(result));
          break;
          
        case SearchMode.SEMANTIC:
        default:
          // Use standard vector search
          const queryEmbedding = await this.embeddingGenerator.embed(query);
          const semanticResults = await this.vectorStore.search(queryEmbedding, topK, minScore);
          searchResults = semanticResults.map(result => this.convertToSearchResult(result));
      }
      
      return searchResults;
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }
  
  /**
   * Convert vector search result to standard search result format
   */
  private convertToSearchResult(result: { 
    id: string; 
    score: number; 
    content?: string; 
    metadata?: Record<string, any>;
  }): SearchResult {
    return {
      chunk: {
        id: result.id,
        content: result.content || '',
        embedding: [], // Don't include full embedding in results
        metadata: result.metadata || {},
      },
      score: result.score,
      metadata: result.metadata || {},
    };
  }
  
  /**
   * Convert hybrid search results to standard search results
   */
  private convertHybridResults(hybridResults: HybridSearchResult[]): SearchResult[] {
    return hybridResults.map(result => ({
      chunk: {
        id: result.id,
        content: result.content || '',
        embedding: [], // Don't include embedding in results
        metadata: result.metadata || {},
      },
      score: result.combinedScore,
      metadata: {
        ...result.metadata,
        // Include score breakdown for debugging/explanation
        scoreDetails: {
          semantic: result.scores.semantic,
          keyword: result.scores.keyword,
          combined: result.combinedScore
        }
      },
    }));
  }
  
  /**
   * Generate a response using RAG
   * @param query User query
   * @returns Generated response
   */
  async generate(query: string): Promise<string> {
    // 1. Search for relevant chunks
    const searchResults = await this.search(query);
    
    // 2. Prepare context for LLM
    const context = this.prepareContext(searchResults, query);
    
    // 3. Generate response
    return await this.llmProvider.generate(context);
  }
  
  /**
   * Generate a response with search results for debugging/transparency
   * @param query User query
   * @returns Generated response and search results
   */
  async generateWithResults(query: string): Promise<{
    response: string;
    searchResults: SearchResult[];
  }> {
    // 1. Search for relevant chunks
    const searchResults = await this.search(query);
    
    // 2. Prepare context for LLM
    const context = this.prepareContext(searchResults, query);
    
    // 3. Generate response
    const response = await this.llmProvider.generate(context);
    
    return {
      response,
      searchResults,
    };
  }
  
  /**
   * Update the RAG system configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<RAGSystemConfig>): void {
    const newConfig = RAGSystemConfigSchema.parse({
      ...this.config,
      ...config,
    });
    
    this.config = newConfig;
    
    // Update hybrid search config if it was changed
    if (config.hybridSearch) {
      this.hybridSearch.updateConfig(config.hybridSearch);
    }
    
    // Update chunker config if chunking strategy was changed
    if (config.chunkingStrategy || config.useSemanticChunking !== undefined) {
      this.chunker.updateConfig({
        strategy: newConfig.chunkingStrategy,
        // Add any additional chunking parameters here
      });
    }
  }
  
  /**
   * Prepare context from search results
   */
  private prepareContext(searchResults: SearchResult[], query: string): string {
    // Format search results into a context string
    const documents = searchResults.map((result, index) => {
      let text = `[${index + 1}] [Score: ${result.score.toFixed(2)}]`;
      
      if (this.config.includeContent) {
        text += `\n${result.chunk.content}`;
      }
      
      return text;
    }).join('\n\n');
    
    // Replace placeholders in template
    return this.config.systemPromptTemplate
      .replace('{{documents}}', documents)
      .replace('{{question}}', query);
  }
} 