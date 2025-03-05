/**
 * RAG System Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RAGSystem } from '../../src/rag/rag-system';
import { OpenAIEmbedding } from '../../src/embeddings/openai';
import { createTestLLMProvider } from '../utils/test-llm-provider';
import type { LLMProvider } from '../../src/types/llm';

describe('RAG System', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    llmProvider = createTestLLMProvider();
  });

  it('should initialize correctly', () => {
    const embeddingGenerator = new OpenAIEmbedding(llmProvider);
    const ragSystem = new RAGSystem({
      llm: llmProvider,
      embeddingGenerator,
      vectorStoreConfig: {
        url: 'http://localhost:6333',
        collectionName: 'test_collection'
      }
    });

    expect(ragSystem).toBeDefined();
    expect(ragSystem.llm).toBe(llmProvider);
  });

  it('should process query and return response', async () => {
    const embeddingGenerator = new OpenAIEmbedding(llmProvider);
    const ragSystem = new RAGSystem({
      llm: llmProvider,
      embeddingGenerator,
      vectorStoreConfig: {
        url: 'http://localhost:6333',
        collectionName: 'test_collection'
      }
    });

    const result = await ragSystem.query('What is RAG?');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should handle empty context', async () => {
    const embeddingGenerator = new OpenAIEmbedding(llmProvider);
    const ragSystem = new RAGSystem({
      llm: llmProvider,
      embeddingGenerator,
      vectorStoreConfig: {
        url: 'http://localhost:6333',
        collectionName: 'empty_collection'
      }
    });

    const result = await ragSystem.query('What is RAG?');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should create RAG system with factory method', () => {
    const ragSystem = RAGSystem.create(llmProvider);
    expect(ragSystem).toBeDefined();
    expect(ragSystem.llm).toBe(llmProvider);
  });
}); 