import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { MultimodalGenerator } from '../../src/multimodal/multimodal-generator';
import type { ImageGenerationParams, MultimodalProvider } from '../../src/multimodal/multimodal-generator';

// Mock provider implementation
class MockMultimodalProvider implements MultimodalProvider {
  async generateImage(params: ImageGenerationParams) {
    return {
      imageData: Buffer.from('mock-image-data'),
      metadata: {
        prompt: params.prompt,
        seed: 123,
        parameters: params,
      },
    };
  }

  async analyzeImage(imageData: Buffer, prompt?: string) {
    return 'Mock image analysis result';
  }

  async combineModalities(text: string, images: Buffer[]) {
    return 'Mock combined modalities result';
  }
}

describe('MultimodalGenerator', () => {
  let generator: MultimodalGenerator;
  let provider: MockMultimodalProvider;

  beforeEach(() => {
    provider = new MockMultimodalProvider();
    generator = new MultimodalGenerator(provider);
  });

  describe('generateImage', () => {
    test('should generate image with valid parameters', async () => {
      const params: ImageGenerationParams = {
        prompt: 'Test prompt',
        width: 512,
        height: 512,
        numInferenceSteps: 50,
        guidanceScale: 7.5,
      };

      const result = await generator.generateImage(params);
      expect(result.imageData).toBeDefined();
      expect(result.metadata.prompt).toBe(params.prompt);
      expect(result.metadata.parameters).toEqual(params);
    });

    test('should throw error with invalid parameters', async () => {
      const invalidParams = {
        prompt: 'Test prompt',
        width: 0, // Invalid width
        height: 512,
      } as ImageGenerationParams;

      await expect(generator.generateImage(invalidParams)).rejects.toThrow();
    });
  });

  describe('analyzeImage', () => {
    test('should analyze image successfully', async () => {
      const imageData = Buffer.from('test-image-data');
      const prompt = 'Describe this image';

      const result = await generator.analyzeImage(imageData, prompt);
      expect(result).toBe('Mock image analysis result');
    });

    test('should analyze image without prompt', async () => {
      const imageData = Buffer.from('test-image-data');

      const result = await generator.analyzeImage(imageData);
      expect(result).toBe('Mock image analysis result');
    });
  });

  describe('createPlan', () => {
    test('should create valid multimodal plan', async () => {
      const task = 'Create a visual story';
      const context = { theme: 'nature' };

      const plan = await generator.createPlan(task, context);
      expect(plan.steps).toBeDefined();
      expect(Array.isArray(plan.steps)).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(0);
    });

    test('should cache created plan', async () => {
      const task = 'Test task';
      const plan = await generator.createPlan(task);
      const cachedPlan = generator.getCachedPlan(task);
      expect(cachedPlan).toEqual(plan);
    });
  });

  describe('executePlan', () => {
    test('should execute plan successfully', async () => {
      const plan = await generator.createPlan('Test task');
      const results = await generator.executePlan(plan, { text: 'Test context' });
      expect(results).toBeDefined();
    });

    test('should handle plan execution errors', async () => {
      const invalidPlan = {
        steps: [{
          type: 'invalid' as any,
          action: 'test',
          inputs: {},
          outputs: {},
        }],
      };

      await expect(generator.executePlan(invalidPlan, {})).rejects.toThrow();
    });
  });

  describe('planCache', () => {
    test('should clear plan cache', async () => {
      const task = 'Test task';
      await generator.createPlan(task);
      expect(generator.getCachedPlan(task)).toBeDefined();

      generator.clearPlanCache();
      expect(generator.getCachedPlan(task)).toBeUndefined();
    });
  });
}); 