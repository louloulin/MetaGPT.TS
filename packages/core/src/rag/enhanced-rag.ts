/**
 * Enhanced RAG System
 * 
 * An improved RAG implementation using LlamaIndex's capabilities with proper typing.
 * 
 * @module rag/enhanced-rag
 * @category RAG
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  Document as LlamaDocument,
  VectorStoreIndex,
  SimpleNodeParser, 
  OpenAIEmbedding,
  MetadataMode,
  SentenceSplitter,
  TextNode,
  storageContextFromDefaults
} from "llamaindex";

import type { LLMProvider } from '../types/llm';
import type { SearchResult, Chunk } from '../types/rag';

/**
 * Enhanced RAG system configuration schema
 */
export const EnhancedRAGConfigSchema = z.object({
  /** Maximum number of relevant chunks to retrieve */
  topK: z.number().default(4),
  
  /** Minimum similarity score for retrieval */
  minScore: z.number().default(0.7),

  /** Document chunking configuration */
  chunkSize: z.number().default(1024),
  chunkOverlap: z.number().default(200),
  
  /** System prompt template */
  systemPrompt: z.string().default(
    'You are a helpful assistant. Use the following retrieved documents to answer the user question. ' +
    'If you cannot answer the question with the provided documents, say so.\n\n' +
    'Retrieved documents:\n{{documents}}\n\n' +
    'User question: {{question}}'
  ),
  
  /** Vector store persistence path (optional) */
  persistencePath: z.string().optional(),
});

export type EnhancedRAGConfig = z.infer<typeof EnhancedRAGConfigSchema>;

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
 * Enhanced RAG System implementation using LlamaIndex
 */
export class EnhancedRAG {
  private llmProvider: LLMProvider;
  private config: EnhancedRAGConfig;
  private index: VectorStoreIndex | null = null;
  private nodeParser: SimpleNodeParser;
  private embedding: OpenAIEmbedding;
  
  /**
   * Create a new Enhanced RAG system
   * @param llmProvider LLM provider to use for generation and embeddings
   * @param config RAG system configuration
   */
  constructor(llmProvider: LLMProvider, config?: Partial<EnhancedRAGConfig>) {
    this.llmProvider = llmProvider;
    this.config = EnhancedRAGConfigSchema.parse(config || {});
    
    // Initialize components
    this.nodeParser = new SimpleNodeParser({
      textSplitter: new SentenceSplitter({
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap
      })
    });
    
    // Initialize embedding model
    this.embedding = new OpenAIEmbedding({
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'text-embedding-ada-002',
    });
    
    // Initialize index
    this.initIndex();
  }
  
  /**
   * Initialize vector index
   */
  private async initIndex() {
    try {
      // Create storage context
      const storageContext = await storageContextFromDefaults({});
      
      // Create an empty index
      this.index = await VectorStoreIndex.fromDocuments(
        [], 
        { 
          storageContext
        }
      );
    } catch (error) {
      console.error('Error initializing vector index:', error);
      throw error;
    }
  }
  
  /**
   * Add a document to the RAG system
   * @param document Document to add
   * @returns Document ID
   */
  async addDocument(document: Document): Promise<string> {
    if (!this.index) {
      await this.initIndex();
    }
    
    const docId = document.id || uuidv4();
    
    try {
      // Create LlamaIndex document
      const llamaDoc = new LlamaDocument({
        text: document.content,
        metadata: {
          ...document.metadata,
          document_id: docId,
        },
        id_: docId,
      });
      
      // Parse document into nodes
      const nodes = this.nodeParser.getNodesFromDocuments([llamaDoc]);
      
      // Add nodes to index
      if (this.index) {
        await this.index.insertNodes(nodes);
      }
      
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
    if (!this.index) {
      await this.initIndex();
    }
    
    const documentIds: string[] = [];
    const llamaDocs: LlamaDocument[] = [];
    
    // Prepare documents
    for (const doc of documents) {
      const docId = doc.id || uuidv4();
      documentIds.push(docId);
      
      llamaDocs.push(
        new LlamaDocument({
          text: doc.content,
          metadata: {
            ...doc.metadata,
            document_id: docId,
          },
          id_: docId,
        })
      );
    }
    
    try {
      // Parse all documents into nodes
      const nodes = this.nodeParser.getNodesFromDocuments(llamaDocs);
      
      // Add all nodes to index
      if (this.index) {
        await this.index.insertNodes(nodes);
      }
      
      return documentIds;
    } catch (error) {
      console.error('Error adding documents:', error);
      throw error;
    }
  }
  
  /**
   * Search for relevant documents
   * @param query Search query
   * @param topK Maximum number of results
   * @returns Array of search results
   */
  async search(query: string, topK = this.config.topK): Promise<SearchResult[]> {
    if (!this.index) {
      await this.initIndex();
    }
    
    try {
      // Create retriever
      const retriever = this.index?.asRetriever({
        similarityTopK: topK,
      });
      
      if (!retriever) {
        return [];
      }
      
      // Retrieve relevant nodes
      const retrievedNodes = await retriever.retrieve(query);
      
      // Map to SearchResult format
      return retrievedNodes.map(nodeWithScore => {
        return {
          chunk: {
            id: nodeWithScore.node.id_,
            content: nodeWithScore.node.getContent(MetadataMode.NONE),
            embedding: [], // Embedding is not included in response
            metadata: nodeWithScore.node.metadata || {},
          },
          score: nodeWithScore.score,
          metadata: nodeWithScore.node.metadata || {},
        };
      });
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
  updateConfig(config: Partial<EnhancedRAGConfig>): void {
    this.config = EnhancedRAGConfigSchema.parse({
      ...this.config,
      ...config,
    });
    
    // Update node parser if chunking configuration changed
    if (config.chunkSize || config.chunkOverlap) {
      this.nodeParser = new SimpleNodeParser({
        textSplitter: new SentenceSplitter({
          chunkSize: this.config.chunkSize,
          chunkOverlap: this.config.chunkOverlap
        })
      });
    }
  }
} 