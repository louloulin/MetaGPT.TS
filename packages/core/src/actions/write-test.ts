import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Action for writing tests based on code
 */
export class WriteTest extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'WriteTest',
      description: config.description || 'Write tests based on code implementation',
    });
  }

  /**
   * Execute the test writing action
   * @returns Generated tests
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running test generation`);
      
      // Get code from args
      const code = this.getArg<string>('code') || '';
      const language = this.getArg<string>('language') || 'TypeScript';
      const testFramework = this.getArg<string>('testFramework') || 'Jest';
      const context = this.getArg<string>('context') || '';
      
      if (!code) {
        return this.createOutput(
          'No code provided for test generation',
          'failed'
        );
      }

      if (!this.llm) {
        return this.createOutput(
          'LLM provider is required for test generation',
          'failed'
        );
      }

      // Generate tests using LLM
      const prompt = `Write ${testFramework} tests for the following ${language} code:
      
${context ? `Context:
${context}

` : ''}Code:
${code}

Please provide:
1. Complete test suite with all necessary imports
2. Test cases covering:
   - Happy path scenarios
   - Edge cases
   - Error conditions
   - Boundary conditions
3. Test setup and teardown
4. Mocks and stubs (if needed)
5. Test descriptions and comments

Follow these guidelines:
- Use modern ${testFramework} features
- Write clear test descriptions
- Follow test best practices
- Ensure good test coverage
- Include both unit and integration tests where appropriate
- Add test data and fixtures as needed`;

      const tests = await this.ask(prompt);
      
      return this.createOutput(tests, 'completed');
    } catch (error) {
      logger.error(`[${this.name}] Error in test generation:`, error);
      return this.handleException(error as Error);
    }
  }
} 