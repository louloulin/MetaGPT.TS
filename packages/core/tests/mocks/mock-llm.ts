import type { LLMConfig, LLMProvider } from '../../src/types/llm';
import { vi } from 'vitest';

export interface MockLLMConfig {
  responses?: Record<string, string>;
  generateFn?: (prompt: string) => Promise<string>;
}

/**
 * Mock LLM provider for testing
 */
export class MockLLM implements LLMProvider {
  private responses: Record<string, string>;
  private systemPrompt: string = '';
  private generateFn?: (prompt: string) => Promise<string>;

  /**
   * Creates a new MockLLM
   * 
   * @param config Configuration for the mock LLM
   */
  constructor(config: MockLLMConfig = {}) {
    this.responses = config.responses || {};
    this.generateFn = config.generateFn;
  }

  /**
   * Gets the name of the LLM provider
   * 
   * @returns Provider name
   */
  getName = vi.fn().mockReturnValue('MockLLM');

  /**
   * Gets the model being used
   * 
   * @returns Model name
   */
  getModel = vi.fn().mockReturnValue('mock-model');

  /**
   * Sets the system prompt for the LLM
   * 
   * @param prompt System prompt to set
   */
  setSystemPrompt = vi.fn().mockImplementation((prompt: string) => {
    this.systemPrompt = prompt;
  });

  /**
   * Gets the current system prompt
   * 
   * @returns Current system prompt
   */
  getSystemPrompt = vi.fn().mockImplementation(() => {
    return this.systemPrompt;
  });

  /**
   * Send a chat message to the LLM
   * 
   * @param message Message to send
   * @returns LLM response
   */
  chat = vi.fn().mockImplementation(async (message: string) => {
    // If generateFn is provided, use it
    if (this.generateFn) {
      return this.generateFn(message);
    }

    // Try to find a matching response by checking if the message contains any of the keys
    for (const [key, response] of Object.entries(this.responses)) {
      if (message.includes(key)) {
        return response;
      }
    }

    // Special handling for research topics
    if (message.includes('topic_type')) {
      // Extract topic_type from the message
      const topicTypeMatch = message.match(/topic_type["']?\s*:\s*["']?(\w+)["']?/i);
      const topicType = topicTypeMatch ? topicTypeMatch[1] : 'GENERAL';
      
      // Generate a mock research response with the correct topic_type
      return JSON.stringify({
        query: "Mock research query",
        topic_type: topicType,
        objective: "Mock research objective",
        sources: [{ 
          id: "src1", 
          title: "Mock Source", 
          type: "WEBSITE", 
          reliability: "HIGH",
          key_points: ["Important point 1"] 
        }],
        findings: [{ 
          id: "find1", 
          topic: "Mock Topic", 
          description: "Mock finding", 
          source_ids: ["src1"], 
          confidence: 0.9 
        }],
        analysis: {
          patterns: ["Pattern 1"],
          gaps: ["Gap 1"],
          controversies: [],
          consensus: ["Consensus 1"],
          emerging_trends: ["Trend 1"]
        },
        key_takeaways: ["Takeaway 1"],
        summary: "Mock research summary",
        confidence_score: 0.85,
        limitations: ["Some sources have reliability concerns"],
        future_research_directions: ["Direction 1"]
      });
    }

    return 'Mock response';
  });

  /**
   * Generate text completion
   * 
   * @param prompt Input prompt
   * @param config Optional configuration overrides
   * @returns Generated text
   */
  generate = vi.fn().mockImplementation(async (prompt: string, config?: Partial<LLMConfig>) => {
    // If generateFn is provided, use it
    if (this.generateFn) {
      return this.generateFn(prompt);
    }

    // Try to find a matching response by checking if the prompt contains any of the keys
    for (const [key, response] of Object.entries(this.responses)) {
      if (prompt.includes(key)) {
        return response;
      }
    }

    // Special handling for research topics
    if (prompt.includes('topic_type')) {
      // Extract topic_type from the prompt
      const topicTypeMatch = prompt.match(/topic_type["']?\s*:\s*["']?(\w+)["']?/i);
      const topicType = topicTypeMatch ? topicTypeMatch[1] : 'GENERAL';
      
      // Generate a mock research response with the correct topic_type
      return JSON.stringify({
        query: "Mock research query",
        topic_type: topicType,
        objective: "Mock research objective",
        sources: [{ 
          id: "src1", 
          title: "Mock Source", 
          type: "WEBSITE", 
          reliability: "HIGH",
          key_points: ["Important point 1"] 
        }],
        findings: [{ 
          id: "find1", 
          topic: "Mock Topic", 
          description: "Mock finding", 
          source_ids: ["src1"], 
          confidence: 0.9 
        }],
        analysis: {
          patterns: ["Pattern 1"],
          gaps: ["Gap 1"],
          controversies: [],
          consensus: ["Consensus 1"],
          emerging_trends: ["Trend 1"]
        },
        key_takeaways: ["Takeaway 1"],
        summary: "Mock research summary",
        confidence_score: 0.85,
        limitations: ["Some sources have reliability concerns"],
        future_research_directions: ["Direction 1"]
      });
    }

    // Return empty array as JSON string for unknown prompts
    return '[]';
  });

  /**
   * Create text embeddings
   * 
   * @param text Input text
   * @returns Embedding vector
   */
  embed = vi.fn().mockImplementation(async (text: string) => {
    // Return a mock embedding vector of length 10
    return Array(10).fill(0).map(() => Math.random());
  });
} 