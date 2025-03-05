import type { Message } from '../types/message';
import { MemoryConfigSchema } from '../types/memory';
import type { MemoryConfig } from '../types/memory';

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

  getByActions(actions: Set<string>): Message[] {
    return this.messages.filter(msg => actions.has(msg.causedBy));
  }

  clear(): void {
    this.messages = [];
  }
} 