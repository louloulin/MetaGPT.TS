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
import type { Action, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';
import type { RoleReactMode } from '../types/role';

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

    super(name, profile, goal, constraints);

    this.llm = llm;
    this.capabilities = capabilities;
    this.specialties = specialties;
    this.memoryLimit = memory_limit;

    this.desc = 'Provides general assistance and handles various tasks adaptively';
    
    // Initialize role
    this.initialize();
    
    // Set react mode
    this.setReactMode(react_mode, max_react_loop);
  }

  /**
   * Initialize the Assistant role
   */
  private initialize(): void {
    logger.info('[Assistant] Initializing role');
    
    // Initialize actions (to be implemented)
    // this.actions = [
    //   new HandleQuery({ llm: this.llm }),
    //   new ManageTask({ llm: this.llm }),
    //   new ProvideInformation({ llm: this.llm }),
    //   new CollaborateWithRoles({ llm: this.llm })
    // ];
    
    logger.info('[Assistant] Initialization complete');
  }

  /**
   * Think about the next action based on the current context and message
   */
  public async think(): Promise<boolean> {
    const messages = this.context.memory.get();
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage) {
      logger.debug('[Assistant] No messages in memory for thinking');
      return false;
    }

    logger.debug(`[Assistant] Thinking about message: ${lastMessage.content}`);

    // TODO: Implement logic to:
    // 1. Analyze user's query/request
    // 2. Determine required capabilities
    // 3. Select appropriate action
    // 4. Consider context and history
    // 5. Plan collaboration if needed

    // For now, return true to indicate thinking was performed
    return true;
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

  /**
   * Clean up old messages if memory limit is exceeded
   */
  private cleanupMemory(): void {
    const messages = this.context.memory.get();
    if (messages.length > this.memoryLimit) {
      // Keep the most recent messages within the limit
      const toKeep = messages.slice(-this.memoryLimit);
      this.context.memory.clear();
      toKeep.forEach((msg: Message) => this.context.memory.add(msg));
      logger.info(`[Assistant] Cleaned up memory to stay within limit of ${this.memoryLimit} messages`);
    }
  }
} 