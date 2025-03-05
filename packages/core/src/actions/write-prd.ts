import { BaseAction } from './base-action';
import type { StreamActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * WritePRD Action
 * Generates a Product Requirements Document based on user requirements
 */
export class WritePRD extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'WritePRD',
      description: config.description || 'Generates a Product Requirements Document',
    });
  }

  /**
   * Set requirements for the PRD
   * @param requirements - User requirements text
   */
  public setRequirements(requirements: string): void {
    this.setArg('requirements', requirements);
    logger.debug(`[${this.name}] Requirements set: ${requirements.substring(0, 50)}...`);
  }

  protected async prompt(): Promise<string> {
    // Get requirements from context
    const requirements = this.getArg<string>('requirements') || '';
    const format = this.getArg<string>('format') || 'markdown';
    const audience = this.getArg<string>('audience') || 'development team';
    
    if (!requirements) {
      throw new Error('No requirements provided. Please specify the product requirements.');
    }
    
    return this.constructPRDPrompt(requirements, format, audience);
  }

  /**
   * Run the action to generate a PRD
   * @returns Action output containing the generated PRD
   */
  async run(): Promise<StreamActionOutput> {
    try {
      logger.info(`[${this.name}] Running WritePRD action`);
      
      // Generate PRD using LLM
      const generatedPRD = await this.ask(await this.prompt());
      
      return this.createOutput(
        generatedPRD,
        'completed',
        { 
          format: this.getArg<string>('format') || 'markdown',
          requirements: this.getArg<string>('requirements') || ''
        }
      );
    } catch (error) {
      logger.error(`[${this.name}] Error generating PRD:`, error);
      return this.handleException(error as Error);
    }
  }

  /**
   * Construct a prompt for PRD generation
   * @param requirements - User requirements
   * @param format - Output format
   * @param audience - Target audience
   * @returns Constructed prompt
   */
  private constructPRDPrompt(requirements: string, format: string, audience: string): string {
    return `
    You are an experienced Product Manager. Create a comprehensive Product Requirements Document (PRD) based on the following requirements:
    
    USER REQUIREMENTS:
    ${requirements}
    
    Your PRD should be in ${format} format and targeted at ${audience}.
    
    Include the following sections:
    1. Executive Summary
    2. Problem Statement
    3. Goals and Objectives
    4. User Personas
    5. User Stories/Use Cases
    6. Functional Requirements
    7. Non-Functional Requirements
    8. User Interface Requirements
    9. Technical Requirements
    10. Success Metrics
    11. Timeline and Milestones
    12. Risks and Assumptions
    
    Be specific, detailed, and clear in your requirements. Use examples where appropriate.
    `;
  }
} 