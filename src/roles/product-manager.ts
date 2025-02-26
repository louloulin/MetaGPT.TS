import { BaseRole } from './base-role';
import type { Message } from '../types/message';
import type { Action } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Product Manager Role
 * Responsible for defining product requirements and features
 */
export class ProductManager extends BaseRole {
  constructor(
    name: string = 'ProductManager',
    profile: string = 'Product Manager',
    goal: string = 'Define clear product requirements and features that meet user needs',
    constraints: string = 'Focus on user value, feasibility, and business goals. Prioritize features effectively.',
    actions: Action[] = []
  ) {
    super(name, profile, goal, constraints, actions);
    this.desc = 'Defines product requirements and features';
  }

  /**
   * Analyze user requirements and create a product specification
   * @param message - Message containing user requirements
   * @returns Product specification
   */
  async createProductSpec(message: Message): Promise<string> {
    logger.info(`[${this.name}] Creating product specification from: ${message.content.substring(0, 100)}...`);
    
    // If we have an LLM available, use it to create the product spec
    if (this.actions.length > 0 && this.actions[0].llm) {
      const llm = this.actions[0].llm;
      const prompt = `
      As a product manager, create a detailed product specification based on the following user requirements:
      
      USER REQUIREMENTS:
      ${message.content}
      
      Your product specification should include:
      1. Product Overview
      2. User Personas
      3. User Stories
      4. Functional Requirements
      5. Non-Functional Requirements
      6. Feature Prioritization
      7. Success Metrics
      
      Be specific and detailed in your specification.
      `;
      
      try {
        return await llm.chat(prompt);
      } catch (error) {
        logger.error(`[${this.name}] Error creating product specification:`, error);
        return `Failed to create product specification: ${error}`;
      }
    }
    
    // Fallback if no LLM is available
    return "Creating a product specification requires an LLM provider. Please configure one.";
  }

  /**
   * Override the decideNextAction method to implement custom logic
   */
  protected async decideNextAction(message?: Message): Promise<Action | null> {
    // If we have a message about product requirements, prioritize PRD actions
    if (message && 
        (message.content.toLowerCase().includes('requirement') || 
         message.content.toLowerCase().includes('feature') ||
         message.content.toLowerCase().includes('product')) && 
        this.actions.length > 0) {
      
      // Find actions related to PRD
      const prdActions = this.actions.filter(action => 
        action.name.toLowerCase().includes('prd') || 
        action.name.toLowerCase().includes('requirement') ||
        action.name.toLowerCase().includes('spec')
      );
      
      if (prdActions.length > 0) {
        return prdActions[0];
      }
    }
    
    // Default to parent implementation
    return await super.decideNextAction(message);
  }

  /**
   * Override the react method to add product manager-specific behavior
   */
  async react(message?: Message): Promise<Message> {
    if (message) {
      // If the message is about product requirements, create a product spec
      if (message.content.toLowerCase().includes('requirement') || 
          message.content.toLowerCase().includes('feature') ||
          message.content.toLowerCase().includes('product')) {
        
        const productSpec = await this.createProductSpec(message);
        
        // Add the product spec to memory
        const specMessage = this.createMessage(
          `Product Specification:\n${productSpec}`
        );
        this.addToMemory(specMessage);
        
        // Return the product spec directly
        return specMessage;
      }
    }
    
    // Continue with the standard reaction process
    return super.react(message);
  }
} 