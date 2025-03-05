import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Action for debugging code and fixing issues
 */
export class DebugCode extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'DebugCode',
      description: config.description || 'Debug code and provide fixes for issues',
    });
  }

  /**
   * Execute the code debugging action
   * @returns Debug results and fixes
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running code debugging`);
      
      // Get code and error info from args
      const code = this.getArg<string>('code') || '';
      const error = this.getArg<string>('error') || '';
      const language = this.getArg<string>('language') || 'TypeScript';
      const context = this.getArg<string>('context') || '';
      
      if (!code) {
        return this.createOutput(
          'No code provided for debugging',
          'failed'
        );
      }

      if (!this.llm) {
        return this.createOutput(
          'LLM provider is required for debugging',
          'failed'
        );
      }

      // Generate debug analysis and fixes using LLM
      const prompt = `Debug the following ${language} code${error ? ' with the given error' : ''}:
      
${context ? `Context:
${context}

` : ''}Code:
${code}

${error ? `Error:
${error}

` : ''}Please provide:
1. Issue Analysis
   - Identify potential bugs
   - Locate error sources
   - Explain root causes
   - Impact assessment

2. Debug Steps
   - Step-by-step debugging process
   - Key variables to watch
   - Conditions to check
   - Test cases to verify

3. Proposed Fixes
   - Code corrections
   - Alternative solutions
   - Best practices to prevent similar issues
   - Performance considerations

4. Verification Steps
   - How to verify the fix works
   - Edge cases to test
   - Potential side effects
   - Regression testing needs`;

      const debugResults = await this.ask(prompt);
      
      return this.createOutput(debugResults, 'completed');
    } catch (error) {
      logger.error(`[${this.name}] Error in debugging:`, error);
      return this.handleException(error as Error);
    }
  }
} 