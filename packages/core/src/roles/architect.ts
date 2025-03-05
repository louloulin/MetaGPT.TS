import { BaseRole } from './base-role';
import type { Message } from '../types/message';
import type { Action } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Architect Role
 * Responsible for designing software architecture, APIs, data structures, and system components
 */
export class Architect extends BaseRole {
  constructor(
    name: string = 'Architect',
    profile: string = 'System Architect',
    goal: string = 'Design a concise, usable, and complete software system architecture',
    constraints: string = 'Ensure the architecture is simple yet robust. Use appropriate open source libraries. Maintain consistency with project requirements.',
    actions: Action[] = []
  ) {
    super(name, profile, goal, constraints, actions);
    this.desc = 'Designs software architecture, APIs, data structures, and system components';
  }

  /**
   * Analyze requirements and design a comprehensive system architecture
   * @param message - Message containing the requirements to analyze
   * @returns The architecture design
   */
  async designArchitecture(message: Message): Promise<string> {
    logger.info(`[${this.name}] Designing architecture for: ${message.content.substring(0, 100)}...`);
    
    // If we have an LLM available, use it to generate the architecture design
    if (this.actions.length > 0 && this.actions[0].llm) {
      const llm = this.actions[0].llm;
      const prompt = `
      As a software architect, design a comprehensive system architecture for the following requirements:
      
      REQUIREMENTS:
      ${message.content}
      
      Please include:
      1. System Components and their relationships
      2. APIs and interfaces between components
      3. Data structures and models
      4. Technology stack recommendations
      5. Design patterns to be used
      6. Non-functional requirements (scalability, security, performance)
      
      Format your response as a detailed architecture document with diagrams described in text (using markdown).
      `;
      
      try {
        return await llm.chat(prompt);
      } catch (error) {
        logger.error(`[${this.name}] Error designing architecture:`, error);
        return `Failed to design architecture: ${error}`;
      }
    }
    
    // Fallback if no LLM is available
    return "Architecture design requires an LLM provider. Please configure one.";
  }

  /**
   * Evaluate an existing architecture design and provide feedback
   * @param message - Message containing the architecture to evaluate
   * @returns Evaluation feedback
   */
  async evaluateArchitecture(message: Message): Promise<string> {
    logger.info(`[${this.name}] Evaluating architecture: ${message.content.substring(0, 100)}...`);
    
    if (this.actions.length > 0 && this.actions[0].llm) {
      const llm = this.actions[0].llm;
      const prompt = `
      As a software architect, evaluate the following system architecture design:
      
      ARCHITECTURE:
      ${message.content}
      
      Please provide a comprehensive evaluation including:
      1. Strengths of the design
      2. Potential weaknesses or risks
      3. Scalability assessment
      4. Maintainability assessment
      5. Security considerations
      6. Recommendations for improvement
      `;
      
      try {
        return await llm.chat(prompt);
      } catch (error) {
        logger.error(`[${this.name}] Error evaluating architecture:`, error);
        return `Failed to evaluate architecture: ${error}`;
      }
    }
    
    return "Architecture evaluation requires an LLM provider. Please configure one.";
  }

  /**
   * Map components and their relationships
   * @param message - Message containing the system components to map
   * @returns Component relationship map
   */
  async mapComponentRelationships(message: Message): Promise<string> {
    logger.info(`[${this.name}] Mapping component relationships: ${message.content.substring(0, 100)}...`);
    
    if (this.actions.length > 0 && this.actions[0].llm) {
      const llm = this.actions[0].llm;
      const prompt = `
      As a software architect, map the relationships between these system components:
      
      COMPONENTS:
      ${message.content}
      
      Please provide:
      1. A component diagram in text form (describable as mermaid or similar format)
      2. Detailed description of each relationship
      3. Data flow between components
      4. Dependencies between components
      `;
      
      try {
        return await llm.chat(prompt);
      } catch (error) {
        logger.error(`[${this.name}] Error mapping component relationships:`, error);
        return `Failed to map component relationships: ${error}`;
      }
    }
    
    return "Component relationship mapping requires an LLM provider. Please configure one.";
  }

  /**
   * Override the decideNextAction method to implement Architect-specific action selection
   */
  protected async decideNextAction(message?: Message): Promise<Action | null> {
    // If we have a message about architecture or design, prioritize design actions
    if (message) {
      const content = message.content.toLowerCase();
      if (
        content.includes('architecture') || 
        content.includes('design') || 
        content.includes('component') || 
        content.includes('system structure')
      ) {
        // Find actions related to architecture
        const architectureActions = this.actions.filter(action => 
          action.name.toLowerCase().includes('design') || 
          action.name.toLowerCase().includes('architecture') ||
          action.name.toLowerCase().includes('component')
        );
        
        if (architectureActions.length > 0) {
          return architectureActions[0];
        }
      }
    }
    
    // Default to parent implementation
    return await super.decideNextAction(message);
  }

  /**
   * Override the react method to add architecture-specific behavior
   */
  async react(message?: Message): Promise<Message> {
    if (message) {
      const content = message.content.toLowerCase();
      // If the message is about architecture design, generate a design
      if (
        content.includes('design architecture') || 
        content.includes('system design') ||
        content.includes('create architecture')
      ) {
        const design = await this.designArchitecture(message);
        
        // Add the design to memory
        const designMessage = this.createMessage(
          `Architecture Design:\n${design}`
        );
        this.addToMemory(designMessage);
        return designMessage;
      }
      
      // If the message is about architecture evaluation, evaluate the design
      if (
        content.includes('evaluate architecture') || 
        content.includes('review architecture') ||
        content.includes('assess architecture')
      ) {
        const evaluation = await this.evaluateArchitecture(message);
        
        // Add the evaluation to memory
        const evaluationMessage = this.createMessage(
          `Architecture Evaluation:\n${evaluation}`
        );
        this.addToMemory(evaluationMessage);
        return evaluationMessage;
      }
      
      // If the message is about component relationships, map them
      if (
        content.includes('component relationship') || 
        content.includes('map components') ||
        content.includes('component diagram')
      ) {
        const mapping = await this.mapComponentRelationships(message);
        
        // Add the mapping to memory
        const mappingMessage = this.createMessage(
          `Component Relationship Map:\n${mapping}`
        );
        this.addToMemory(mappingMessage);
        return mappingMessage;
      }
    }
    
    // Continue with the standard reaction process
    return super.react(message);
  }
} 