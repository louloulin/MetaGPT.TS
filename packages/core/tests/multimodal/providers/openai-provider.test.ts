import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { OpenAIProvider } from '../../../src/multimodal/providers/openai-provider';
import type { ImageGenerationParams } from '../../../src/multimodal/multimodal-generator';

// Mock OpenAI client
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    images: {
      generate: jest.fn(),
    },
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockOpenAI: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create provider instance
    provider = new OpenAIProvider({
      apiKey: 'test-api-key',
      organization: 'test-org',
    });

    // Get the mocked OpenAI instance
    mockOpenAI = (jest.requireMock('openai') as jest.MockedClass<any>).mock.instances[0];
  });

  describe('generateImage', () => {
    test('should generate image successfully', async () => {
      const mockB64Json = 'mock-base64-image-data';
      mockOpenAI.images.generate.mockResolvedValue({
        created: Date.now(),
        data: [{ b64_json: mockB64Json }],
      });

      const params: ImageGenerationParams = {
        prompt: 'Test prompt',
        width: 512,
        height: 512,
        numInferenceSteps: 50,
        guidanceScale: 7.5,
      };

      const result = await provider.generateImage(params);
      
      expect(result.imageData).toBeDefined();
      expect(result.metadata.prompt).toBe(params.prompt);
      expect(result.metadata.parameters).toEqual(params);
      expect(mockOpenAI.images.generate).toHaveBeenCalledWith({
        model: 'dall-e-3',
        prompt: params.prompt,
        n: 1,
        size: '512x512',
        response_format: 'b64_json',
      });
    });

    test('should handle image generation error', async () => {
      mockOpenAI.images.generate.mockRejectedValue(new Error('API Error'));

      const params: ImageGenerationParams = {
        prompt: 'Test prompt',
        width: 512,
        height: 512,
        numInferenceSteps: 50,
        guidanceScale: 7.5,
      };

      await expect(provider.generateImage(params)).rejects.toThrow('API Error');
    });
  });

  describe('analyzeImage', () => {
    test('should analyze image successfully', async () => {
      const mockResponse = 'Mock image analysis';
      mockOpenAI.chat.completions.create.mockResolvedValue({
        id: 'mock-id',
        created: Date.now(),
        choices: [{ message: { content: mockResponse }, index: 0 }],
        usage: { total_tokens: 100 },
      });

      const imageData = Buffer.from('test-image-data');
      const prompt = 'Describe this image';

      const result = await provider.analyzeImage(imageData, prompt);
      
      expect(result).toBe(mockResponse);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4-vision-preview',
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              { type: 'text', text: prompt },
              expect.objectContaining({
                type: 'image_url',
                image_url: expect.any(Object),
              }),
            ]),
          }),
        ]),
        max_tokens: 1000,
      });
    });

    test('should handle analysis error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const imageData = Buffer.from('test-image-data');
      await expect(provider.analyzeImage(imageData)).rejects.toThrow('API Error');
    });
  });

  describe('combineModalities', () => {
    test('should combine modalities successfully', async () => {
      const mockResponse = 'Mock combined analysis';
      mockOpenAI.chat.completions.create.mockResolvedValue({
        id: 'mock-id',
        created: Date.now(),
        choices: [{ message: { content: mockResponse }, index: 0 }],
        usage: { total_tokens: 100 },
      });

      const text = 'Test text';
      const images = [Buffer.from('test-image-1'), Buffer.from('test-image-2')];

      const result = await provider.combineModalities(text, images);
      
      expect(result).toBe(mockResponse);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4-vision-preview',
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              { type: 'text', text },
              expect.objectContaining({
                type: 'image_url',
                image_url: expect.any(Object),
              }),
            ]),
          }),
        ]),
        max_tokens: 1000,
      });
    });

    test('should handle combination error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const text = 'Test text';
      const images = [Buffer.from('test-image')];
      await expect(provider.combineModalities(text, images)).rejects.toThrow('API Error');
    });
  });
}); 