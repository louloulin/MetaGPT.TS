import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Message route constants
 */
export const MESSAGE_ROUTE = {
  CAUSE_BY: 'UserRequirement',
  FROM: '',
  TO: '*',
  TO_ALL: '*',
} as const;

/**
 * Message metadata schema
 */
export const MessageMetadataSchema = z.object({
  importance: z.number().min(0).max(1).default(0.5),
  tags: z.array(z.string()).default([]),
  context: z.record(z.unknown()).default({}),
}).partial();

export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;

/**
 * Simple message schema without routing information
 */
export const SimpleMessageSchema = z.object({
  content: z.string(),
  role: z.string(),
});

/**
 * Base message schema with full routing and content information
 */
export const MessageSchema = z.object({
  id: z.string().default('').transform(id => id || uuidv4()),
  content: z.string(),
  instructContent: z.any().optional().nullable(),
  role: z.string().default('user'),
  causedBy: z.string().default(MESSAGE_ROUTE.CAUSE_BY),
  sentFrom: z.string().default(MESSAGE_ROUTE.FROM),
  timestamp: z.string().default(() => new Date().toISOString()),
  metadata: MessageMetadataSchema.optional(),
  sendTo: z.union([
    z.string(),
    z.array(z.string()),
    z.instanceof(Set),
  ]).default(MESSAGE_ROUTE.TO_ALL).transform(data => {
    if (typeof data === 'string') {
      return new Set([data]);
    }
    if (Array.isArray(data)) {
      return new Set(data);
    }
    if (data instanceof Set) {
      return data;
    }
    return new Set([MESSAGE_ROUTE.TO_ALL]);
  }),
});

/**
 * Message types
 */
export type SimpleMessage = z.infer<typeof SimpleMessageSchema>;
export type Message = z.infer<typeof MessageSchema>;

/**
 * Message queue interface for handling asynchronous message updates
 */
export interface MessageQueue {
  push(msg: Message): void;
  pop(): Promise<Message | null>;
  popAll(): Promise<Message[]>;
  empty(): boolean;
}

/**
 * Message queue implementation using async queue
 */
export class AsyncMessageQueue implements MessageQueue {
  private queue: Message[] = [];

  /**
   * Push a message to the queue
   * @param msg - Message to push
   */
  public push(msg: Message): void {
    this.queue.push(msg);
  }

  /**
   * Pop a message from the queue
   * @returns Promise resolving to the next message or null if queue is empty
   */
  public async pop(): Promise<Message | null> {
    if (this.queue.length === 0) {
      return null;
    }
    return this.queue.shift() || null;
  }

  /**
   * Pop all messages from the queue
   * @returns Promise resolving to array of all messages
   */
  public async popAll(): Promise<Message[]> {
    const messages = [...this.queue];
    this.queue = [];
    return messages;
  }

  /**
   * Check if queue is empty
   * @returns True if queue is empty
   */
  public empty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Convert queue to JSON string
   * @returns JSON string representation of queue
   */
  public async dump(): Promise<string> {
    return JSON.stringify({
      messages: this.queue.map(msg => ({
        ...msg,
        sendTo: Array.from(msg.sendTo),
      })),
    });
  }

  /**
   * Create queue from JSON string
   * @param data - JSON string representation of queue
   * @returns New AsyncMessageQueue instance
   */
  public static load(data: string): AsyncMessageQueue {
    const queue = new AsyncMessageQueue();
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed.messages)) {
        queue.queue = parsed.messages.map((msg: any) => ({
          ...msg,
          sendTo: new Set(msg.sendTo),
        }));
      }
    } catch (error) {
      console.error('Failed to load message queue:', error);
    }
    return queue;
  }
}

/**
 * User message with predefined role
 */
export class UserMessage implements Message {
  public id: string = uuidv4();
  public content: string;
  public instructContent: any = null;
  public role: string = 'user';
  public causedBy: string = MESSAGE_ROUTE.CAUSE_BY;
  public sentFrom: string = MESSAGE_ROUTE.FROM;
  public sendTo: Set<string> = new Set([MESSAGE_ROUTE.TO_ALL]);
  public timestamp: string = new Date().toISOString();
  public metadata?: MessageMetadata;

  constructor(content: string, metadata?: MessageMetadata) {
    this.content = content;
    this.metadata = metadata;
  }
}

/**
 * System message with predefined role
 */
export class SystemMessage implements Message {
  public id: string = uuidv4();
  public content: string;
  public instructContent: any = null;
  public role: string = 'system';
  public causedBy: string = MESSAGE_ROUTE.CAUSE_BY;
  public sentFrom: string = MESSAGE_ROUTE.FROM;
  public sendTo: Set<string> = new Set([MESSAGE_ROUTE.TO_ALL]);
  public timestamp: string = new Date().toISOString();
  public metadata?: MessageMetadata;

  constructor(content: string, metadata?: MessageMetadata) {
    this.content = content;
    this.metadata = metadata;
  }
}

/**
 * AI message with predefined role
 */
export class AIMessage implements Message {
  public id: string = uuidv4();
  public content: string;
  public instructContent: any = null;
  public role: string = 'assistant';
  public causedBy: string = MESSAGE_ROUTE.CAUSE_BY;
  public sentFrom: string = MESSAGE_ROUTE.FROM;
  public sendTo: Set<string> = new Set([MESSAGE_ROUTE.TO_ALL]);
  public timestamp: string = new Date().toISOString();
  public metadata?: MessageMetadata;

  constructor(content: string, metadata?: MessageMetadata) {
    this.content = content;
    this.metadata = metadata;
  }
} 