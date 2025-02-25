import { describe, expect, test, mock } from 'bun:test';
import { VercelLLMProvider, VercelLLMConfigSchema } from '../src/provider/vercel-llm';
import { LLMConfigSchema } from '../src/types/llm';

describe('LLM System', () => {
  describe('Config Validation', () => {
    test('LLMConfig validation', () => {
      expect(() => LLMConfigSchema.parse({})).not.toThrow();
      expect(() => LLMConfigSchema.parse({ model: 'gpt-4' })).not.toThrow();
      expect(() => LLMConfigSchema.parse({ temperature: 3 })).toThrow();
    });

    test('VercelLLMConfig validation', () => {
      expect(() => VercelLLMConfigSchema.parse({ apiKey: 'test' })).not.toThrow();
      expect(() => VercelLLMConfigSchema.parse({})).toThrow();
    });
  });

  describe('VercelLLMProvider', () => {
    const mockConfig = {
      apiKey: 'test-key',
    };

    const mockCompletion = {
      choices: [{ text: 'test response' }],
    };

    const mockEmbedding = {
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    };

    test('should generate text', async () => {
      const provider = new VercelLLMProvider(mockConfig);
      // @ts-ignore: Mock implementation
      provider.client = {
        createCompletion: mock(() => Promise.resolve(mockCompletion)),
      };

      const result = await provider.generate('test prompt');
      expect(result).toBe('test response');
    });

    test('should generate text stream', async () => {
      const provider = new VercelLLMProvider(mockConfig);
      const mockStream = async function* () {
        yield { choices: [{ text: 'chunk1' }] };
        yield { choices: [{ text: 'chunk2' }] };
      };

      // @ts-ignore: Mock implementation
      provider.client = {
        createCompletionStream: mock(() => mockStream()),
      };

      const chunks: string[] = [];
      for await (const chunk of provider.generateStream('test prompt')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['chunk1', 'chunk2']);
    });

    test('should create embeddings', async () => {
      const provider = new VercelLLMProvider(mockConfig);
      // @ts-ignore: Mock implementation
      provider.client = {
        createEmbedding: mock(() => Promise.resolve(mockEmbedding)),
      };

      const result = await provider.embed('test text');
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    test('should handle errors', async () => {
      const provider = new VercelLLMProvider(mockConfig);
      // @ts-ignore: Mock implementation
      provider.client = {
        createCompletion: mock(() => Promise.reject(new Error('API Error'))),
      };

      await expect(provider.generate('test prompt')).rejects.toThrow('API Error');
    });
  });
}); 