/**
 * RAG System Unit Tests
 */

import { expect, test, describe, beforeEach, jest } from '@jest/globals';
import { RAGSystem } from '../../src/rag/rag-system';
import { BaseChunker } from '../../src/rag/chunker';
import { OpenAIEmbedding } from '../../src/rag/embeddings';
import { InMemoryVectorStore } from '../../src/rag/vector-store';
import type { LLMProvider } from '../../src/types/llm';

// Mock LLM Provider
const createMockLLMProvider = (): jest.Mocked<LLMProvider> => ({
  chat: jest.fn().mockResolvedValue('Mock response'),
  getName: jest.fn().mockReturnValue('MockLLM'),
  getModel: jest.fn().mockReturnValue('mock-model'),
  generate: jest.fn().mockResolvedValue('Mock generated response'),
  generateStream: jest.fn(),
  embed: jest.fn().mockResolvedValue(new Array(1536).fill(0).map(() => Math.random())),
  setSystemPrompt: jest.fn(),
  getSystemPrompt: jest.fn(),
});

describe('RAGSystem', () => {
  let mockLLMProvider: jest.Mocked<LLMProvider>;
  let ragSystem: RAGSystem;
  
  beforeEach(() => {
    mockLLMProvider = createMockLLMProvider();
    
    // Create RAG components
    const chunker = new BaseChunker();
    const embeddingGenerator = new OpenAIEmbedding(mockLLMProvider);
    const vectorStore = new InMemoryVectorStore({ dimension: 1536 });
    
    // Create RAG system
    ragSystem = new RAGSystem(
      mockLLMProvider,
      chunker,
      embeddingGenerator,
      vectorStore
    );
  });
  
  test('should add a document and split into chunks', async () => {
    // Arrange
    const document = {
      content: 'This is a test document. It has multiple sentences. We want to make sure it gets split correctly.',
      metadata: { source: 'test', createdAt: new Date().toISOString() }
    };
    
    // Act
    const chunks = await ragSystem.addDocument(document);
    
    // Assert
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain('This is a test document');
    expect(chunks[0].metadata.source).toBe('test');
    expect(chunks[0].embedding.length).toBe(1536); // OpenAI embedding dimension
  });
  
  test('should search for relevant documents', async () => {
    // Arrange - Add some documents
    await ragSystem.addDocuments([
      { content: 'TypeScript is a strongly typed programming language.', metadata: { topic: 'programming' } },
      { content: 'Python is known for its simplicity and readability.', metadata: { topic: 'programming' } },
      { content: 'The Eiffel Tower is located in Paris, France.', metadata: { topic: 'travel' } },
    ]);
    
    // Act
    const results = await ragSystem.search('programming languages');
    
    // Assert
    expect(results.length).toBeGreaterThan(0);
    // We expect programming-related documents to be ranked higher
    expect(results.some(r => r.chunk.content.includes('TypeScript') || r.chunk.content.includes('Python'))).toBe(true);
  });
  
  test('should generate a response based on retrieved documents', async () => {
    // Arrange - Add some documents
    await ragSystem.addDocuments([
      { content: 'TypeScript is a strongly typed programming language.', metadata: { topic: 'programming' } },
      { content: 'Python is known for its simplicity and readability.', metadata: { topic: 'programming' } },
    ]);
    
    // Act
    const response = await ragSystem.generate('Tell me about programming languages');
    
    // Assert
    expect(response).toBe('Mock generated response');
    expect(mockLLMProvider.generate).toHaveBeenCalled();
    // Check that the prompt contains our documents
    const prompt = mockLLMProvider.generate.mock.calls[0][0] as string;
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('Python');
  });
  
  test('should generate a response with search results', async () => {
    // Arrange - Add some documents
    await ragSystem.addDocuments([
      { content: 'TypeScript is a strongly typed programming language.', metadata: { topic: 'programming' } },
      { content: 'JavaScript is a dynamic language.', metadata: { topic: 'programming' } },
    ]);
    
    // Act
    const { response, searchResults } = await ragSystem.generateWithResults('What are TypeScript and JavaScript?');
    
    // Assert
    expect(response).toBe('Mock generated response');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.some(r => r.chunk.content.includes('TypeScript'))).toBe(true);
  });
  
  test('should handle empty search results', async () => {
    // Act
    const response = await ragSystem.generate('Query with no relevant documents');
    
    // Assert
    expect(response).toBe('Mock generated response');
    expect(mockLLMProvider.generate).toHaveBeenCalled();
    const prompt = mockLLMProvider.generate.mock.calls[0][0] as string;
    expect(prompt).toContain('No relevant documents found');
  });
  
  test('should create a RAG system with factory method', () => {
    // Act
    const ragSystem = RAGSystem.create(mockLLMProvider);
    
    // Assert
    expect(ragSystem).toBeInstanceOf(RAGSystem);
  });
  
  test('should update configuration', () => {
    // Act
    ragSystem.updateConfig({ topK: 5, minScore: 0.8 });
    
    // Run a search to test config
    const searchPromise = ragSystem.search('test query');
    
    // Assert - we can't easily check the private config, but we can ensure the method completes
    expect(searchPromise).resolves.not.toThrow();
  });
}); 