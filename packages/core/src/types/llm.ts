/**
 * @module LLM
 * @category Core
 */

import { z } from 'zod';

/**
 * LLM Configuration schema
 */
export const LLMConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().optional(),
  systemPrompt: z.string().optional(),
  topP: z.number().min(0).max(1).default(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).default(0).optional(),
  presencePenalty: z.number().min(-2).max(2).default(0).optional(),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

/**
 * LLM Provider interface
 * Defines the contract for language model providers
 */
export interface LLMProvider {
  /**
   * Send a chat message to the LLM
   * @param message Message to send
   * @returns LLM response
   */
  chat(message: string): Promise<string>;
  
  /**
   * Set the system prompt for the LLM
   * @param prompt System prompt to set
   */
  setSystemPrompt?(prompt: string): void;
  
  /**
   * Get the current system prompt
   * @returns Current system prompt
   */
  getSystemPrompt?(): string;
  
  /**
   * Get the name of the LLM provider
   * @returns Provider name
   */
  getName(): string;
  
  /**
   * Get the model being used
   * @returns Model name
   */
  getModel(): string;

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
  generateStream?(prompt: string, config?: Partial<LLMConfig>): AsyncIterable<string>;

  /**
   * Chat with the LLM using streaming
   * @param message - Message to send
   * @returns LLM response stream
   */
  chatStream?(message: string): AsyncIterable<string>;

  /**
   * Create text embeddings
   * @param text - Input text
   * @returns Embedding vector
   */
  embed?(text: string): Promise<number[]>;
} 