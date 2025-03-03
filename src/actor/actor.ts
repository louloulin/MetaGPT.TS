/**
 * Actor Model Implementation
 * 
 * This module provides the foundation for a distributed actor-based system in MetaGPT.
 * Actors are isolated entities that communicate through message passing, making them 
 * suitable for distributed and concurrent processing.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import type { BaseActorMessage, BaseMessageHandler, IBaseActor, BaseActorState } from './base-types';

/**
 * Message interface for communication between actors
 */
export interface ActorMessage<T = any> {
  /**
   * Unique message identifier
   */
  id: string;
  
  /**
   * Sender actor ID
   */
  from: string;
  
  /**
   * Recipient actor ID (or '*' for broadcast)
   */
  to: string;
  
  /**
   * Message type for pattern matching
   */
  type: string;
  
  /**
   * Message payload
   */
  payload: T;
  
  /**
   * Creation timestamp
   */
  timestamp: number;
  
  /**
   * Optional correlation ID for tracking related messages
   */
  correlationId?: string;
  
  /**
   * Optional reply-to address for responses
   */
  replyTo?: string;
}

/**
 * Message handler function type
 */
export type MessageHandler<T = any> = (message: ActorMessage<T>, sender: Actor) => Promise<void>;

/**
 * Actor state that can be serialized and restored
 */
export interface ActorState {
  [key: string]: any;
}

/**
 * Actor interface defining the base capabilities of all actors
 */
export interface IActor {
  /**
   * Get actor ID
   */
  getId(): string;
  
  /**
   * Get actor type
   */
  getType(): string;
  
  /**
   * Send a message to another actor
   */
  send<T>(to: string, type: string, payload: T, options?: {correlationId?: string; replyTo?: string}): Promise<void>;
  
  /**
   * Send a message and wait for a response
   */
  request<T, R>(to: string, type: string, payload: T, timeout?: number): Promise<R>;
  
  /**
   * Receive a message from another actor
   */
  receive<T>(message: ActorMessage<T>, sender: Actor): Promise<void>;
  
  /**
   * Add a message handler for a specific message type
   */
  addHandler<T>(type: string, handler: MessageHandler<T>): void;
  
  /**
   * Remove a message handler
   */
  removeHandler(type: string): void;
  
  /**
   * Get current actor state
   */
  getState(): ActorState;
  
  /**
   * Restore actor state
   */
  setState(state: ActorState): void;
  
  /**
   * Start the actor
   */
  start(): Promise<void>;
  
  /**
   * Stop the actor
   */
  stop(): Promise<void>;
}

/**
 * Base Actor implementation
 */
export abstract class Actor implements IBaseActor {
  protected handlers: Map<string, BaseMessageHandler>;
  public readonly id: string;
  protected type: string;
  protected state: BaseActorState = {};
  protected started: boolean = false;
  protected eventEmitter: EventEmitter = new EventEmitter();
  
  constructor(type: string, id?: string) {
    this.id = id || uuidv4();
    this.type = type;
    this.handlers = new Map();
  }
  
  /**
   * Get actor ID
   */
  getId(): string {
    return this.id;
  }
  
  /**
   * Get actor type
   */
  getType(): string {
    return this.type;
  }
  
  /**
   * Send a message to another actor
   */
  async send<T>(
    to: string, 
    type: string, 
    payload: T, 
    options: {correlationId?: string; replyTo?: string} = {}
  ): Promise<void> {
    if (!this.started) {
      throw new Error(`Actor ${this.id} is not started`);
    }
    
    const message: ActorMessage<T> = {
      id: uuidv4(),
      from: this.id,
      to,
      type,
      payload,
      timestamp: Date.now(),
      correlationId: options.correlationId,
      replyTo: options.replyTo || this.id,
    };
    
    logger.debug(`Actor ${this.id} sending message to ${to}:`, { type, correlationId: options.correlationId });
    
    // In a real implementation, this would be sent through a transport layer
    // For now, we'll just use the ActorSystem to route it
    ActorSystem.getInstance().deliverMessage(message);
  }
  
  /**
   * Send a message and wait for a response
   */
  async request<T, R>(to: string, type: string, payload: T, timeout: number = 30000): Promise<R> {
    if (!this.started) {
      throw new Error(`Actor ${this.id} is not started`);
    }
    
    const correlationId = uuidv4();
    
    return new Promise<R>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.eventEmitter.removeAllListeners(`response:${correlationId}`);
        reject(new Error(`Request to ${to} timed out after ${timeout}ms`));
      }, timeout);
      
      // Set up response handler
      this.eventEmitter.once(`response:${correlationId}`, (response: ActorMessage<R>) => {
        clearTimeout(timeoutId);
        resolve(response.payload);
      });
      
      // Send the request message
      this.send(to, type, payload, { correlationId, replyTo: this.id })
        .catch(error => {
          clearTimeout(timeoutId);
          this.eventEmitter.removeAllListeners(`response:${correlationId}`);
          reject(error);
        });
    });
  }
  
  /**
   * Receive a message from another actor
   */
  async receive<T>(message: ActorMessage<T>, sender: Actor): Promise<void> {
    if (!this.started) {
      logger.warn(`Actor ${this.id} received message while not started, ignoring`);
      return;
    }
    
    logger.debug(`Actor ${this.id} received message from ${message.from}:`, { type: message.type });
    
    // Check if this is a response to a request
    if (message.correlationId && message.type === 'response') {
      this.eventEmitter.emit(`response:${message.correlationId}`, message);
      return;
    }
    
    // Find and execute the appropriate handler
    const handler = this.handlers.get(message.type);
    if (handler) {
      try {
        await handler(message, sender);
      } catch (error) {
        logger.error(`Error in actor ${this.id} while handling message ${message.type}:`, error);
      }
    } else {
      logger.warn(`Actor ${this.id} has no handler for message type ${message.type}`);
    }
  }
  
  /**
   * Add a message handler for a specific message type
   */
  addHandler<T>(type: string, handler: MessageHandler<T>): void {
    this.handlers.set(type, handler as MessageHandler);
  }
  
  /**
   * Remove a message handler
   */
  removeHandler(type: string): void {
    this.handlers.delete(type);
  }
  
  /**
   * Get current actor state
   */
  getState(): BaseActorState {
    return { ...this.state };
  }
  
  /**
   * Restore actor state
   */
  setState(state: BaseActorState): void {
    this.state = { ...state };
  }
  
  /**
   * Start the actor
   */
  async start(): Promise<void> {
    if (!this.started) {
      this.started = true;
      logger.info(`Actor ${this.id} (${this.type}) started`);
    }
  }
  
  /**
   * Stop the actor
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.started = false;
      logger.info(`Actor ${this.id} (${this.type}) stopped`);
    }
  }

  public registerHandler(type: string, handler: BaseMessageHandler): void {
    this.handlers.set(type, handler);
  }

  public async send(message: BaseActorMessage): Promise<void> {
    const handler = this.handlers.get(message.type);
    if (handler) {
      try {
        await handler(message);
      } catch (error) {
        logger.error(`Error handling message type ${message.type}: ${error}`);
      }
    } else {
      logger.warn(`No handler registered for message type: ${message.type}`);
    }
  }

  protected setState(newState: Partial<BaseActorState>): void {
    this.state = { ...this.state, ...newState };
    this.eventEmitter.emit('stateChanged', this.state);
  }
}

/**
 * ActorSystem manages all actors and handles message routing
 */
export class ActorSystem {
  private static instance: ActorSystem;
  private actors: Map<string, Actor> = new Map();
  
  private constructor() {
    // Private constructor to enforce singleton
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): ActorSystem {
    if (!ActorSystem.instance) {
      ActorSystem.instance = new ActorSystem();
    }
    return ActorSystem.instance;
  }
  
  /**
   * Register an actor with the system
   */
  async registerActor(actor: Actor): Promise<void> {
    const actorId = actor.getId();
    if (this.actors.has(actorId)) {
      throw new Error(`Actor ${actorId} is already registered`);
    }
    
    this.actors.set(actorId, actor);
    logger.debug(`Actor ${actorId} (${actor.getType()}) registered with the system`);
  }
  
  /**
   * Unregister an actor from the system
   */
  async unregisterActor(actorId: string): Promise<void> {
    if (!this.actors.has(actorId)) {
      logger.warn(`Attempted to unregister non-existent actor ${actorId}`);
      return;
    }
    
    this.actors.delete(actorId);
    logger.debug(`Actor ${actorId} unregistered from the system`);
  }
  
  /**
   * Deliver a message to its recipient
   */
  async deliverMessage<T>(message: ActorMessage<T>): Promise<void> {
    const { to, from } = message;
    
    if (to === '*') {
      // Broadcast message to all actors except sender
      const promises = Array.from(this.actors.entries())
        .filter(([id]) => id !== from)
        .map(([_, actor]) => actor.receive(message, this.actors.get(from)!));
      
      await Promise.all(promises);
      return;
    }
    
    // Direct message to specific actor
    const recipient = this.actors.get(to);
    if (!recipient) {
      logger.warn(`Cannot deliver message to non-existent actor ${to}`);
      return;
    }
    
    const sender = this.actors.get(from);
    if (!sender) {
      logger.warn(`Message from non-existent actor ${from}`);
      return;
    }
    
    await recipient.receive(message, sender);
  }
  
  /**
   * Get all registered actors
   */
  getActors(): Map<string, Actor> {
    return new Map(this.actors);
  }
  
  /**
   * Get an actor by ID
   */
  getActor(id: string): Actor | undefined {
    return this.actors.get(id);
  }
  
  /**
   * Find actors by type
   */
  findActorsByType(type: string): Actor[] {
    return Array.from(this.actors.values()).filter(actor => actor.getType() === type);
  }
} 