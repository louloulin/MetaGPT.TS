import { z } from 'zod';
import type { Message } from '../types/message';
import type { Role } from '../types/role';
import type { Context } from '../context/context';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

/**
 * Configuration schema for Environment
 */
export const EnvironmentConfigSchema = z.object({
  /** Context for the environment */
  context: z.any().optional(),
  /** Description of the environment */
  description: z.string().default(''),
  /** Maximum message history size */
  maxHistorySize: z.number().default(1000),
});

export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

/**
 * Helper function to write JSON file
 */
function writeJsonFile(filePath: string, data: any): void {
  // Ensure directory exists
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // Write file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Environment class for agent communication and state management
 * 
 * The Environment serves as the communication hub and state manager for 
 * all roles (agents) in the system. It maintains message history,
 * manages the message bus, and provides mechanisms for roles to observe
 * and publish messages.
 */
export class Environment {
  /** Environment configuration */
  private config: EnvironmentConfig;
  /** Message history */
  private messageHistory: Message[] = [];
  /** Roles in the environment */
  private roles: Map<string, Role> = new Map();
  /** Environment description */
  private description: string = '';
  /** Context for cost tracking and other shared state */
  private _context: any;
  /** Flag indicating if all roles are idle */
  private _isIdle: boolean = true;

  /**
   * Create a new environment
   * @param config Environment configuration
   */
  constructor(config: EnvironmentConfig = {}) {
    this.config = EnvironmentConfigSchema.parse(config);
    this._context = this.config.context || {}; // Empty object as default context
    this.description = this.config.description || '';
  }

  /**
   * Get the environment's context
   */
  public get context(): any {
    return this._context;
  }

  /**
   * Set the environment description
   * @param description Environment description
   */
  public setDescription(description: string): void {
    this.description = description;
  }

  /**
   * Add roles to the environment
   * @param roles List of roles to add
   */
  public addRoles(roles: Role[]): void {
    for (const role of roles) {
      this.roles.set(role.name, role);
      // Note: Roles must implement setEnvironment method
      (role as any).setEnvironment?.(this);
    }
    logger.info(`Added ${roles.length} roles to environment`);
  }

  /**
   * Get a role by name
   * @param name Role name
   * @returns Role or undefined if not found
   */
  public getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }

  /**
   * Get all roles in the environment
   * @returns Array of roles
   */
  public getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Publish a message to the environment
   * @param message Message to publish
   */
  public publishMessage(message: Message): void {
    this.messageHistory.push(message);
    
    // Trim history if it exceeds maximum size
    if (this.messageHistory.length > this.config.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(
        this.messageHistory.length - this.config.maxHistorySize
      );
    }
    
    logger.debug(`Published message: ${(message as any).role} -> ${(message as any).sendTo || 'ALL'}`);
  }

  /**
   * Get messages from the environment filtered by recipient
   * @param recipient Recipient of the messages (role name)
   * @param fromIndex Start index in history (optional)
   * @returns Filtered messages
   */
  public getMessages(recipient: string, fromIndex?: number): Message[] {
    const start = fromIndex !== undefined ? Math.max(0, fromIndex) : 0;
    
    return this.messageHistory.slice(start).filter(message => {
      return (message as any).sendTo === 'ALL' || (message as any).sendTo === recipient;
    });
  }

  /**
   * Get all messages in the environment
   * @returns All messages
   */
  public get history(): Message[] {
    return [...this.messageHistory];
  }

  /**
   * Check if all roles are idle
   */
  public get isIdle(): boolean {
    if (this.roles.size === 0) {
      return true;
    }
    
    for (const role of this.roles.values()) {
      if (!(role as any).isIdle?.()) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Run one step of all roles in the environment
   * @returns Promise that resolves when all roles have processed one step
   */
  public async run(): Promise<void> {
    this._isIdle = true;
    
    // Run all roles in parallel
    const promises = Array.from(this.roles.values()).map(async (role) => {
      if (!(role as any).isIdle?.()) {
        this._isIdle = false;
        await (role as any).run?.();
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * Archive the environment
   * @param storagePath Storage path for archiving
   */
  public async archive(storagePath?: string): Promise<void> {
    if (!storagePath) {
      return;
    }
    
    // Save environment state
    const envPath = path.join(storagePath, 'environment');
    const historyPath = path.join(envPath, 'history.json');
    
    // Save message history
    writeJsonFile(historyPath, {
      description: this.description,
      messages: this.messageHistory.map(msg => (msg as any).serialize?.() || msg),
    });
    
    logger.info(`Archived environment data to ${envPath}`);
  }
} 