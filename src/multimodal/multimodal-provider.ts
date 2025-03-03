/**
 * Multimodal Provider Interface
 * 
 * This module defines interfaces and types for multimodal capabilities in MetaGPT.
 * It provides abstractions for handling different types of media including images,
 * audio, and video alongside text.
 */

import { z } from 'zod';

/**
 * Supported media types for multimodal inputs
 */
export enum MediaType {
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
}

/**
 * Image formats supported by multimodal providers
 */
export enum ImageFormat {
  PNG = 'png',
  JPEG = 'jpeg',
  GIF = 'gif',
  WEBP = 'webp',
}

/**
 * Audio formats supported by multimodal providers
 */
export enum AudioFormat {
  MP3 = 'mp3',
  WAV = 'wav',
  OGG = 'ogg',
}

/**
 * Video formats supported by multimodal providers
 */
export enum VideoFormat {
  MP4 = 'mp4',
  WEBM = 'webm',
}

/**
 * Media content schema for zod validation
 */
export const MediaContentSchema = z.object({
  type: z.nativeEnum(MediaType),
  data: z.union([
    z.string(), // URL, base64, or file path
    z.instanceof(Buffer), // Binary data
    z.instanceof(Uint8Array), // Binary data
  ]),
  format: z.union([
    z.nativeEnum(ImageFormat).optional(),
    z.nativeEnum(AudioFormat).optional(),
    z.nativeEnum(VideoFormat).optional(),
  ]),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Type for media content with typed data
 */
export type MediaContent = z.infer<typeof MediaContentSchema>;

/**
 * Schema for multimodal message
 */
export const MultiModalMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.union([
    z.string(),
    z.array(z.union([z.string(), MediaContentSchema])),
  ]),
});

/**
 * Type for multimodal message
 */
export type MultiModalMessage = z.infer<typeof MultiModalMessageSchema>;

/**
 * Options for multimodal generation
 */
export interface MultiModalOptions {
  /**
   * Model to use for multimodal processing
   */
  model: string;
  
  /**
   * Temperature for generation
   */
  temperature?: number;
  
  /**
   * Maximum number of tokens to generate
   */
  maxTokens?: number;
  
  /**
   * Additional provider-specific options
   */
  [key: string]: any;
}

/**
 * Interface for multimodal providers
 */
export interface MultiModalProvider {
  /**
   * Get the provider name
   */
  getName(): string;
  
  /**
   * Get supported models for this provider
   */
  getSupportedModels(): string[];
  
  /**
   * Get supported media types for this provider
   */
  getSupportedMediaTypes(): MediaType[];
  
  /**
   * Generate a response to a multimodal prompt
   * 
   * @param messages Array of messages with possible media content
   * @param options Generation options
   * @returns Promise with the generated text response
   */
  generateResponse(
    messages: MultiModalMessage[],
    options: MultiModalOptions
  ): Promise<string>;
  
  /**
   * Generate a response to a multimodal prompt with streaming
   * 
   * @param messages Array of messages with possible media content
   * @param options Generation options
   * @returns AsyncIterable of text chunks
   */
  generateResponseStream(
    messages: MultiModalMessage[],
    options: MultiModalOptions
  ): AsyncIterable<string>;
  
  /**
   * Analyze an image and return a description
   * 
   * @param imageData Image data as URL, base64, or Buffer
   * @param format Image format
   * @param prompt Optional prompt to guide the analysis
   * @returns Promise with the image analysis
   */
  analyzeImage(
    imageData: string | Buffer | Uint8Array,
    format: ImageFormat,
    prompt?: string
  ): Promise<string>;
  
  /**
   * Analyze audio and return a transcription or description
   * 
   * @param audioData Audio data as URL, base64, or Buffer
   * @param format Audio format
   * @param prompt Optional prompt to guide the analysis
   * @returns Promise with the audio analysis
   */
  analyzeAudio(
    audioData: string | Buffer | Uint8Array,
    format: AudioFormat,
    prompt?: string
  ): Promise<string>;
  
  /**
   * Analyze video and return a description
   * 
   * @param videoData Video data as URL, base64, or Buffer
   * @param format Video format
   * @param prompt Optional prompt to guide the analysis
   * @returns Promise with the video analysis
   */
  analyzeVideo(
    videoData: string | Buffer | Uint8Array,
    format: VideoFormat,
    prompt?: string
  ): Promise<string>;
} 