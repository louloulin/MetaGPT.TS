import { describe, expect, it, mock } from 'bun:test';
import axios from 'axios';
import { BailianLLMProvider } from '../../src/provider/bailian-llm';
import type { BailianLLMConfig } from '../../src/provider/bailian-llm';

describe('BailianLLMProvider', () => {
  const config: BailianLLMConfig = {
    apiKey: 'test-api-key',
    secretKey: 'test-secret-key',
    baseURL: 'https://test-bailian-api.com',
    model: 'test-model',
  };

  it('should generate text correctly', async () => {
    // Mock axios.post
    const originalPost = axios.post;
    
    try {
      // Replace with mock implementation
      axios.post = mock(() => 
        Promise.resolve({
          data: {
            output: {
              text: '这是百炼大模型的回答',
            },
          },
        })
      );

      const provider = new BailianLLMProvider(config);
      const result = await provider.generate('测试提示词');

      expect(result).toBe('这是百炼大模型的回答');
    } finally {
      // Restore original implementation
      axios.post = originalPost;
    }
  });

  it('should handle errors properly', async () => {
    // Mock axios.post
    const originalPost = axios.post;
    
    try {
      // Replace with mock implementation that throws
      axios.post = mock(() => 
        Promise.reject({
          isAxiosError: true,
          response: {
            status: 401,
            data: { error: 'Unauthorized' },
          },
          message: 'Request failed with status code 401',
        })
      );

      const provider = new BailianLLMProvider(config);
      
      try {
        await provider.generate('测试提示词');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        expect((error as Error).message).toContain('Bailian API Error: 401');
      }
    } finally {
      // Restore original implementation
      axios.post = originalPost;
    }
  });

  it('should create embeddings correctly', async () => {
    // Mock axios.post
    const originalPost = axios.post;
    
    try {
      // Setup mock response with an embedding vector
      const mockEmbedding = Array(1536).fill(0).map(() => Math.random());
      
      // Replace with mock implementation
      axios.post = mock(() => 
        Promise.resolve({
          data: {
            embedding: mockEmbedding,
          },
        })
      );

      const provider = new BailianLLMProvider(config);
      const result = await provider.embed('测试文本');

      expect(result).toEqual(mockEmbedding);
    } finally {
      // Restore original implementation
      axios.post = originalPost;
    }
  });
}); 