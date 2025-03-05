import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Action for reviewing code
 */
export class ReviewCode extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'ReviewCode',
      description: config.description || 'Review code for quality, best practices, and potential issues',
    });
  }

  /**
   * Execute the code review action
   * @returns Review results
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running code review`);
      
      // Get code from args
      const code = this.getArg<string>('code') || '';
      const language = this.getArg<string>('language') || '';
      const context = this.getArg<string>('context') || '';
      
      if (!code) {
        return this.createOutput(
          'No code provided for review',
          'failed'
        );
      }

      if (!this.llm) {
        return this.createOutput(
          'LLM provider is required for code review',
          'failed'
        );
      }

      // Generate review using LLM
      const prompt = `Review the following ${language ? language + ' ' : ''}code:
      
${context ? `Context:
${context}

` : ''}Code:
${code}

Please provide a comprehensive code review including:
1. Code Quality
   - Clean code principles
   - Design patterns
   - Code organization
   - Naming conventions
   - Documentation

2. Best Practices
   - Language-specific conventions
   - Error handling
   - Resource management
   - Security practices

3. Performance
   - Algorithmic efficiency
   - Resource usage
   - Potential bottlenecks

4. Maintainability
   - Code complexity
   - Modularity
   - Testability
   - Reusability

5. Specific Issues
   - Bugs
   - Security vulnerabilities
   - Edge cases
   - Anti-patterns

For each category:
- List specific findings
- Provide severity level
- Include suggested improvements
- Add code examples where applicable`;

      const review = await this.ask(prompt);
      
      return this.createOutput(review, 'completed');
    } catch (error) {
      logger.error(`[${this.name}] Error in code review:`, error);
      return this.handleException(error as Error);
    }
  }
} 