import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Action for evaluating system design
 */
export class EvaluateDesign extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'EvaluateDesign',
      description: config.description || 'Evaluate system design against best practices and requirements',
    });
  }

  /**
   * Execute the design evaluation action
   * @returns Evaluation results
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running design evaluation`);
      
      // Get design from args
      const design = this.getArg<string>('design') || '';
      const requirements = this.getArg<string>('requirements') || '';
      
      if (!design) {
        return this.createOutput(
          'No design provided for evaluation',
          'failed'
        );
      }

      if (!this.llm) {
        return this.createOutput(
          'LLM provider is required for design evaluation',
          'failed'
        );
      }

      // Generate evaluation using LLM
      const prompt = `Evaluate the following system design against best practices and requirements:
      
Design:
${design}

${requirements ? `Requirements:
${requirements}

` : ''}Please evaluate the design on:
1. Architectural principles adherence
2. Scalability and performance
3. Security and reliability
4. Maintainability and extensibility
5. Requirements fulfillment
6. Technology choices
7. Potential risks and challenges

For each aspect, provide:
- Score (0-10)
- Strengths
- Areas for improvement
- Specific recommendations`;

      const evaluation = await this.ask(prompt);
      
      return this.createOutput(evaluation, 'completed');
    } catch (error) {
      logger.error(`[${this.name}] Error in design evaluation:`, error);
      return this.handleException(error as Error);
    }
  }
} 