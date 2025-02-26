import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseRAG } from '../../src/rag/base-rag';
import type { Document } from '../../src/types/document';
import type { RAGConfig, Chunk, SearchResult } from '../../src/rag/types';

// Mock dependencies
vi.mock('@qdrant/js-client-rest', () => {
  const QdrantClient = vi.fn().mockImplementation(() => ({
    getCollections: vi.fn().mockResolvedValue({ collections: [] }),
    createCollection: vi.fn().mockResolvedValue({}),
    upsert: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue({
      points: [
        { id: 'chunk1', score: 0.9, payload: { content: 'Chunk 1 content', metadata: { docId: 'doc1' } } },
        { id: 'chunk2', score: 0.8, payload: { content: 'Chunk 2 content', metadata: { docId: 'doc1' } } }
      ]
    })
  }));
  
  return { 
    QdrantClient
  };
});

// Mock embedding service
vi.mock('../../src/ai/embedding', () => ({
  getEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4])
}));

describe('BaseRAG', () => {
  let rag: BaseRAG;
  const defaultConfig: RAGConfig = {
    vectorStore: {
      url: 'http://localhost:6333',
      collectionName: 'test_collection',
      dimension: 384,
      distance: 'Cosine'
    },
    embedding: {
      model: 'paraphrase-multilingual-mpnet-base-v2',
      batchSize: 32
    },
    chunking: {
      chunkSize: 1000,
      chunkOverlap: 200
    },
    topK: 3
  };
  
  beforeEach(() => {
    rag = new BaseRAG(defaultConfig);
    
    // Mock protected methods for testing
    (rag as any).generateEmbedding = vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Initialization', () => {
    it('should initialize with custom configuration', () => {
      expect(rag).toBeDefined();
      expect((rag as any).config.vectorStore.collectionName).toBe('test_collection');
    });
  });
  
  describe('Document Management', () => {
    it('should add a document', async () => {
      const chunks = await rag.addDocument('Document content for testing. This is a test document.', { 
        title: 'Test Document',
        docId: 'doc1'
      });
      
      // Verify the document was chunked and indexed
      expect(chunks.length).toBeGreaterThan(0);
      expect((rag as any).vectorStore.upsert).toHaveBeenCalled();
    });
    
    it('should delete chunks', async () => {
      await rag.deleteChunks(['chunk1', 'chunk2']);
      
      expect((rag as any).vectorStore.delete).toHaveBeenCalled();
    });
    
    it('should update a chunk', async () => {
      const chunk: Chunk = {
        id: 'chunk1',
        content: 'Updated chunk content',
        embedding: [0.1, 0.2, 0.3],
        metadata: { docId: 'doc1', title: 'Updated Document' }
      };
      
      await rag.updateChunk(chunk);
      
      expect((rag as any).vectorStore.upsert).toHaveBeenCalled();
    });
  });
  
  describe('Search and Generate', () => {
    it('should search for relevant documents', async () => {
      const results = await rag.search('test query');
      
      expect((rag as any).vectorStore.search).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.content).toBeDefined();
      expect(results[0].score).toBeGreaterThan(0);
    });
    
    it('should generate an answer', async () => {
      // Mock the LLM service
      (rag as any).llm = {
        generate: vi.fn().mockResolvedValue('Generated answer based on context')
      };
      
      const answer = await rag.generate('What is the test about?');
      
      expect((rag as any).llm.generate).toHaveBeenCalled();
      expect(answer).toBe('Generated answer based on context');
    });
    
    it('should build a prompt with context', async () => {
      const searchResults: SearchResult[] = [
        { 
          chunk: { 
            id: 'chunk1', 
            content: 'Chunk 1 content', 
            embedding: [0.1, 0.2, 0.3], 
            metadata: { docId: 'doc1' } 
          },
          score: 0.9,
          metadata: { docId: 'doc1' }
        },
        { 
          chunk: { 
            id: 'chunk2', 
            content: 'Chunk 2 content', 
            embedding: [0.4, 0.5, 0.6], 
            metadata: { docId: 'doc1' } 
          },
          score: 0.8,
          metadata: { docId: 'doc1' }
        }
      ];
      
      const prompt = (rag as any).buildPrompt('What is the test about?', searchResults);
      
      expect(prompt).toContain('Chunk 1 content');
      expect(prompt).toContain('Chunk 2 content');
      expect(prompt).toContain('What is the test about?');
    });
  });
}); 