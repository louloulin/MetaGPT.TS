import type { Message } from '../types/message';
import type { MemoryManager } from '../types/memory';

/**
 * Implementation of the MemoryManager interface
 */
export class MemoryManagerImpl implements MemoryManager {
  private messages: Message[] = [];
  private maxSize: number = 1000;

  async init(): Promise<void> {
    this.messages = [];
  }

  async add(message: Message): Promise<void> {
    // Add message and maintain max size
    this.messages.push(message);
    if (this.messages.length > this.maxSize) {
      this.messages.shift();
    }
  }

  async get(): Promise<Message[]> {
    return this.messages;
  }

  async getMessages(): Promise<Message[]> {
    return this.messages;
  }

  async clear(): Promise<void> {
    this.messages = [];
  }

  async search(query: { [key: string]: any }): Promise<Message[]> {
    // Basic search implementation
    return this.messages.filter(message => {
      for (const [key, value] of Object.entries(query)) {
        if (message[key as keyof Message] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  async searchByMetadata(metadata: { [key: string]: any }): Promise<Message[]> {
    // Search by instructContent since we don't have metadata
    return this.messages.filter(message => {
      if (!message.instructContent) return false;
      for (const [key, value] of Object.entries(metadata)) {
        if (message.instructContent[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  async getByRole(role: string): Promise<Message[]> {
    return this.messages.filter(message => message.role === role);
  }

  async getRecent(count: number = 10): Promise<Message[]> {
    return this.messages.slice(-count);
  }

  async size(): Promise<number> {
    return this.messages.length;
  }

  // Alias for working memory
  get working(): MemoryManager {
    return this;
  }
} 