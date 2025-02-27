import { z } from 'zod';
import type { Message } from './message';

export const MemoryConfigSchema = z.object({
  maxSize: z.number().optional(),
});

export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

export class ArrayMemory {
  private messages: Message[] = [];
  private config: MemoryConfig;

  constructor(config: MemoryConfig = {}) {
    this.config = MemoryConfigSchema.parse(config);
  }

  add(message: Message): void {
    this.messages.push(message);
    if (this.config.maxSize && this.messages.length > this.config.maxSize) {
      this.messages.shift();
    }
  }

  get(): Message[] {
    return [...this.messages];
  }

  getMessages(): Message[] {
    return this.get();
  }

  getByActions(actions: Set<string>): Message[] {
    return this.messages.filter(msg => actions.has(msg.causedBy));
  }

  clear(): void {
    this.messages = [];
  }
}

/**
 * Interface for memory management
 */
export interface MemoryManager {
  /**
   * Initialize the memory system
   */
  init(): Promise<void>;

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