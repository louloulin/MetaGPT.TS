/**
 * LlamaIndex RAG System
 * 
 * Enhanced RAG implementation using LlamaIndex for improved retrieval and generation capabilities.
 * 
 * @module rag/llamaindex-rag
 * @category RAG
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { 
  Document as LlamaDocument,
  VectorStoreIndex, 
  SimpleNodeParser,
  SentenceSplitter,
  ServiceContext,
  OpenAIEmbedding,
  StorageContext,
  serviceContextFromDefaults,
  MetadataMode,
  NodeParser,
  TextNode,
  VectorStore,
  CompactAndRefineRetriever,
  SummaryIndex,
  RetrieverQueryEngine,
  ContextualCompressionRetriever,
  RecursiveCharacterTextSplitter,
  RelevancyEvaluator,
  SimilarityPostprocessor,
  MemoryVectorStore,
  PineconeStore
} from "llamaindex";

import type { LLMProvider } from '../types/llm';
import type { SearchResult, Chunk } from '../types/rag';

/**
 * LlamaIndex RAG system configuration schema
 */
export const LlamaIndexRAGConfigSchema = z.object({
  /** Maximum number of relevant chunks to retrieve */
  topK: z.number().default(4),
  
  /** Minimum similarity score for retrieval */
  minScore: z.number().default(0.7),
  
  /** Reranking enabled */
  enableReranking: z.boolean().default(true),

  /** Maximum tokens for response generation */
  maxTokens: z.number().default(1024),
  
  /** System prompt template */
  systemPrompt: z.string().default(
    'You are a helpful assistant. Use the following retrieved documents to answer the user question. ' +
    'If you cannot answer the question with the provided documents, say so.\n\n' +
    'Context information is below.\n' +
    '---------------------\n' +
    '{context_str}\n' +
    '---------------------\n\n' +
    'Given this information, answer the following question: {query_str}'
  ),

  /** Document chunking configuration */
  chunkSize: z.number().default(1024),
  chunkOverlap: z.number().default(200),

  /** Vector store type */
  vectorStoreType: z.enum(['memory', 'pinecone', 'qdrant']).default('memory'),
  
  /** Pinecone configuration */
  pineconeConfig: z.object({
    apiKey: z.string().optional(),
    environment: z.string().optional(),
    namespace: z.string().default('metagpt-rag'),
    indexName: z.string().default('metagpt-index')
  }).optional(),
  
  /** Qdrant configuration */
  qdrantConfig: z.object({
    url: z.string().optional(),
    apiKey: z.string().optional(),
    collectionName: z.string().default('metagpt-collection')
  }).optional(),
  
  /** Enable semantic chunking (experimental) */
  useSemanticChunking: z.boolean().default(false),
  
  /** Advanced retrieval options */
  useSummaryIndex: z.boolean().default(false),
  useContextCompression: z.boolean().default(true),
  useHybridSearch: z.boolean().default(true),
});

export type LlamaIndexRAGConfig = z.infer<typeof LlamaIndexRAGConfigSchema>;

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
 * LlamaIndex RAG System implementation
 */
export class LlamaIndexRAG {
  private llmProvider: LLMProvider;
  private config: LlamaIndexRAGConfig;
  private serviceContext: ServiceContext;
  private vectorStore: VectorStore;
  private vectorStoreIndex: VectorStoreIndex;
  private nodeParser: NodeParser;
  private storageContext: StorageContext;
  
  /**
   * Create a new LlamaIndex RAG system
   * @param llmProvider LLM provider to use for generation and embeddings
   * @param config RAG system configuration
   */
  constructor(llmProvider: LLMProvider, config?: Partial<LlamaIndexRAGConfig>) {
    this.llmProvider = llmProvider;
    this.config = LlamaIndexRAGConfigSchema.parse(config || {});
    
    // Initialize LlamaIndex components
    this.initLlamaIndex();
  }
  
  /**
   * Initialize LlamaIndex components
   */
  private async initLlamaIndex() {
    // Set up node parser based on configuration
    this.nodeParser = this.config.useSemanticChunking 
      ? new SimpleNodeParser({
          textSplitter: new SentenceSplitter({
            chunkSize: this.config.chunkSize,
            chunkOverlap: this.config.chunkOverlap
          })
        })
      : new SimpleNodeParser({
          textSplitter: new RecursiveCharacterTextSplitter({
            chunkSize: this.config.chunkSize,
            chunkOverlap: this.config.chunkOverlap
          })
        });
    
    // Create service context with our LLM adapter
    this.serviceContext = serviceContextFromDefaults({
      // We'll implement LLM adapter in the next step
      llm: this.getLlamaIndexLLM(),
      embedModel: new OpenAIEmbedding({
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'text-embedding-ada-002',
      }),
      nodeParser: this.nodeParser,
    });
    
    // Initialize vector store based on configuration
    await this.initVectorStore();
    
    // Initialize storage context with our vector store
    this.storageContext = await StorageContext.fromDefaults({
      vectorStore: this.vectorStore,
    });
    
    // Create empty index initially
    this.vectorStoreIndex = await VectorStoreIndex.fromDocuments(
      [], 
      { 
        serviceContext: this.serviceContext,
        storageContext: this.storageContext 
      }
    );
  }
  
  /**
   * Initialize vector store based on configuration
   */
  private async initVectorStore() {
    switch (this.config.vectorStoreType) {
      case 'pinecone':
        if (!this.config.pineconeConfig?.apiKey) {
          throw new Error('Pinecone API key is required for Pinecone vector store');
        }
        // Initialize Pinecone vector store
        // Implementation will be added
        this.vectorStore = new MemoryVectorStore(); // Temporary fallback
        break;
      
      case 'qdrant':
        if (!this.config.qdrantConfig?.url) {
          throw new Error('Qdrant URL is required for Qdrant vector store');
        }
        // Initialize Qdrant vector store
        // Implementation will be added
        this.vectorStore = new MemoryVectorStore(); // Temporary fallback
        break;
      
      case 'memory':
      default:
        // Use in-memory vector store
        this.vectorStore = new MemoryVectorStore();
    }
  }
  
  /**
   * Adapter for LlamaIndex LLM interface using our LLMProvider
   */
  private getLlamaIndexLLM() {
    // This creates an adapter to use our LLMProvider with LlamaIndex
    // Implementation will be completed in the next step
    return {
      complete: async (prompt: string) => {
        const response = await this.llmProvider.generate(prompt);
        return response;
      },
      // Other required methods will be implemented
    };
  }
  
  /**
   * Add a document to the RAG system
   * @param document Document to add
   * @returns Document ID
   */
  async addDocument(document: Document): Promise<string> {
    const docId = document.id || uuidv4();
    
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
    await this.vectorStoreIndex.insertNodes(nodes);
    
    return docId;
  }
  
  /**
   * Add multiple documents to the RAG system
   * @param documents Documents to add
   * @returns Array of document IDs
   */
  async addDocuments(documents: Document[]): Promise<string[]> {
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
    
    // Parse all documents into nodes
    const nodes = this.nodeParser.getNodesFromDocuments(llamaDocs);
    
    // Add all nodes to index
    await this.vectorStoreIndex.insertNodes(nodes);
    
    return documentIds;
  }
  
  /**
   * Search for relevant documents
   * @param query Search query
   * @param topK Maximum number of results
   * @returns Array of search results
   */
  async search(query: string, topK = this.config.topK): Promise<SearchResult[]> {
    try {
      // Create retriever with specific configuration
      const retriever = this.createRetriever(topK);
      
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
   * Create an appropriate retriever based on configuration
   */
  private createRetriever(topK: number) {
    // Create base retriever
    let retriever = this.vectorStoreIndex.asRetriever({
      similarityTopK: topK,
    });
    
    // Apply postprocessors for reranking if enabled
    if (this.config.enableReranking) {
      retriever = retriever.withPostprocessors([
        new SimilarityPostprocessor({
          similarityCutoff: this.config.minScore,
        }),
        new RelevancyEvaluator({
          relevancyThreshold: this.config.minScore,
        }),
      ]);
    }
    
    // Apply context compression if enabled
    if (this.config.useContextCompression) {
      retriever = new ContextualCompressionRetriever({
        baseCompressor: this.getLlamaIndexLLM(), // Use LLM for compression
        baseRetriever: retriever,
      });
    }
    
    return retriever;
  }
  
  /**
   * Generate a response using RAG
   * @param query User query
   * @returns Generated response
   */
  async generate(query: string): Promise<string> {
    // Create query engine
    const queryEngine = this.createQueryEngine();
    
    // Use query engine to generate response
    const response = await queryEngine.query(query);
    
    return response.toString();
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
    // Retrieve search results
    const searchResults = await this.search(query);
    
    // Generate response
    const response = await this.generate(query);
    
    return {
      response,
      searchResults,
    };
  }
  
  /**
   * Create query engine based on configuration
   */
  private createQueryEngine() {
    // Start with standard retriever
    let retriever = this.createRetriever(this.config.topK);
    
    // Add summary index if configured
    if (this.config.useSummaryIndex) {
      // Create summary index for each document
      // This would be implemented with actual documents
      const summaryIndex = new SummaryIndex({
        nodes: [],
        serviceContext: this.serviceContext,
      });
      
      // Create a combined retriever
      retriever = new CompactAndRefineRetriever({
        servicesToRetry: [
          this.vectorStoreIndex.asRetriever({ similarityTopK: this.config.topK }),
          summaryIndex.asRetriever(),
        ],
      });
    }
    
    // Create query engine with retriever
    return RetrieverQueryEngine.fromRetriever(retriever, {
      // Configure response synthesis
      responseMode: 'refine',
      // Use custom system prompt
      systemPrompt: this.config.systemPrompt,
    });
  }
  
  /**
   * Update the RAG system configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<LlamaIndexRAGConfig>): void {
    this.config = LlamaIndexRAGConfigSchema.parse({
      ...this.config,
      ...config,
    });
    
    // Re-initialize components if necessary
    this.initLlamaIndex();
  }
} 