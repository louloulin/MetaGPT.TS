/**
 * OpenAI Multimodal Provider
 * 
 * This module implements the MultimodalProvider interface using OpenAI's APIs
 * for image generation (DALL-E), image analysis (GPT-4V), and multimodal reasoning.
 */

import OpenAI from 'openai';
import { logger } from '../../utils/logger';
import type { 
  ImageGenerationParams,
  ImageGenerationResult,
  MultimodalProvider,
} from '../multimodal-generator';

export interface OpenAIProviderConfig {
  apiKey: string;
  organization: string;
  model?: string;
  maxRetries?: number;
}

export class OpenAIProvider implements MultimodalProvider {
  private client: OpenAI;
  private config: Required<OpenAIProviderConfig>;

  constructor(config: OpenAIProviderConfig) {
    this.config = {
      model: 'gpt-4-vision-preview',
      maxRetries: 3,
      organization: config.organization,
      apiKey: config.apiKey,
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      organization: this.config.organization,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Generate an image using DALL-E
   */
  public async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
    try {
      logger.info(`Generating image with DALL-E: ${params.prompt}`);

      // Map the input dimensions to DALL-E supported sizes
      let size: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
      if (params.width <= 256 && params.height <= 256) {
        size = '256x256';
      } else if (params.width <= 512 && params.height <= 512) {
        size = '512x512';
      } else if (params.width === 1792 && params.height === 1024) {
        size = '1792x1024';
      } else if (params.width === 1024 && params.height === 1792) {
        size = '1024x1792';
      } else {
        size = '1024x1024';
      }

      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: params.prompt,
        n: 1,
        size,
        response_format: 'b64_json',
      });

      if (!response.data[0]?.b64_json) {
        throw new Error('No image data received from DALL-E');
      }

      const imageData = Buffer.from(response.data[0].b64_json, 'base64');
      const seed = Math.floor(Math.random() * 1000000);

      return {
        imageData,
        metadata: {
          prompt: params.prompt,
          seed,
          parameters: params,
        },
      };
    } catch (error) {
      logger.error(`DALL-E image generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Analyze an image using GPT-4V
   */
  public async analyzeImage(imageData: Buffer, prompt?: string): Promise<string> {
    try {
      logger.info('Analyzing image with GPT-4V');

      const base64Image = imageData.toString('base64');
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt || 'Please describe this image in detail.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ];

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages as any, // Type assertion needed due to OpenAI types
        max_tokens: 1000,
      });

      const analysis = response.choices[0]?.message?.content;
      if (!analysis) {
        throw new Error('No analysis received from GPT-4V');
      }

      return analysis;
    } catch (error) {
      logger.error(`GPT-4V image analysis failed: ${error}`);
      throw error;
    }
  }

  /**
   * Combine text and images for multimodal reasoning
   */
  public async combineModalities(text: string, images: Buffer[]): Promise<string> {
    try {
      logger.info('Performing multimodal reasoning with GPT-4V');

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: text },
            ...images.map(imageData => ({
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageData.toString('base64')}`,
              },
            })),
          ],
        },
      ];

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages as any, // Type assertion needed due to OpenAI types
        max_tokens: 1000,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No result received from GPT-4V');
      }

      return result;
    } catch (error) {
      logger.error(`GPT-4V multimodal reasoning failed: ${error}`);
      throw error;
    }
  }
} 