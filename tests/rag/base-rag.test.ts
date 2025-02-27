import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseRAG } from '../../src/rag/base-rag';
import { createMockVectorStore, createMockLLM } from '../utils/mock-utils';
import type { Document } from '../../src/types/document';
import type { Chunk } from '../../src/types/rag';

describe('BaseRAG', () => {
  let rag: BaseRAG;
  let mockVectorStore: ReturnType<typeof createMockVectorStore>;
  let mockLLM: ReturnType<typeof createMockLLM>;

  beforeEach(() => {
    mockVectorStore = createMockVectorStore();
    mockLLM = createMockLLM();
    
    vi.spyOn(BaseRAG.prototype as any, 'initializeCollection').mockResolvedValue(undefined);
    
    rag = new BaseRAG({
      llm: mockLLM,
      vectorStore: {
        url: 'http://localhost:6333',
        collectionName: 'test-collection',
        dimension: 384,
        distance: 'Cosine'
      },
      chunkSize: 50,
      chunkOverlap: 10,
      topK: 3,
      minScore: 0.7
    });
    
    (rag as any).vectorStore = mockVectorStore;
    (rag as any).llm = mockLLM;
  });

  describe('Document Management', () => {
    it('should add a small document', async () => {
      const content = 'Test content';
      const metadata = { source: 'test' };

      await rag.addDocument(content, metadata);
      expect(mockVectorStore.upsert).toHaveBeenCalled();
    });

    it('should handle document chunking', async () => {
      const content = 'First part. Second part. Third part.';
      const metadata = { source: 'test' };

      await rag.addDocument(content, metadata);
      
      const upsertCall = mockVectorStore.upsert.mock.calls[0][1];
      expect(upsertCall.points.length).toBeGreaterThan(0);
      
      const firstChunk = upsertCall.points[0];
      expect(firstChunk.payload.content.length).toBeLessThanOrEqual(50);
    });

    it('should delete chunks', async () => {
      const ids = ['chunk1'];
      await rag.deleteChunks(ids);

      expect(mockVectorStore.delete).toHaveBeenCalledWith('test-collection', {
        points: ids,
      });
    });

    it('should update a chunk', async () => {
      const chunk: Chunk = {
        id: 'chunk1',
        content: 'Updated',
        embedding: [0.1, 0.2],
        metadata: { source: 'test' }
      };

      await rag.updateChunk(chunk);
      expect(mockVectorStore.upsert).toHaveBeenCalled();
    });
  });

  describe('Search and Generate', () => {
    it('should search for relevant documents', async () => {
      const query = 'test';
      const mockSearchResults = [{
        id: 'chunk1',
        score: 0.9,
        payload: {
          content: 'Test',
          metadata: { source: 'test' }
        }
      }];
      
      mockVectorStore.search.mockResolvedValueOnce(mockSearchResults);
      const results = await rag.search(query);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.content).toBeDefined();
    });

    it('should generate an answer', async () => {
      const query = 'test';
      const mockSearchResults = [{
        chunk: {
          id: 'chunk1',
          content: 'Test',
          embedding: [0.1],
          metadata: { source: 'test' }
        },
        score: 0.9,
        metadata: { source: 'test' }
      }];

      (rag as any).search = vi.fn().mockResolvedValueOnce(mockSearchResults);
      await rag.generate(query);
      expect(mockLLM.generate).toHaveBeenCalled();
    });
  });

  describe('Prompt Building', () => {
    it('should build prompt with query and results', () => {
      const query = 'test';
      const results = [{
        chunk: {
          id: 'chunk1',
          content: 'Test',
          embedding: [0.1],
          metadata: { source: 'test' }
        },
        score: 0.9,
        metadata: { source: 'test' }
      }];

      const prompt = (rag as any).buildPrompt(query, results);
      expect(prompt).toContain(query);
      expect(prompt).toContain('Test');
    });
  });
}); 