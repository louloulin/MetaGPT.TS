import { BaseAction } from './base-action';
import type { ActionConfig, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Write Test Action
 * Generates test cases and test code for a given implementation
 */
export class WriteTest extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'WriteTest',
      description: config.description || 'Write comprehensive test cases and code to verify functionality and catch edge cases',
    });
  }

  /**
   * Execute the test writing action
   * @returns The test code as action output
   */
  async run(): Promise<ActionOutput> {
    logger.info(`[${this.name}] Running test writing`);
    
    // Get code from args or context
    const code = this.getArg<string>('code') || '';
    const framework = this.getArg<string>('framework') || 'jest'; // Default to Jest
    const language = this.getArg<string>('language') || 'typescript'; // Default to TypeScript
    
    if (!code) {
      return this.createOutput(
        'No code provided for test writing',
        'failed'
      );
    }

    if (!this.llm) {
      return this.createOutput(
        'LLM provider is required for test writing',
        'failed'
      );
    }

    try {
      const prompt = this.createTestPrompt(code, framework, language);
      const tests = await this.llm.chat(prompt);

      return this.createOutput(
        tests,
        'completed'
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in writing tests:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to write tests: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Create a prompt for test writing based on code
   * @param code - The code to write tests for
   * @param framework - The testing framework to use
   * @param language - The programming language
   * @returns The formatted prompt
   */
  private createTestPrompt(code: string, framework: string, language: string): string {
    return `
    As a Quality Assurance Engineer, write comprehensive tests for the following code:
    
    CODE:
    ${code}
    
    Testing Framework: ${framework}
    Language: ${language}
    
    Your test code should include:
    
    1. Test Setup
       - Required imports
       - Test fixtures or mock data
       - Any mock functions/services needed
    
    2. Test Organization
       - Use appropriate test grouping (describe blocks in Jest/Mocha)
       - Organize tests by functionality or method
    
    3. Test Coverage
       - Test happy paths (expected usage)
       - Test error cases and edge conditions
       - Test all public methods and functionality
    
    4. Assertions
       - Use clear, specific assertions
       - Verify both return values and side effects
       - Include appropriate error messages
    
    5. Best Practices
       - Write isolated, idempotent tests
       - Follow the AAA pattern (Arrange-Act-Assert)
       - Use meaningful test names that describe the expected behavior
    
    Format your response as clean, well-commented ${language} test code that follows ${framework} conventions.
    Do not include explanations outside of the code itself - all explanations should be in code comments.
    `;
  }
} 