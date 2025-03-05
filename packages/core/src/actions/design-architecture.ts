import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Action for designing system architecture
 */
export class DesignArchitecture extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'DesignArchitecture',
      description: config.description || 'Design system architecture based on requirements',
    });
  }

  /**
   * Execute the design architecture action
   * @returns Message with architecture design
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running architecture design`);
      
      // Get requirements from args
      const requirements = this.getArg<string>('requirements') || '';
      
      if (!requirements) {
        return this.createOutput(
          'No requirements provided for architecture design',
          'failed'
        );
      }

      if (!this.llm) {
        return this.createOutput(
          'LLM provider is required for architecture design',
          'failed'
        );
      }

      // Generate architecture design using LLM
      const prompt = `Based on the following requirements, design a system architecture:
      
Requirements:
${requirements}

Please provide:
1. High-level system components
2. Component interactions and data flow
3. API specifications
4. Data models
5. Technology stack recommendations
6. Security considerations
7. Scalability approach`;

      const design = await this.ask(prompt);
      
      return this.createOutput(design, 'completed');
    } catch (error) {
      logger.error(`[${this.name}] Error in design architecture:`, error);
      return this.handleException(error as Error);
    }
  }
} 