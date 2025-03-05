/**
 * @module MessageBroker
 * @category Distributed
 * 
 * Message broker for distributed communication
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Message types for distributed communication
 */
export enum MessageType {
  NODE_DISCOVERY = 'node_discovery',
  TASK_ASSIGNMENT = 'task_assignment',
  TASK_RESULT = 'task_result',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
  STATE_SYNC = 'state_sync'
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Message interface for distributed communication
 */
export interface Message {
  id: string;
  type: MessageType;
  sender: string;
  recipient?: string;
  timestamp: number;
  priority: MessagePriority;
  payload: any;
  correlationId?: string;
  ttl?: number;
  retries?: number;
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: Message) => Promise<void>;

/**
 * Message broker options
 */
export interface MessageBrokerOptions {
  maxRetries?: number;
  retryDelay?: number;
  defaultTTL?: number;
  maxQueueSize?: number;
  enablePersistence?: boolean;
}

/**
 * Message broker for distributed communication
 */
export class MessageBroker extends EventEmitter {
  private handlers: Map<MessageType, Set<MessageHandler>>;
  private messageQueue: Message[];
  private processingQueue: boolean;
  private options: Required<MessageBrokerOptions>;

  constructor(options: MessageBrokerOptions = {}) {
    super();
    this.handlers = new Map();
    this.messageQueue = [];
    this.processingQueue = false;
    
    // Set default options
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      defaultTTL: options.defaultTTL ?? 60000,
      maxQueueSize: options.maxQueueSize ?? 1000,
      enablePersistence: options.enablePersistence ?? false
    };

    // Initialize handlers for all message types
    Object.values(MessageType).forEach(type => {
      this.handlers.set(type as MessageType, new Set());
    });

    // Start queue processing
    this.startQueueProcessing();
  }

  /**
   * Subscribe to messages of a specific type
   */
  public subscribe(type: MessageType, handler: MessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.add(handler);
      logger.info(`[MessageBroker] Subscribed handler to ${type}`);
    }
  }

  /**
   * Unsubscribe from messages of a specific type
   */
  public unsubscribe(type: MessageType, handler: MessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      logger.info(`[MessageBroker] Unsubscribed handler from ${type}`);
    }
  }

  /**
   * Publish a message to the broker
   */
  public async publish(message: Partial<Message>): Promise<string> {
    const fullMessage: Message = {
      id: message.id ?? uuidv4(),
      type: message.type!,
      sender: message.sender!,
      recipient: message.recipient,
      timestamp: message.timestamp ?? Date.now(),
      priority: message.priority ?? MessagePriority.NORMAL,
      payload: message.payload,
      correlationId: message.correlationId,
      ttl: message.ttl ?? this.options.defaultTTL,
      retries: 0
    };

    // Validate message queue size
    if (this.messageQueue.length >= this.options.maxQueueSize) {
      throw new Error('Message queue is full');
    }

    // Add message to queue
    this.messageQueue.push(fullMessage);
    this.messageQueue.sort((a, b) => b.priority - a.priority);

    logger.debug(`[MessageBroker] Published message: ${fullMessage.id} (${fullMessage.type})`);

    // Trigger queue processing if not already running
    if (!this.processingQueue) {
      this.processQueue();
    }

    return fullMessage.id;
  }

  /**
   * Start processing the message queue
   */
  private startQueueProcessing(): void {
    setInterval(() => {
      if (!this.processingQueue && this.messageQueue.length > 0) {
        this.processQueue();
      }
    }, 100);
  }

  /**
   * Process messages in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue[0];

        // Check message TTL
        if (Date.now() - message.timestamp > message.ttl!) {
          logger.warn(`[MessageBroker] Message ${message.id} expired`);
          this.messageQueue.shift();
          continue;
        }

        // Get handlers for message type
        const handlers = this.handlers.get(message.type);
        if (!handlers || handlers.size === 0) {
          logger.warn(`[MessageBroker] No handlers for message type: ${message.type}`);
          this.messageQueue.shift();
          continue;
        }

        try {
          // Process message with all handlers
          await Promise.all(
            Array.from(handlers).map(handler =>
              handler(message).catch(error => {
                logger.error(`[MessageBroker] Handler error: ${error.message}`);
                return this.handleError(message, error);
              })
            )
          );

          // Remove processed message
          this.messageQueue.shift();
        } catch (error) {
          await this.handleError(message, error as Error);
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Handle message processing errors
   */
  private async handleError(message: Message, error: Error): Promise<void> {
    if (message.retries! < this.options.maxRetries) {
      // Increment retry count and requeue
      message.retries!++;
      message.timestamp = Date.now();
      this.messageQueue.push(message);
      
      logger.warn(`[MessageBroker] Retrying message ${message.id} (attempt ${message.retries})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
    } else {
      logger.error(`[MessageBroker] Message ${message.id} failed after ${message.retries} retries`);
      
      // Publish error message
      await this.publish({
        type: MessageType.ERROR,
        sender: 'message_broker',
        payload: {
          originalMessage: message,
          error: error.message
        },
        priority: MessagePriority.HIGH
      });
    }
  }

  /**
   * Get the current queue size
   */
  public getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Clear all messages and handlers
   */
  public clear(): void {
    this.messageQueue = [];
    this.handlers.clear();
    Object.values(MessageType).forEach(type => {
      this.handlers.set(type as MessageType, new Set());
    });
    logger.info('[MessageBroker] Cleared all messages and handlers');
  }
} 