/**
 * Stability AI Multimodal Provider
 * 
 * This module provides integration with Stability AI's APIs for generating 
 * and analyzing images. It implements the MultiModalProvider interface.
 */

import { z } from 'zod';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MediaType, ImageFormat, AudioFormat, VideoFormat, type MultiModalProvider, type MultiModalMessage, type MultiModalOptions } from '../multimodal-provider';
import { logger } from '../../utils/logger';

// Configuration schema for Stability AI provider
const StabilityConfigSchema = z.object({
  apiKey: z.string().min(1),
  options: z.object({
    apiVersion: z.enum(['v1']).default('v1'),
    defaultEngine: z.string().default('stable-diffusion-xl-1024-v1-0'),
    // Default parameters for image generation
    samplingDefaults: z.object({
      cfgScale: z.number().min(0).max(35).default(7.0),
      steps: z.number().min(10).max(150).default(30),
      samples: z.number().min(1).max(10).default(1),
    }).optional(),
  }).optional(),
});

type StabilityConfig = z.infer<typeof StabilityConfigSchema>;

/**
 * Stability AI Multimodal Provider implementation
 */
export class StabilityMultiModalProvider implements MultiModalProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.stability.ai';
  private apiVersion: string;
  private defaultEngine: string;
  private samplingDefaults: {
    cfgScale: number;
    steps: number;
    samples: number;
  };
  private client: AxiosInstance;
  
  constructor(config: StabilityConfig) {
    const validatedConfig = StabilityConfigSchema.parse(config);
    
    this.apiKey = validatedConfig.apiKey;
    this.apiVersion = validatedConfig.options?.apiVersion || 'v1';
    this.defaultEngine = validatedConfig.options?.defaultEngine || 'stable-diffusion-xl-1024-v1-0';
    this.samplingDefaults = validatedConfig.options?.samplingDefaults || {
      cfgScale: 7.0,
      steps: 30,
      samples: 1,
    };
    
    // Initialize HTTP client
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      timeout: 60000, // 60 seconds timeout
    });
    
    logger.info(`Initialized Stability AI provider with engine: ${this.defaultEngine}`);
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'StabilityAI';
  }
  
  /**
   * Get supported models
   */
  getSupportedModels(): string[] {
    return [
      'stable-diffusion-xl-1024-v1-0',
      'stable-diffusion-xl-beta-v2-2-2', 
      'stable-diffusion-v1-5',
      'esrgan-v1-x2plus',  // upscaling model
    ];
  }
  
  /**
   * Get supported media types
   */
  getSupportedMediaTypes(): MediaType[] {
    return [MediaType.IMAGE]; // Stability AI only supports image generation
  }
  
  /**
   * Check if the provider supports a specific model
   */
  supportsModel(model: string): boolean {
    return this.getSupportedModels().includes(model);
  }
  
  /**
   * Generate a response for a set of multimodal messages
   */
  async generateResponse(
    messages: MultiModalMessage[],
    options: MultiModalOptions
  ): Promise<string> {
    // Extract image generation requests from messages
    const imageGenerationRequests = this.extractImageGenerationRequests(messages);
    
    if (imageGenerationRequests.length > 0) {
      try {
        const prompt = imageGenerationRequests[0].prompt;
        const imageData = await this.generateImageFromPrompt(prompt, options);
        
        // In a real implementation, we might return a base64 encoded image or a URL
        return `I've generated an image based on your prompt: "${prompt}"`;
      } catch (error: any) {
        logger.error(`Failed to generate image: ${error.message}`);
        return `I'm sorry, I couldn't generate the image. Error: ${error.message}`;
      }
    }
    
    // If no image generation requests, return a default message
    return "I'm a multimodal AI assistant powered by Stability AI. I can generate images from your text prompts.";
  }
  
  /**
   * Generate a streaming response for a set of multimodal messages
   */
  async *generateResponseStream(
    messages: MultiModalMessage[],
    options: MultiModalOptions
  ): AsyncGenerator<string> {
    // For simplicity, we'll just yield the entire response at once
    // In a production environment, you might implement actual streaming
    const response = await this.generateResponse(messages, options);
    yield response;
  }
  
  /**
   * Generate an image from a text prompt
   */
  async generateImageFromPrompt(
    prompt: string,
    options: {
      model?: string;
      width?: number;
      height?: number;
      samplingParams?: {
        cfgScale?: number;
        steps?: number;
        samples?: number;
      };
      negativePrompt?: string;
    } = {}
  ): Promise<Buffer> {
    try {
      const model = options.model || this.defaultEngine;
      const width = options.width || 1024;
      const height = options.height || 1024;
      
      const samplingParams = {
        cfgScale: options.samplingParams?.cfgScale || this.samplingDefaults.cfgScale,
        steps: options.samplingParams?.steps || this.samplingDefaults.steps,
        samples: options.samplingParams?.samples || this.samplingDefaults.samples,
      };
      
      logger.info(`Generating image with Stability AI, prompt: "${prompt.substring(0, 30)}..."`);
      
      const requestBody = {
        text_prompts: [
          {
            text: prompt,
            weight: 1.0,
          },
        ],
        cfg_scale: samplingParams.cfgScale,
        height,
        width,
        steps: samplingParams.steps,
        samples: samplingParams.samples,
      };
      
      // Add negative prompt if provided
      if (options.negativePrompt) {
        requestBody.text_prompts.push({
          text: options.negativePrompt,
          weight: -1.0,
        });
      }
      
      // In a real implementation, this would make an actual API call
      // to Stability AI's text-to-image endpoint
      // For demonstration purposes, we're just returning a placeholder buffer
      
      // Simulating API call latency
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      logger.info('Image generation completed (simulated)');
      
      // Return a placeholder buffer
      // In a real implementation, this would parse the API response and return the image data
      return Buffer.from('placeholder-image-data');
      
    } catch (error: any) {
      logger.error(`Image generation failed: ${error.message}`);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }
  
  /**
   * Analyze an image and return information about it
   */
  async analyzeImage(
    imageData: string | Buffer | Uint8Array,
    format: ImageFormat,
    prompt?: string
  ): Promise<string> {
    // Stability AI doesn't have a dedicated image analysis API
    // This is a placeholder for potential future functionality
    logger.warn('Image analysis is not directly supported by Stability AI');
    
    return "Image analysis not supported by Stability AI";
  }
  
  /**
   * Analyze audio and return information about it
   */
  async analyzeAudio(
    audioData: string | Buffer | Uint8Array,
    format: AudioFormat,
    prompt?: string
  ): Promise<string> {
    // Stability AI doesn't currently support audio analysis
    logger.warn('Audio analysis is not supported by Stability AI');
    
    return "Audio analysis not supported by Stability AI";
  }
  
  /**
   * Analyze video and return information about it
   */
  async analyzeVideo(
    videoData: string | Buffer | Uint8Array,
    format: VideoFormat,
    prompt?: string
  ): Promise<string> {
    // Stability AI doesn't currently support video analysis
    logger.warn('Video analysis is not supported by Stability AI');
    
    return "Video analysis not supported by Stability AI";
  }
  
  /**
   * Extract image generation requests from multimodal messages
   * @private
   */
  private extractImageGenerationRequests(messages: MultiModalMessage[]): Array<{ prompt: string }> {
    const requests: Array<{ prompt: string }> = [];
    
    for (const message of messages) {
      if (typeof message.content === 'string') {
        // Check if the message is asking for image generation
        // This is a simple heuristic - in a real application, you might use more sophisticated detection
        const content = message.content.toLowerCase();
        if (
          content.includes('generate an image') ||
          content.includes('create an image') ||
          content.includes('draw') ||
          content.includes('picture of')
        ) {
          requests.push({ prompt: message.content });
        }
      }
    }
    
    return requests;
  }
  
  /**
   * Process image data from various formats
   * @private
   */
  private async processImageData(imageData: string | Buffer): Promise<Buffer> {
    if (Buffer.isBuffer(imageData)) {
      return imageData;
    }
    
    if (typeof imageData === 'string') {
      // Check if it's a file path
      if (imageData.startsWith('file://')) {
        const filePath = imageData.substring(7);
        return await fs.readFile(filePath);
      }
      
      // Check if it's a base64 encoded string
      if (imageData.startsWith('data:image')) {
        const base64Data = imageData.split(',')[1] || '';
        return Buffer.from(base64Data, 'base64');
      }
      
      // Assume it's a URL
      try {
        const response = await axios.get(imageData, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
      } catch (error) {
        logger.error(`Failed to fetch image from URL: ${error}`);
        throw new Error(`Failed to process image URL: ${error}`);
      }
    }
    
    throw new Error('Unsupported image data format');
  }
} 