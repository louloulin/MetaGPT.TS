/**
 * Base type definitions for the actor system
 */

export interface BaseActorMessage {
  from: string;
  to: string;
  type: string;
  payload: Record<string, any>;
  correlationId?: string;
  replyTo?: string;
}

export type BaseMessageHandler = (message: BaseActorMessage) => Promise<void>;

export interface BaseActorState {
  [key: string]: any;
}

export interface IBaseActor {
  id: string;
  send(message: BaseActorMessage): Promise<void>;
  registerHandler(type: string, handler: BaseMessageHandler): void;
  start(): Promise<void>;
  stop(): Promise<void>;
} 