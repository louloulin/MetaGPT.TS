import { vi } from 'vitest';

export const createMockLLM = () => ({
  chat: vi.fn().mockResolvedValue({ content: 'Mock response' }),
  generate: vi.fn().mockResolvedValue('Mock generated response'),
  setSystemPrompt: vi.fn(),
  getSystemPrompt: vi.fn().mockReturnValue('Mock system prompt'),
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
});

export const createMockVectorStore = () => ({
  getCollections: vi.fn().mockResolvedValue({ collections: [] }),
  createCollection: vi.fn().mockResolvedValue({}),
  upsert: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue({}),
  search: vi.fn().mockResolvedValue([
    {
      id: 'chunk1',
      score: 0.9,
      payload: { 
        content: 'Chunk 1 content', 
        metadata: { docId: 'doc1' } 
      }
    }
  ])
});

export const createMockMemory = () => ({
  add: vi.fn(),
  get: vi.fn().mockReturnValue([]),
  clear: vi.fn(),
  search: vi.fn().mockResolvedValue([]),
  setFocus: vi.fn(),
  getFocus: vi.fn(),
});

export const createMockWorkflow = () => ({
  id: 'test-workflow',
  state: 'running',
  tasks: [],
  addTask: vi.fn(),
  start: vi.fn().mockResolvedValue(true),
  cancel: vi.fn().mockResolvedValue(true),
}); 