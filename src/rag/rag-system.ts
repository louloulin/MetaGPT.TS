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
import { BaseChunker } from './chunker';
import type { EmbeddingGenerator } from './embeddings';
import { createEmbeddingGenerator } from './embeddings';
import type { VectorStore } from './vector-store';
import { createVectorStore } from './vector-store';
import type { Chunk, SearchResult } from '../types/rag';

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
  }
  
  /**
   * Create a RAG system with default components
   * @param llmProvider LLM provider
   * @param config RAG system configuration
   * @returns RAG system instance
   */
  static create(llmProvider: LLMProvider, config?: Partial<RAGSystemConfig>): RAGSystem {
    const chunker = new BaseChunker();
    const embeddingGenerator = createEmbeddingGenerator(llmProvider);
    const vectorStore = createVectorStore('memory');
    
    return new RAGSystem(
      llmProvider,
      chunker,
      embeddingGenerator,
      vectorStore,
      config
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
   * Search for relevant chunks
   * @param query Query string
   * @param topK Number of results to return
   * @param minScore Minimum similarity score
   * @returns Search results
   */
  async search(query: string, topK = this.config.topK, minScore = this.config.minScore): Promise<SearchResult[]> {
    // 1. Generate query embedding
    const queryEmbedding = await this.embeddingGenerator.embed(query);
    
    // 2. Search vector store
    const results = await this.vectorStore.search(queryEmbedding, topK, minScore);
    
    // 3. Convert to search results
    return results.map(result => ({
      chunk: {
        id: result.id,
        content: result.content || '',
        embedding: [],  // Don't include embedding in results
        metadata: result.metadata || {},
      },
      score: result.score,
      metadata: result.metadata || {},
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
    this.config = RAGSystemConfigSchema.parse({
      ...this.config,
      ...config,
    });
  }
  
  /**
   * Prepare the context for the LLM from search results
   * @param searchResults Search results
   * @param query User query
   * @returns Formatted context string
   */
  private prepareContext(searchResults: SearchResult[], query: string): string {
    // Format the retrieved documents
    let documentsText = '';
    
    if (searchResults.length === 0) {
      documentsText = 'No relevant documents found.';
    } else {
      documentsText = searchResults
        .map((result, index) => {
          let text = `[Document ${index + 1}]`;
          
          if (this.config.includeContent) {
            text += `\n${result.chunk.content}`;
          }
          
          if (result.metadata && Object.keys(result.metadata).length > 0) {
            text += `\nMetadata: ${JSON.stringify(result.metadata)}`;
          }
          
          return text;
        })
        .join('\n\n');
    }
    
    // Replace placeholders in the template
    return this.config.systemPromptTemplate
      .replace('{{documents}}', documentsText)
      .replace('{{question}}', query);
  }
} 