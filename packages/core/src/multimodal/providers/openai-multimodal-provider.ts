/**
 * OpenAI Multimodal Provider
 * 
 * Implementation of the MultiModalProvider interface for OpenAI models
 * that support multimodal capabilities (e.g., GPT-4 Vision).
 */

import { z } from 'zod';
import OpenAI from 'openai';
import { encode as encodeBase64 } from 'base64-arraybuffer';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import {
  MediaType,
  ImageFormat,
  AudioFormat,
  VideoFormat,
  MediaContent,
  MultiModalMessage,
  MultiModalOptions,
  MultiModalProvider,
} from '../multimodal-provider';
import { logger } from '../../utils/logger';

// OpenAI-specific options
export interface OpenAIMultiModalOptions extends MultiModalOptions {
  /**
   * Base URL for OpenAI API
   */
  baseURL?: string;
  
  /**
   * Response format (e.g., json_object)
   */
  responseFormat?: 'text' | 'json_object';
  
  /**
   * Additional model parameters
   */
  modelParams?: Record<string, any>;
}

/**
 * Implementation of MultiModalProvider for OpenAI
 */
export class OpenAIMultiModalProvider implements MultiModalProvider {
  private openai: OpenAI;
  private supportedMediaTypes: MediaType[] = [MediaType.IMAGE]; // Start with image support
  private supportedModels: string[] = [
    'gpt-4-vision-preview',
    'gpt-4-turbo',
    'gpt-4o',
  ];
  
  /**
   * Create a new OpenAI multimodal provider
   * 
   * @param apiKey OpenAI API key
   * @param options Additional options for the OpenAI client
   */
  constructor(
    private apiKey: string,
    private options: Partial<OpenAI.ClientOptions> = {}
  ) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.openai = new OpenAI({
      apiKey,
      ...options,
    });
  }
  
  /**
   * Get the provider name
   */
  getName(): string {
    return 'openai';
  }
  
  /**
   * Get supported models
   */
  getSupportedModels(): string[] {
    return this.supportedModels;
  }
  
  /**
   * Get supported media types
   */
  getSupportedMediaTypes(): MediaType[] {
    return this.supportedMediaTypes;
  }
  
  /**
   * Generate a response to a multimodal prompt
   */
  async generateResponse(
    messages: MultiModalMessage[],
    options: OpenAIMultiModalOptions
  ): Promise<string> {
    try {
      const openaiMessages = await this.convertToOpenAIMessages(messages);
      
      const response = await this.openai.chat.completions.create({
        model: options.model,
        messages: openaiMessages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format: options.responseFormat 
          ? { type: options.responseFormat } 
          : undefined,
        ...options.modelParams,
      });
      
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Error in OpenAI multimodal generation:', error);
      throw new Error(`OpenAI multimodal generation failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Generate a streaming response to a multimodal prompt
   */
  async *generateResponseStream(
    messages: MultiModalMessage[],
    options: OpenAIMultiModalOptions
  ): AsyncIterable<string> {
    try {
      const openaiMessages = await this.convertToOpenAIMessages(messages);
      
      const stream = await this.openai.chat.completions.create({
        model: options.model,
        messages: openaiMessages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
        ...options.modelParams,
      });
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      logger.error('Error in OpenAI multimodal streaming:', error);
      throw new Error(`OpenAI multimodal streaming failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Analyze an image and return a description
   */
  async analyzeImage(
    imageData: string | Buffer | Uint8Array,
    format: ImageFormat,
    prompt: string = 'Describe this image in detail.'
  ): Promise<string> {
    try {
      // Convert image data to a format OpenAI can understand
      const processedImageData = await this.processImageData(imageData, format);
      
      const messages: MultiModalMessage[] = [
        {
          role: 'user',
          content: [
            { type: MediaType.IMAGE, data: processedImageData, format },
            prompt,
          ],
        },
      ];
      
      return await this.generateResponse(messages, {
        model: 'gpt-4-vision-preview',
        temperature: 0.5,
      });
    } catch (error) {
      logger.error('Error in OpenAI image analysis:', error);
      throw new Error(`OpenAI image analysis failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Analyze audio data (not fully supported by current OpenAI models)
   */
  async analyzeAudio(
    audioData: string | Buffer | Uint8Array,
    format: AudioFormat,
    prompt?: string
  ): Promise<string> {
    try {
      // Use OpenAI's audio transcription API for audio
      const file = await this.createTempFileFromData(audioData, `audio.${format}`);
      
      const transcription = await this.openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
      });
      
      // If a prompt was provided, send the transcription to the LLM for further analysis
      if (prompt) {
        const combinedPrompt = `${prompt}\n\nAudio Transcription: "${transcription.text}"`;
        
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo',
          messages: [
            { role: 'user', content: combinedPrompt },
          ],
          temperature: 0.5,
        });
        
        return response.choices[0]?.message?.content || transcription.text;
      }
      
      return transcription.text;
    } catch (error) {
      logger.error('Error in OpenAI audio analysis:', error);
      throw new Error(`OpenAI audio analysis failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Analyze video (not directly supported by current OpenAI models)
   */
  async analyzeVideo(
    videoData: string | Buffer | Uint8Array,
    format: VideoFormat,
    prompt?: string
  ): Promise<string> {
    // OpenAI doesn't directly support video analysis yet
    // In a real implementation, you might extract frames and analyze them
    throw new Error('Video analysis is not yet supported by OpenAI models');
  }
  
  /**
   * Convert MetaGPT multimodal messages to OpenAI format
   */
  private async convertToOpenAIMessages(
    messages: MultiModalMessage[]
  ): Promise<OpenAI.ChatCompletionMessageParam[]> {
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [];
    
    for (const message of messages) {
      if (typeof message.content === 'string') {
        // Simple text message
        openaiMessages.push({
          role: message.role,
          content: message.content,
        });
      } else {
        // Multimodal content
        const content: OpenAI.ChatCompletionContentPart[] = [];
        
        for (const part of message.content) {
          if (typeof part === 'string') {
            // Text part
            content.push({
              type: 'text',
              text: part,
            });
          } else if (part.type === MediaType.IMAGE) {
            // Image part
            const imageUrl = await this.getImageUrl(part);
            content.push({
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            });
          }
          // Future: Support for other media types
        }
        
        openaiMessages.push({
          role: message.role,
          content,
        });
      }
    }
    
    return openaiMessages;
  }
  
  /**
   * Get image URL from various formats
   */
  private async getImageUrl(media: MediaContent): Promise<string> {
    const { data } = media;
    
    // If data is already a URL, return it
    if (typeof data === 'string' && (data.startsWith('http') || data.startsWith('data:'))) {
      return data;
    }
    
    // If data is a file path, read it and convert to base64
    if (typeof data === 'string' && existsSync(data)) {
      const fileData = await readFile(data);
      return `data:image/${media.format || 'jpeg'};base64,${fileData.toString('base64')}`;
    }
    
    // If data is a Buffer or Uint8Array, convert to base64
    if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
      const base64 = Buffer.isBuffer(data) 
        ? data.toString('base64')
        : encodeBase64(data);
      return `data:image/${media.format || 'jpeg'};base64,${base64}`;
    }
    
    throw new Error('Unsupported image data format');
  }
  
  /**
   * Process image data into a format suitable for the provider
   */
  private async processImageData(
    data: string | Buffer | Uint8Array, 
    format: ImageFormat
  ): Promise<string> {
    // If data is already a URL or base64 string, return it
    if (typeof data === 'string') {
      if (data.startsWith('http') || data.startsWith('data:')) {
        return data;
      }
      
      // If it's a file path, read it
      if (existsSync(data)) {
        const fileData = await readFile(data);
        return `data:image/${format};base64,${fileData.toString('base64')}`;
      }
      
      // Assume it's already base64
      return `data:image/${format};base64,${data}`;
    }
    
    // Convert Buffer or Uint8Array to base64
    const base64 = Buffer.isBuffer(data) 
      ? data.toString('base64')
      : encodeBase64(data);
    
    return `data:image/${format};base64,${base64}`;
  }
  
  /**
   * Create a temporary file from data (for API calls that require files)
   */
  private async createTempFileFromData(
    data: string | Buffer | Uint8Array,
    filename: string
  ): Promise<File> {
    let buffer: Buffer;
    
    if (typeof data === 'string') {
      if (existsSync(data)) {
        buffer = await readFile(data);
      } else if (data.startsWith('data:')) {
        // Extract base64 part
        const base64Data = data.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(data, 'utf-8');
      }
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      buffer = Buffer.from(data);
    }
    
    return new File([buffer], filename);
  }
} 