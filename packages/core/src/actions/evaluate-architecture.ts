import { BaseAction } from './base-action';
import type { ActionConfig, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Evaluate Architecture Action
 * Evaluates an architecture design and provides feedback
 */
export class EvaluateArchitecture extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'EvaluateArchitecture',
      description: config.description || 'Evaluate software architecture design and provide comprehensive feedback',
    });
  }

  /**
   * Execute the architecture evaluation action
   * @returns The architecture evaluation as action output
   */
  async run(): Promise<ActionOutput> {
    logger.info(`[${this.name}] Running architecture evaluation`);
    
    // Get architecture design from args
    const design = this.getArg<string>('design') || '';
    
    if (!design) {
      return this.createOutput(
        'No architecture design provided for evaluation',
        'failed'
      );
    }

    if (!this.llm) {
      return this.createOutput(
        'LLM provider is required for architecture evaluation',
        'failed'
      );
    }

    try {
      const prompt = this.createEvaluationPrompt(design);
      const evaluation = await this.llm.chat(prompt);

      return this.createOutput(
        evaluation,
        'completed'
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in architecture evaluation:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to evaluate architecture: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Create a prompt for architecture evaluation
   * @param design - The architecture design to evaluate
   * @returns The formatted prompt
   */
  private createEvaluationPrompt(design: string): string {
    return `
    As a software architect, evaluate the following system architecture design:
    
    ARCHITECTURE DESIGN:
    ${design}
    
    Please provide a comprehensive evaluation covering:
    
    1. Strengths
       - What aspects of the design are particularly strong?
       - Which architectural decisions are well justified?
       - How well does the design address the functional requirements?
    
    2. Weaknesses & Risks
       - What are potential weaknesses in the design?
       - Are there any architectural risks that should be addressed?
       - Are there any missing components or considerations?
    
    3. Scalability Assessment
       - How well will this architecture scale?
       - What bottlenecks might emerge under high load?
       - What recommendations would improve scalability?
    
    4. Maintainability Assessment
       - How maintainable is this architecture?
       - Are the components sufficiently modular and decoupled?
       - How easily can the system be extended or modified?
    
    5. Security Considerations
       - What security concerns exist in this architecture?
       - Are there any security vulnerabilities or gaps?
       - What security improvements would you recommend?
    
    6. Implementation Feasibility
       - How feasible is it to implement this architecture?
       - Are there any particularly challenging components?
       - What development challenges might the team face?
    
    7. Recommendations
       - What specific improvements would you suggest?
       - How would you prioritize these improvements?
       - Are there alternative approaches worth considering?
    
    Format your evaluation as a detailed report with clear sections. Use markdown for readability.
    Be constructive in your criticism and specific in your recommendations.
    `;
  }
} 