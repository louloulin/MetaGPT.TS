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
    
    // Mock initializeCollection to prevent real server calls
    vi.spyOn(BaseRAG.prototype as any, 'initializeCollection').mockResolvedValue(undefined);
    
    rag = new BaseRAG({
      llm: mockLLM,
      vectorStore: {
        url: 'http://localhost:6333',
        collectionName: 'test-collection',
        dimension: 384,
        distance: 'Cosine'
      },
      chunkSize: 100,
      chunkOverlap: 20,
      topK: 5,
      minScore: 0.7
    });
    
    // Mock protected methods
    (rag as any).vectorStore = mockVectorStore;
    (rag as any).llm = mockLLM;
  });

  describe('Document Management', () => {
    it('should add a document', async () => {
      const content = 'Test content';
      const metadata = { source: 'test' };

      await rag.addDocument(content, metadata);
      expect(mockVectorStore.upsert).toHaveBeenCalled();
    });

    it('should handle large document chunking', async () => {
      const content = 'This is a test document that needs to be split into multiple chunks. ' +
                     'It should be long enough to create at least two chunks but not too long ' +
                     'to cause memory issues. We will verify the chunking behavior.';
      const metadata = { source: 'test' };

      await rag.addDocument(content, metadata);
      
      // Should create multiple chunks
      const upsertCall = mockVectorStore.upsert.mock.calls[0][1];
      expect(upsertCall.points.length).toBeGreaterThan(1);
      
      // Verify chunk overlap
      const firstChunk = upsertCall.points[0];
      const secondChunk = upsertCall.points[1];
      expect(firstChunk.payload.content.length).toBeLessThanOrEqual(100);
      expect(secondChunk.payload.metadata.start_index).toBeLessThan(100);
    });

    it('should handle document with natural breaks', async () => {
      const content = 'First sentence.\nSecond sentence.\nThird sentence.';
      const metadata = { source: 'test' };

      await rag.addDocument(content, metadata);
      
      const upsertCall = mockVectorStore.upsert.mock.calls[0][1];
      expect(upsertCall.points[0].payload.content).toBe(content);
    });

    it('should delete chunks', async () => {
      const ids = ['chunk1', 'chunk2'];
      await rag.deleteChunks(ids);

      expect(mockVectorStore.delete).toHaveBeenCalledWith('test-collection', {
        points: ids,
      });
    });

    it('should handle empty chunk deletion', async () => {
      await rag.deleteChunks([]);
      expect(mockVectorStore.delete).not.toHaveBeenCalled();
    });

    it('should update a chunk', async () => {
      const chunk: Chunk = {
        id: 'chunk1',
        content: 'Updated content',
        embedding: [0.1, 0.2, 0.3],
        metadata: { source: 'test' }
      };

      await rag.updateChunk(chunk);
      expect(mockVectorStore.upsert).toHaveBeenCalled();
    });
  });

  describe('Search and Generate', () => {
    it('should search for relevant documents', async () => {
      const query = 'test query';
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockSearchResults = [
        {
          id: 'chunk1',
          score: 0.9,
          payload: {
            content: 'Test content',
            metadata: { source: 'test' }
          }
        }
      ];
      
      mockVectorStore.search.mockResolvedValueOnce(mockSearchResults);
      
      const results = await rag.search(query);

      expect(mockVectorStore.search).toHaveBeenCalledWith('test-collection', {
        vector: mockEmbedding,
        limit: 5,
        with_payload: true,
        score_threshold: 0.7
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.content).toBeDefined();
    });

    it('should handle empty search results', async () => {
      const query = 'test query';
      mockVectorStore.search.mockResolvedValueOnce([]);
      
      const results = await rag.search(query);
      expect(results).toHaveLength(0);
    });

    it('should handle search errors gracefully', async () => {
      const query = 'test query';
      mockVectorStore.search.mockRejectedValueOnce(new Error('Search failed'));
      
      const results = await rag.search(query);
      expect(results).toHaveLength(0);
    });

    it('should generate an answer', async () => {
      const query = 'test query';
      const mockSearchResults = [{
        chunk: {
          id: 'chunk1',
          content: 'Test content',
          embedding: [0.1, 0.2, 0.3],
          metadata: { source: 'test' }
        },
        score: 0.9,
        metadata: { source: 'test' }
      }];

      (rag as any).search = vi.fn().mockResolvedValueOnce(mockSearchResults);
      
      await rag.generate(query);
      
      expect(mockLLM.generate).toHaveBeenCalled();
    });

    it('should handle generation with no relevant documents', async () => {
      const query = 'test query';
      (rag as any).search = vi.fn().mockResolvedValueOnce([]);
      
      const result = await rag.generate(query);
      expect(result).toBe('No relevant information found.');
    });

    it('should handle generation errors gracefully', async () => {
      const query = 'test query';
      mockLLM.generate.mockRejectedValueOnce(new Error('Generation failed'));
      (rag as any).search = vi.fn().mockResolvedValueOnce([{
        chunk: {
          id: 'chunk1',
          content: 'Test content',
          embedding: [0.1, 0.2, 0.3],
          metadata: { source: 'test' }
        },
        score: 0.9,
        metadata: { source: 'test' }
      }]);
      
      const result = await rag.generate(query);
      expect(result).toContain('Error generating answer');
    });
  });

  describe('Prompt Building', () => {
    it('should build prompt with query and results', () => {
      const query = 'test query';
      const results = [{
        chunk: {
          id: 'chunk1',
          content: 'Test content',
          embedding: [0.1, 0.2, 0.3],
          metadata: { source: 'test' }
        },
        score: 0.9,
        metadata: { source: 'test' }
      }];

      const prompt = (rag as any).buildPrompt(query, results);
      
      expect(prompt).toContain(query);
      expect(prompt).toContain('Test content');
      expect(prompt).toContain('Based on the following passages');
    });

    it('should format multiple results in prompt', () => {
      const query = 'test query';
      const results = [
        {
          chunk: {
            id: 'chunk1',
            content: 'First content',
            embedding: [0.1, 0.2, 0.3],
            metadata: { source: 'test1' }
          },
          score: 0.9,
          metadata: { source: 'test1' }
        },
        {
          chunk: {
            id: 'chunk2',
            content: 'Second content',
            embedding: [0.4, 0.5, 0.6],
            metadata: { source: 'test2' }
          },
          score: 0.8,
          metadata: { source: 'test2' }
        }
      ];

      const prompt = (rag as any).buildPrompt(query, results);
      
      expect(prompt).toContain('[1]');
      expect(prompt).toContain('[2]');
      expect(prompt).toContain('First content');
      expect(prompt).toContain('Second content');
    });
  });
}); 