import { z } from 'zod';
import type { Message } from './message';

export const MemoryConfigSchema = z.object({
  maxSize: z.number().optional(),
});

export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

/**
 * Base interface for memory systems
 */
export interface Memory {
  /**
   * Add a message to memory
   */
  add(message: Message): Promise<void>;

  /**
   * Get all messages
   */
  get(): Promise<Message[]>;

  /**
   * Get all messages (alias for get)
   */
  getMessages(): Promise<Message[]>;

  /**
   * Clear all messages
   */
  clear(): Promise<void>;

  /**
   * Get last n messages
   */
  getLast(n: number): Promise<Message[]>;
}

/**
 * Interface for memory management
 */
export interface MemoryManager extends Memory {
  /**
   * Initialize the memory system
   */
  init(): Promise<void>;

  /**
   * Search messages by query
   */
  search(query: { [key: string]: any }): Promise<Message[]>;

  /**
   * Search messages by metadata
   */
  searchByMetadata(metadata: { [key: string]: any }): Promise<Message[]>;

  /**
   * Get messages by role
   */
  getByRole(role: string): Promise<Message[]>;

  /**
   * Get recent messages
   */
  getRecent(count?: number): Promise<Message[]>;

  /**
   * Get number of messages
   */
  size(): Promise<number>;

  /**
   * Working memory reference
   */
  working: MemoryManager;
}

export class ArrayMemory implements Memory {
  private messages: Message[] = [];
  private config: MemoryConfig;

  constructor(config: MemoryConfig = {}) {
    this.config = MemoryConfigSchema.parse(config);
  }

  async add(message: Message): Promise<void> {
    this.messages.push(message);
    if (this.config.maxSize && this.messages.length > this.config.maxSize) {
      this.messages.shift();
    }
  }

  async get(): Promise<Message[]> {
    return [...this.messages];
  }

  async getMessages(): Promise<Message[]> {
    return this.get();
  }

  getByActions(actions: Set<string>): Message[] {
    return this.messages.filter(msg => actions.has(msg.causedBy));
  }

  async clear(): Promise<void> {
    this.messages = [];
  }

  async getLast(n: number): Promise<Message[]> {
    return this.messages.slice(-n);
  }
} 