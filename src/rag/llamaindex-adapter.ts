/**
 * LlamaIndex Adapter
 * 
 * Adapters for integrating MetaGPT providers with LlamaIndex.
 * 
 * @module rag/llamaindex-adapter
 * @category RAG
 */

import {
  BaseLLM,
  ChatMessage,
  ChatResponse,
  MessageContent,
  NodeWithScore,
  LLM,
  SimpleLLM,
  ServiceContext,
  serviceContextFromDefaults,
  Embeddings,
  OpenAIEmbedding,
  VectorStore as LlamaVectorStore,
  SimpleNodeParser,
  TextNode,
  SentenceSplitter,
  RecursiveCharacterTextSplitter,
} from "llamaindex";

import type { LLMProvider } from '../types/llm';

/**
 * Adapter to use MetaGPT's LLMProvider with LlamaIndex LLM interface
 */
export class MetaGptLLMAdapter extends SimpleLLM implements LLM {
  private llmProvider: LLMProvider;
  
  constructor(llmProvider: LLMProvider) {
    super();
    this.llmProvider = llmProvider;
  }
  
  /**
   * Complete a prompt
   */
  async complete(prompt: string): Promise<string> {
    return await this.llmProvider.generate(prompt);
  }
  
  /**
   * Chat completion with messages
   */
  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    // Convert LlamaIndex chat messages to MetaGPT format
    const formattedMessages = messages.map(msg => {
      let role: 'system' | 'user' | 'assistant' = 'user';
      
      switch (msg.role) {
        case 'system':
          role = 'system';
          break;
        case 'assistant':
          role = 'assistant';
          break;
        case 'user':
        default:
          role = 'user';
          break;
      }
      
      return {
        role,
        content: this.formatMessageContent(msg.content),
      };
    });
    
    // Format as a conversation for the provider
    const response = await this.llmProvider.generateChat(formattedMessages);
    
    // Format response for LlamaIndex
    return {
      message: {
        role: 'assistant',
        content: response,
      },
      raw: {
        text: response,
      },
    };
  }
  
  /**
   * Convert LlamaIndex message content to string
   */
  private formatMessageContent(content: MessageContent): string {
    if (typeof content === 'string') {
      return content;
    }
    
    // Handle array of content parts
    if (Array.isArray(content)) {
      return content
        .map(part => {
          if (typeof part === 'string') {
            return part;
          }
          if (part.type === 'text') {
            return part.text;
          }
          // Skip non-text parts like images for now
          return '';
        })
        .join('\n');
    }
    
    // Handle single content part
    if (typeof content === 'object' && content.type === 'text') {
      return content.text;
    }
    
    return '';
  }
  
  /**
   * Stream is not supported in this adapter yet
   */
  async stream(): Promise<AsyncIterable<string>> {
    throw new Error('Streaming is not supported in this adapter yet');
  }
  
  /**
   * Chat stream is not supported in this adapter yet
   */
  async chatStream(): Promise<AsyncIterable<ChatResponse>> {
    throw new Error('Chat streaming is not supported in this adapter yet');
  }
}

/**
 * Create a LlamaIndex ServiceContext using MetaGPT LLMProvider
 */
export function createServiceContext(
  llmProvider: LLMProvider,
  config: {
    chunkSize?: number;
    chunkOverlap?: number;
    useSemanticChunking?: boolean;
  } = {}
): ServiceContext {
  const llm = new MetaGptLLMAdapter(llmProvider);
  
  // Set up node parser based on configuration
  const nodeParser = config.useSemanticChunking 
    ? new SimpleNodeParser({
        textSplitter: new SentenceSplitter({
          chunkSize: config.chunkSize || 1024,
          chunkOverlap: config.chunkOverlap || 200,
        })
      })
    : new SimpleNodeParser({
        textSplitter: new RecursiveCharacterTextSplitter({
          chunkSize: config.chunkSize || 1024,
          chunkOverlap: config.chunkOverlap || 200,
        })
      });
  
  // Create embedding model (default to OpenAI)
  const embedModel = new OpenAIEmbedding({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: "text-embedding-ada-002",
  });
  
  return serviceContextFromDefaults({
    llm,
    embedModel,
    nodeParser,
  });
}

/**
 * Convert LlamaIndex retrieval results to MetaGPT format
 */
export function convertRetrievalResults(results: NodeWithScore[]): Array<{
  chunk: {
    id: string;
    content: string;
    embedding: number[];
    metadata: Record<string, any>;
  };
  score: number;
  metadata: Record<string, any>;
}> {
  return results.map(result => ({
    chunk: {
      id: result.node.id_,
      content: result.node.text,
      embedding: [], // Embedding is not included in response
      metadata: result.node.metadata || {},
    },
    score: result.score,
    metadata: result.node.metadata || {},
  }));
} 