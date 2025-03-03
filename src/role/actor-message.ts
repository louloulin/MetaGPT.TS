/**
 * Message interface for actor communication
 */

export interface ActorMessage {
  type: string;
  sender: string;
  receiver: string;
  content: any;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface ActorMessageOptions {
  metadata?: Record<string, any>;
}

export class ActorMessageBuilder {
  /**
   * Create a new message
   */
  public static createMessage(
    type: string,
    sender: string,
    receiver: string,
    content: any,
    options: ActorMessageOptions = {}
  ): ActorMessage {
    return {
      type,
      sender,
      receiver,
      content,
      metadata: options.metadata,
      timestamp: Date.now(),
    };
  }

  /**
   * Create a response message
   */
  public static createResponse(
    originalMessage: ActorMessage,
    content: any,
    options: ActorMessageOptions = {}
  ): ActorMessage {
    return {
      type: `${originalMessage.type}_RESPONSE`,
      sender: originalMessage.receiver,
      receiver: originalMessage.sender,
      content,
      metadata: {
        ...options.metadata,
        originalMessageType: originalMessage.type,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Create an error message
   */
  public static createError(
    originalMessage: ActorMessage,
    error: Error,
    options: ActorMessageOptions = {}
  ): ActorMessage {
    return {
      type: `${originalMessage.type}_ERROR`,
      sender: originalMessage.receiver,
      receiver: originalMessage.sender,
      content: {
        error: error.message,
        stack: error.stack,
      },
      metadata: {
        ...options.metadata,
        originalMessageType: originalMessage.type,
      },
      timestamp: Date.now(),
    };
  }
} 