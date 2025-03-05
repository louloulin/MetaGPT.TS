/**
 * Assistant Role
 * 
 * This role serves as a general-purpose helper that can handle various tasks,
 * provide helpful responses, and adapt to user needs. It maintains conversation
 * context and can collaborate with other roles when needed.
 */

import { BaseRole } from './base-role';
import type { Message } from '../types/message';
import type { LLMProvider } from '../types/llm';
import type { Action, ActionOutput, ActionContext } from '../types/action';
import { logger } from '../utils/logger';
import type { RoleReactMode } from '../types/role';

/**
 * Basic action for handling queries
 */
class HandleQueryAction implements Action {
  name: string;
  desc?: string;
  context: ActionContext;
  llm: LLMProvider;
  prefix: string;
  
  constructor(llm: LLMProvider) {
    this.name = 'HandleQuery';
    this.desc = 'Handles general queries and provides responses';
    this.llm = llm;
    this.prefix = 'handle_query';
    this.context = {
      name: this.name,
      description: this.desc || '',
      memory: null,
      workingMemory: null,
      llm: this.llm
    };
  }

  async run(): Promise<ActionOutput> {
    try {
      const response = await this.llm.chat('How can I help you?');
      
      return {
        status: 'completed',
        content: response || 'No response generated',
        instructContent: null
      };
    } catch (error) {
      return this.handleException(error as Error);
    }
  }

  async handleException(error: Error): Promise<ActionOutput> {
    logger.error('[HandleQueryAction] Error processing query:', error);
    return {
      status: 'failed',
      content: 'Error processing your request',
      instructContent: null
    };
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }
}

/**
 * Configuration interface for the Assistant role
 */
export interface AssistantConfig {
  llm: LLMProvider;
  name?: string;
  profile?: string;
  goal?: string;
  constraints?: string;
  capabilities?: string[];
  specialties?: string[];
  react_mode?: RoleReactMode;
  max_react_loop?: number;
  memory_limit?: number;
}

/**
 * Assistant role implementation
 */
export class Assistant extends BaseRole {
  private llm: LLMProvider;
  private capabilities: string[];
  private specialties: string[];
  private memoryLimit: number;

  constructor(config: AssistantConfig) {
    const {
      llm,
      name = 'Assistant',
      profile = 'General Assistant',
      goal = 'Provide helpful and accurate assistance across various tasks and queries',
      constraints = 'Maintain professionalism, respect user privacy, and provide accurate information',
      capabilities = ['general_assistance', 'information_lookup', 'task_management'],
      specialties = ['general'],
      react_mode = 'plan_and_act',
      max_react_loop = 3,
      memory_limit = 100
    } = config;

    // Initialize base role with required parameters
    super(
      name,
      profile,
      goal,
      constraints,
      [new HandleQueryAction(llm)],
      'General purpose AI assistant that can handle various tasks and queries'
    );

    this.llm = llm;
    this.capabilities = capabilities;
    this.specialties = specialties;
    this.memoryLimit = memory_limit;
    
    // Set react mode
    this.setReactMode(react_mode, max_react_loop);
  }

  /**
   * Get the assistant's capabilities
   */
  public getCapabilities(): string[] {
    return this.capabilities;
  }

  /**
   * Add a capability
   */
  public addCapability(capability: string): void {
    if (!this.capabilities.includes(capability)) {
      this.capabilities.push(capability);
      logger.info(`[Assistant] Added capability: ${capability}`);
    }
  }

  /**
   * Get the assistant's specialties
   */
  public getSpecialties(): string[] {
    return this.specialties;
  }

  /**
   * Add a specialty
   */
  public addSpecialty(specialty: string): void {
    if (!this.specialties.includes(specialty)) {
      this.specialties.push(specialty);
      logger.info(`[Assistant] Added specialty: ${specialty}`);
    }
  }

  /**
   * Check if the assistant has a specific capability
   */
  public hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  /**
   * Get the memory limit
   */
  public getMemoryLimit(): number {
    return this.memoryLimit;
  }

  /**
   * Set the memory limit
   */
  public setMemoryLimit(limit: number): void {
    this.memoryLimit = limit;
    logger.info(`[Assistant] Memory limit updated to: ${limit}`);
  }
} 