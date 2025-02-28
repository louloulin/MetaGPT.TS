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

    // Special handling for code summarization
    if (prompt.includes('summarize') && prompt.includes('code')) {
      return JSON.stringify({
        title: 'User Authentication Module',
        description: 'Handles user authentication and session management',
        language: 'TypeScript',
        primary_purpose: 'Manage user authentication flow',
        line_count: 150,
        complexity: 'MEDIUM',
        components: [
          {
            name: 'AuthService',
            type: 'CLASS',
            description: 'Main authentication service class'
          }
        ],
        functional_areas: [
          {
            name: 'Authentication',
            description: 'User login and session management'
          }
        ],
        dependencies: {
          imports: ['@types/jwt', '@types/bcrypt'],
          exports: ['AuthService', 'AuthConfig']
        },
        design_patterns: [
          {
            name: 'Singleton',
            usage: 'AuthService is implemented as a singleton'
          }
        ],
        potential_improvements: [
          {
            description: 'Add refresh token support',
            priority: 'HIGH',
            implementation_difficulty: 'MODERATE',
            code_example: 'implement refreshToken method'
          }
        ],
        documentation: {
          quality: 'GOOD',
          coverage_percentage: 85,
          missing_documentation: ['Error handling section'],
          suggestions: ['Add API documentation']
        }
      });
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
        limitations: ["Some sources have reliability concerns", "findings have low confidence"],
        future_research_directions: ["Direction 1"]
      });
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