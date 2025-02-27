/**
 * Base interface for LLM providers
 */
export interface LLMProvider {
  /**
   * Generate a response from the LLM
   * @param prompt The prompt to send to the LLM
   * @param options Optional parameters for the generation
   * @returns The generated response
   */
  generate(prompt: string, options?: Record<string, any>): Promise<string>;

  /**
   * Chat with the LLM using a series of messages
   * @param messages Array of messages in the conversation
   * @param options Optional parameters for the chat
   * @returns The LLM's response
   */
  chat(messages: Array<{role: string, content: string}>, options?: Record<string, any>): Promise<string>;
} 