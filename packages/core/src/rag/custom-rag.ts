/**
 * Custom RAG System
 * 
 * An improved RAG implementation that doesn't depend on OpenAI API,
 * using only the provided LLM provider.
 * 
 * @module rag/custom-rag
 * @category RAG
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { LLMProvider } from '../types/llm';
import type { SearchResult, Chunk } from '../types/rag';

/**
 * Custom RAG system configuration schema
 */
export const CustomRAGConfigSchema = z.object({
  /** Maximum number of relevant chunks to retrieve */
  topK: z.number().default(4),
  
  /** System prompt template */
  systemPrompt: z.string().default(
    'You are a helpful assistant. Use the following retrieved documents to answer the user question. ' +
    'If you cannot answer the question with the provided documents, say so.\n\n' +
    'Retrieved documents:\n{{documents}}\n\n' +
    'User question: {{question}}'
  ),
});

export type CustomRAGConfig = z.infer<typeof CustomRAGConfigSchema>;

/**
 * Document to be added to the RAG system
 */
export interface Document {
  /** Document content */
  content: string;
  /** Document metadata */
  metadata?: Record<string, any>;
  /** Document ID (optional, will be generated if not provided) */
  id?: string;
}

/**
 * Custom RAG System implementation that doesn't rely on OpenAI
 */
export class CustomRAG {
  private llmProvider: LLMProvider;
  private config: CustomRAGConfig;
  private documents: Document[] = [];
  
  /**
   * Create a new Custom RAG system
   * @param llmProvider LLM provider to use for generation
   * @param config RAG system configuration
   */
  constructor(llmProvider: LLMProvider, config?: Partial<CustomRAGConfig>) {
    this.llmProvider = llmProvider;
    this.config = CustomRAGConfigSchema.parse(config || {});
  }
  
  /**
   * Add a document to the RAG system
   * @param document Document to add
   * @returns Document ID
   */
  async addDocument(document: Document): Promise<string> {
    const docId = document.id || uuidv4();
    
    try {
      // Store document with ID
      this.documents.push({
        ...document,
        id: docId
      });
      
      return docId;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }
  
  /**
   * Add multiple documents to the RAG system
   * @param documents Documents to add
   * @returns Array of document IDs
   */
  async addDocuments(documents: Document[]): Promise<string[]> {
    const documentIds: string[] = [];
    
    // Process all documents
    for (const doc of documents) {
      const docId = await this.addDocument(doc);
      documentIds.push(docId);
    }
    
    return documentIds;
  }
  
  /**
   * Search for relevant documents using keyword matching
   * @param query Search query
   * @param topK Maximum number of results
   * @returns Array of search results
   */
  async search(query: string, topK = this.config.topK): Promise<SearchResult[]> {
    try {
      // Perform simple keyword matching
      const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      
      // Score documents based on keyword matches
      const scoredDocs = this.documents.map(doc => {
        const content = doc.content.toLowerCase();
        let score = 0;
        
        // Calculate score based on keyword frequency
        for (const keyword of keywords) {
          if (content.includes(keyword)) {
            // Count occurrences
            const regex = new RegExp(keyword, 'gi');
            const matches = content.match(regex);
            score += matches ? matches.length * 0.1 : 0;
          }
        }
        
        // Ensure minimum score for docs with any match
        if (score > 0 && score < 0.1) score = 0.1;
        
        return {
          document: doc,
          score
        };
      });
      
      // Sort by score and take top K
      const results = scoredDocs
        .filter(doc => doc.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
      
      // Format as SearchResult
      return results.map(result => ({
        chunk: {
          id: result.document.id || '',
          content: result.document.content,
          embedding: [], // Not used in this implementation
          metadata: result.document.metadata || {},
        },
        score: result.score,
        metadata: result.document.metadata || {},
      }));
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
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
   * @param options Optional configuration including filters
   * @returns Generated response and search results
   */
  async generateWithResults(query: string, options?: { 
    filter?: (doc: SearchResult) => boolean 
  }): Promise<{
    response: string;
    searchResults: SearchResult[];
  }> {
    // 1. Search for relevant chunks
    const searchResults = await this.search(query);
    
    // 2. Apply filter if provided
    const filteredResults = options?.filter 
      ? searchResults.filter(options.filter)
      : searchResults;
    
    // 3. Prepare context for LLM
    const context = this.prepareContext(filteredResults, query);
    
    // 4. Generate response
    const response = await this.llmProvider.generate(context);
    
    return {
      response,
      searchResults: filteredResults,
    };
  }
  
  /**
   * Prepare context from search results
   */
  private prepareContext(searchResults: SearchResult[], query: string): string {
    // Format search results into a context string
    const documents = searchResults.map((result, index) => {
      let text = `[${index + 1}] [Score: ${result.score.toFixed(2)}]`;
      text += `\n${result.chunk.content}`;
      return text;
    }).join('\n\n');
    
    // Replace placeholders in template
    return this.config.systemPrompt
      .replace('{{documents}}', documents)
      .replace('{{question}}', query);
  }
  
  /**
   * Update the RAG system configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<CustomRAGConfig>): void {
    this.config = CustomRAGConfigSchema.parse({
      ...this.config,
      ...config,
    });
  }
} 