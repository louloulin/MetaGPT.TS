/**
 * @module LLM
 * @category Core
 */

import { z } from 'zod';

/**
 * LLM configuration schema
 * Defines settings for language model operations
 */
export const LLMConfigSchema = z.object({
  /** API key for authentication */
  apiKey: z.string(),
  /** Model name (e.g., 'gpt-4') */
  model: z.string().default('gpt-4'),
  /** Temperature for response generation */
  temperature: z.number().min(0).max(2).default(0.7),
  /** Maximum tokens in response */
  maxTokens: z.number().min(1).default(2000),
  /** Top P sampling */
  topP: z.number().min(0).max(1).default(1),
  /** Frequency penalty */
  frequencyPenalty: z.number().min(-2).max(2).default(0),
  /** Presence penalty */
  presencePenalty: z.number().min(-2).max(2).default(0),
  /** Base URL for API */
  baseURL: z.string().optional(),
  /** Organization ID */
  organization: z.string().optional(),
  /** Proxy URL */
  proxy: z.string().optional(),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

/**
 * LLM provider interface
 * Defines methods that must be implemented by LLM providers
 */
export interface LLMProvider {
  /**
   * Generate text completion
   * @param prompt - Input prompt
   * @param config - Optional configuration overrides
   * @returns Generated text
   */
  generate(prompt: string, config?: Partial<LLMConfig>): Promise<string>;

  /**
   * Generate text completion as a stream
   * @param prompt - Input prompt
   * @param config - Optional configuration overrides
   * @returns Generated text stream
   */
  generateStream(prompt: string, config?: Partial<LLMConfig>): AsyncIterable<string>;

  /**
   * Create text embeddings
   * @param text - Input text
   * @returns Embedding vector
   */
  embed(text: string): Promise<number[]>;
} 