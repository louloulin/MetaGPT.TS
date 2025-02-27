import { BaseRole } from './base-role';
import type { Message } from '../types/message';
import type { Action } from '../types/action';
import { logger } from '../utils/logger';
import { ProjectManagement } from '../actions/project-management';
import type { LLMProvider } from '../types/llm';

/**
 * Configuration for the ProjectManager role
 */
export interface ProjectManagerConfig {
  /**
   * LLM provider to use
   */
  llm: LLMProvider;
  
  /**
   * Whether to use refined nodes for incremental development
   */
  isRefined?: boolean;
  
  /**
   * Name of the project manager
   */
  name?: string;
  
  /**
   * Profile of the project manager
   */
  profile?: string;
  
  /**
   * Goal of the project manager
   */
  goal?: string;
  
  /**
   * Constraints for the project manager
   */
  constraints?: string;
}

/**
 * ProjectManager Role
 * Responsible for breaking down tasks according to PRD/technical design, 
 * generating a task list, and analyzing task dependencies
 */
export class ProjectManager extends BaseRole {
  constructor(config: ProjectManagerConfig) {
    const name = config.name || 'Eve';
    const profile = config.profile || 'Project Manager';
    const goal = config.goal || 'Break down tasks according to PRD/technical design, generate a task list, and analyze task dependencies to start with the prerequisite modules';
    const constraints = config.constraints || 'Use same language as user requirement';
    
    // Initialize with an empty actions array, then add specific actions
    const actions: Action[] = [];
    
    super(name, profile, goal, constraints, actions);
    this.desc = 'Breaks down tasks and manages project dependencies';
    
    // Add ProjectManagement action
    const projectManagement = new ProjectManagement({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      llm: config.llm,
      isRefined: config.isRefined
    });
    
    this.addAction(projectManagement);
    
    // Log initialization
    logger.info(`ProjectManager initialized with ${this.actions.length} actions`);
  }
  
  /**
   * Processes incoming messages 
   * Override to handle project-specific messages
   * 
   * @param message The message to process
   * @returns True if the message was handled, false otherwise
   */
  protected async handleMessage(message: Message): Promise<boolean> {
    logger.debug(`ProjectManager handling message: ${message.content.substring(0, 50)}...`);
    
    // If the message contains keywords related to project management, prioritize handling it
    const lowerContent = message.content.toLowerCase();
    if (
      lowerContent.includes('task') || 
      lowerContent.includes('project') || 
      lowerContent.includes('plan') || 
      lowerContent.includes('schedule') ||
      lowerContent.includes('dependency') ||
      lowerContent.includes('timeline')
    ) {
      // Set context for the project management action
      if (this.actions.length > 0) {
        const action = this.actions[0];
        action.context.args = { 
          context: message.content,
          replyTo: message.id
        };
        
        // Set as the next action to execute
        this.setTodo(action);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Override the think method to customize decision-making
   * 
   * @param message The message to think about
   * @returns True if the role decided to act, false otherwise
   */
  async think(message?: Message): Promise<boolean> {
    logger.debug(`ProjectManager thinking about message: ${message?.content.substring(0, 50) || 'No message'}`);
    
    // If we have a specific message to process
    if (message) {
      // Try our specialized message handler first
      const handled = await this.handleMessage(message);
      if (handled) {
        return true;
      }
    }
    
    // Fall back to the default implementation
    return await super.think(message);
  }
} 