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

  getByActions(actions: Set<string>): Message[] {
    return this.messages.filter(msg => actions.has(msg.causedBy));
  }

  clear(): void {
    this.messages = [];
  }
} 