import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Action for writing code based on requirements
 */
export class WriteCode extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'WriteCode',
      description: config.description || 'Write code based on requirements and specifications',
    });
  }

  /**
   * Execute the code writing action
   * @returns Generated code
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running code generation`);
      
      // Get requirements from args
      const requirements = this.getArg<string>('requirements') || '';
      const language = this.getArg<string>('language') || 'TypeScript';
      const context = this.getArg<string>('context') || '';
      
      if (!requirements) {
        return this.createOutput(
          'No requirements provided for code generation',
          'failed'
        );
      }

      if (!this.llm) {
        return this.createOutput(
          'LLM provider is required for code generation',
          'failed'
        );
      }

      // Generate code using LLM
      const prompt = `Write ${language} code based on the following requirements:
      
${context ? `Context:
${context}

` : ''}Requirements:
${requirements}

Please provide:
1. Complete implementation with all necessary imports
2. Clear comments explaining the code
3. Error handling and edge cases
4. Type definitions (if applicable)
5. Example usage (if applicable)

Follow these guidelines:
- Use modern ${language} features and best practices
- Write clean, maintainable code
- Include proper error handling
- Add JSDoc comments for functions and types
- Consider performance and scalability`;

      const code = await this.ask(prompt);
      
      return this.createOutput(code, 'completed');
    } catch (error) {
      logger.error(`[${this.name}] Error in code generation:`, error);
      return this.handleException(error as Error);
    }
  }
} 