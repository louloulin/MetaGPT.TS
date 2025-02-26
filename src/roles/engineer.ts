import { BaseRole } from './base-role';
import type { Message } from '../types/message';
import type { Action } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Engineer Role
 * Responsible for implementing software based on requirements and designs
 */
export class Engineer extends BaseRole {
  constructor(
    name: string = 'Engineer',
    profile: string = 'Software Engineer',
    goal: string = 'Implement high-quality, maintainable code based on requirements and designs',
    constraints: string = 'Follow best practices and coding standards. Write clean, well-documented code.',
    actions: Action[] = []
  ) {
    super(name, profile, goal, constraints, actions);
    this.desc = 'Implements software based on requirements and designs';
  }

  /**
   * Analyze a coding task and determine the best approach
   * @param message - Message containing the coding task
   * @returns Analysis result
   */
  async analyzeTask(message: Message): Promise<string> {
    logger.info(`[${this.name}] Analyzing task: ${message.content.substring(0, 100)}...`);
    
    // If we have an LLM available, use it to analyze the task
    if (this.actions.length > 0 && this.actions[0].llm) {
      const llm = this.actions[0].llm;
      const prompt = `
      As a software engineer, analyze the following task and provide a brief plan for implementation:
      
      TASK:
      ${message.content}
      
      Please include:
      1. Key components/modules needed
      2. Potential challenges
      3. Implementation approach
      4. Estimated complexity (Low/Medium/High)
      `;
      
      try {
        return await llm.chat(prompt);
      } catch (error) {
        logger.error(`[${this.name}] Error analyzing task:`, error);
        return `Failed to analyze task: ${error}`;
      }
    }
    
    // Fallback if no LLM is available
    return "Task analysis requires an LLM provider. Please configure one.";
  }

  /**
   * Override the decideNextAction method to implement custom logic
   */
  protected async decideNextAction(message?: Message): Promise<Action | null> {
    // If we have a message about coding, prioritize coding actions
    if (message && message.content.toLowerCase().includes('code') && this.actions.length > 0) {
      // Find actions related to coding
      const codingActions = this.actions.filter(action => 
        action.name.toLowerCase().includes('code') || 
        action.name.toLowerCase().includes('implement')
      );
      
      if (codingActions.length > 0) {
        return codingActions[0];
      }
    }
    
    // Default to parent implementation
    return await super.decideNextAction(message);
  }

  /**
   * Override the react method to add engineering-specific behavior
   */
  async react(message?: Message): Promise<Message> {
    if (message) {
      // If the message is a coding task, analyze it first
      if (message.content.toLowerCase().includes('implement') || 
          message.content.toLowerCase().includes('code') ||
          message.content.toLowerCase().includes('develop')) {
        
        const analysis = await this.analyzeTask(message);
        
        // Add the analysis to memory
        const analysisMessage = this.createMessage(
          `Task Analysis:\n${analysis}`
        );
        this.addToMemory(analysisMessage);
      }
    }
    
    // Continue with the standard reaction process
    return super.react(message);
  }
} 