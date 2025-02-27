import type { Message } from '../types/message';
import type { MemoryManager } from '../types/memory';
import type { MemoryEntrySchema } from './types';
import type { z } from 'zod';
import { WorkingMemoryImpl } from './working';
import { LongTermMemoryImpl } from './longterm';
import { ArrayMemory } from './array';

/**
 * Implementation of the MemoryManager interface
 */
export class MemoryManagerImpl implements MemoryManager {
  private _working: ArrayMemory;

  constructor() {
    this._working = new ArrayMemory();
  }

  async init(): Promise<void> {
    this._working = new ArrayMemory();
  }

  async add(message: Message): Promise<void> {
    this._working.add(message);
  }

  async get(): Promise<Message[]> {
    return this._working.get();
  }

  async getMessages(): Promise<Message[]> {
    return this._working.get();
  }

  async clear(): Promise<void> {
    this._working.clear();
  }

  async search(query: { [key: string]: any }): Promise<Message[]> {
    const messages = await this.get();
    return messages.filter(message => {
      for (const [key, value] of Object.entries(query)) {
        if (message[key as keyof Message] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  async searchByMetadata(metadata: { [key: string]: any }): Promise<Message[]> {
    const messages = await this.get();
    return messages.filter(message => {
      if (!message.metadata || typeof message.metadata !== 'object') return false;
      for (const [key, value] of Object.entries(metadata)) {
        if (!(key in message.metadata) || (message.metadata as Record<string, unknown>)[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  async getByRole(role: string): Promise<Message[]> {
    const messages = await this.get();
    return messages.filter(message => message.role === role);
  }

  async getRecent(count: number = 10): Promise<Message[]> {
    const messages = await this.get();
    return messages.slice(-count);
  }

  async size(): Promise<number> {
    const messages = await this.get();
    return messages.length;
  }

  get working(): MemoryManager {
    return this;
  }

  async cleanup(): Promise<void> {
    // Consolidate working memory to long-term memory
    await this._longTerm.consolidate(this._working);
    // Clear working memory
    await this._working.clear();
  }
} 