import type { LLMConfig, LLMProvider } from '../../src/types/llm';

export interface MockLLMConfig {
  responses?: Record<string, string>;
  generateFn?: (prompt: string) => Promise<string>;
  chatFn?: (message: string) => Promise<string>;
  embeddingFn?: (text: string) => Promise<number[]>;
}

/**
 * Mock LLM provider for testing
 */
export class MockLLM implements LLMProvider {
  private responses: Record<string, string>;
  private generateFn?: (prompt: string) => Promise<string>;
  private chatFn?: (message: string) => Promise<string>;
  private embeddingFn?: (text: string) => Promise<number[]>;
  private systemPrompt: string = '';

  /**
   * Creates a new MockLLM
   * 
   * @param config Configuration for the mock LLM
   */
  constructor(config: MockLLMConfig = {}) {
    this.responses = config.responses || {};
    this.generateFn = config.generateFn;
    this.chatFn = config.chatFn;
    this.embeddingFn = config.embeddingFn;
  }

  /**
   * Gets the name of the LLM provider
   * 
   * @returns Provider name
   */
  getName(): string {
    return 'MockLLM';
  }

  /**
   * Gets the model being used
   * 
   * @returns Model name
   */
  getModel(): string {
    return 'mock-model';
  }

  /**
   * Sets the system prompt for the LLM
   * 
   * @param prompt System prompt to set
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Gets the current system prompt
   * 
   * @returns Current system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Send a chat message to the LLM
   * 
   * @param message Message to send
   * @returns LLM response
   */
  async chat(message: string): Promise<string> {
    if (this.chatFn) {
      return this.chatFn(message);
    }

    // Try to find a matching response by checking if the message contains any of the keys
    for (const [key, response] of Object.entries(this.responses)) {
      if (message.includes(key)) {
        return response;
      }
    }

    return 'Mock response';
  }

  /**
   * Generate text completion
   * 
   * @param prompt Input prompt
   * @param config Optional configuration overrides
   * @returns Generated text
   */
  async generate(prompt: string, config?: Partial<LLMConfig>): Promise<string> {
    if (this.generateFn) {
      return this.generateFn(prompt);
    }

    // Try to find a matching response by checking if the prompt contains any of the keys
    for (const [key, response] of Object.entries(this.responses)) {
      if (prompt.includes(key)) {
        return response;
      }
    }

    return 'Mock generation';
  }

  /**
   * Create text embeddings
   * 
   * @param text Input text
   * @returns Embedding vector
   */
  async embed(text: string): Promise<number[]> {
    if (this.embeddingFn) {
      return this.embeddingFn(text);
    }

    // Return a mock embedding vector of length 10
    return Array(10).fill(0).map(() => Math.random());
  }
} 