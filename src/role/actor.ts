/**
 * Base Actor class for the role system
 */

import { ActorMessage } from './actor-message';
import { logger } from '../utils/logger';

export class Actor {
  protected id: string;
  private messageHandlers: Map<string, (message: ActorMessage) => Promise<void>>;

  constructor(id: string) {
    this.id = id;
    this.messageHandlers = new Map();
  }

  /**
   * Register a message handler for a specific message type
   */
  protected registerMessageHandler(
    messageType: string,
    handler: (message: ActorMessage) => Promise<void>
  ): void {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Handle an incoming message
   */
  public async handleMessage(message: ActorMessage): Promise<void> {
    const handler = this.messageHandlers.get(message.type);
    if (!handler) {
      logger.warn(`No handler registered for message type: ${message.type}`);
      return;
    }

    try {
      await handler(message);
    } catch (error) {
      logger.error(`Error handling message: ${error}`);
      throw error;
    }
  }

  /**
   * Get the actor's ID
   */
  public getId(): string {
    return this.id;
  }
} 