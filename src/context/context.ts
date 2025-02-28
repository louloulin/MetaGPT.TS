/**
 * Context Management System
 * 
 * Provides a flexible context system for storing and retrieving data across
 * different components of the application, with support for hierarchical contexts.
 * 
 * @module context/context
 * @category Core
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { LLMProvider } from '../types/llm';
import type { MemoryManager } from '../types/memory';

/**
 * Context interface defining the core functionality for the context management system.
 */
export interface Context {
  /**
   * Unique identifier for this context
   */
  readonly id: string;
  
  /**
   * Parent context, if any
   */
  readonly parent?: Context;
  
  /**
   * Data stored in this context
   */
  readonly data: Record<string, any>;
  
  /**
   * LLM provider for this context
   */
  llm?: LLMProvider;
  
  /**
   * Memory system for this context
   */
  memory?: MemoryManager;
  
  /**
   * Get a value from the context
   * @param key The key to retrieve
   * @returns The value associated with the key, or undefined if not found
   */
  get<T>(key: string): T | undefined;
  
  /**
   * Set a value in the context
   * @param key The key to set
   * @param value The value to associate with the key
   */
  set<T>(key: string, value: T): void;
  
  /**
   * Create a child context
   * @param data Initial data for the child context
   * @returns A new context with this context as its parent
   */
  createChild(data?: Record<string, any>): Context;
  
  /**
   * Serialize the context to a string
   * @returns A serialized representation of the context
   */
  serialize(): string;
  
  /**
   * Deserialize data into this context
   * @param serialized The serialized context data
   * @param includeParents Whether to replace parent contexts (defaults to false)
   */
  deserialize(serialized: string | Record<string, any>, includeParents?: boolean): void;
  
  /**
   * Check if a key exists in the context or its parents
   * @param key The key to check
   * @returns True if the key exists, false otherwise
   */
  has(key: string): boolean;
  
  /**
   * Get all keys in this context (not including parent contexts)
   * @returns Array of keys
   */
  keys(): string[];
  
  /**
   * Get all keys in this context and parent contexts
   * @returns Array of keys
   */
  allKeys(): string[];
  
  /**
   * Merge data into this context
   * @param data The data to merge
   */
  merge(data: Record<string, any>): void;
  
  /**
   * Get a nested context by path
   * @param path The path to the nested context (e.g., "parent.child")
   * @returns The nested context if found, undefined otherwise
   */
  getNestedContext(path: string): Context | undefined;
  
  /**
   * Create a nested context at the specified path
   * @param path The path to create the nested context at (e.g., "parent.child")
   * @param data Initial data for the context
   * @returns The created nested context
   */
  createNestedContext(path: string, data?: Record<string, any>): Context;
}

/**
 * Schema for validating context data
 */
export const ContextDataSchema = z.record(z.any());

/**
 * Implementation of the Context interface
 */
export class ContextImpl implements Context {
  readonly id: string;
  readonly parent?: Context;
  readonly data: Record<string, any>;
  
  // Add typed llm and memory properties
  llm?: LLMProvider;
  memory?: MemoryManager;
  
  /**
   * Create a new context
   * @param id Optional ID for the context (generated if not provided)
   * @param data Initial data for the context
   * @param parent Parent context, if any
   */
  constructor(id?: string, data: Record<string, any> = {}, parent?: Context) {
    this.id = id || uuidv4();
    this.data = ContextDataSchema.parse(data);
    this.parent = parent;
    
    // Initialize llm and memory from data if provided
    if (data.llm) {
      this.llm = data.llm;
      delete this.data.llm;
    } else if (parent?.llm) {
      this.llm = parent.llm;
    }
    
    if (data.memory) {
      this.memory = data.memory;
      delete this.data.memory;
    } else if (parent?.memory) {
      this.memory = parent.memory;
    }
  }
  
  /**
   * Get a value from this context or its parents
   * @param key The key to retrieve
   * @returns The value, or undefined if not found
   */
  get<T>(key: string): T | undefined {
    if (key in this.data) {
      return this.data[key] as T;
    }
    
    return this.parent?.get<T>(key);
  }
  
  /**
   * Set a value in this context
   * @param key The key to set
   * @param value The value to associate with the key
   */
  set<T>(key: string, value: T): void {
    this.data[key] = value;
  }
  
  /**
   * Create a child context
   * @param data Initial data for the child context
   * @returns A new context with this context as its parent
   */
  createChild(data: Record<string, any> = {}): Context {
    return new ContextImpl(undefined, data, this);
  }
  
  /**
   * Serialize the context to a JSON string
   * @returns A serialized representation of the context
   */
  serialize(): string {
    const serialized: Record<string, any> = {
      id: this.id,
      data: this.data,
      parentId: this.parent?.id
    };
    
    // Include full parent context chain
    if (this.parent) {
      serialized.parent = JSON.parse((this.parent as ContextImpl).serialize());
    }
    
    return JSON.stringify(serialized);
  }
  
  /**
   * Deserialize data into this context
   * @param serialized The serialized context data
   * @param includeParents Whether to replace parent contexts (defaults to false)
   */
  deserialize(serialized: string | Record<string, any>, includeParents: boolean = false): void {
    const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
    
    // Update ID and data
    Object.assign(this.data, parsed.data || {});
    
    // Handle parent context if enabled
    if (includeParents && parsed.parent && this.parent instanceof ContextImpl) {
      (this.parent as ContextImpl).deserialize(parsed.parent, true);
    }
  }
  
  /**
   * Check if a key exists in this context or its parents
   * @param key The key to check
   * @returns True if the key exists, false otherwise
   */
  has(key: string): boolean {
    if (key in this.data) {
      return true;
    }
    
    return this.parent?.has(key) || false;
  }
  
  /**
   * Get all keys in this context (not including parent contexts)
   * @returns Array of keys
   */
  keys(): string[] {
    return Object.keys(this.data);
  }
  
  /**
   * Get all keys in this context and parent contexts
   * @returns Array of keys
   */
  allKeys(): string[] {
    const keys = new Set(this.keys());
    
    if (this.parent) {
      (this.parent as ContextImpl).allKeys().forEach(key => keys.add(key));
    }
    
    return Array.from(keys);
  }
  
  /**
   * Merge data into this context
   * @param data The data to merge
   */
  merge(data: Record<string, any>): void {
    Object.entries(data).forEach(([key, value]) => {
      this.data[key] = value;
    });
  }
  
  /**
   * Get a nested context by path
   * @param path The path to the nested context (e.g., "parent.child")
   * @returns The nested context if found, undefined otherwise
   */
  getNestedContext(path: string): Context | undefined {
    const parts = path.split('.');
    
    if (parts.length === 0) {
      return this;
    }
    
    const currentPart = parts[0];
    const nextPath = parts.slice(1).join('.');
    
    // Check if the current part exists in this context
    const currentContext = this.get<Context>(currentPart);
    
    if (!currentContext) {
      return undefined;
    }
    
    // If there are no more parts, return the current context
    if (parts.length === 1) {
      return currentContext;
    }
    
    // Otherwise, continue traversing
    return (currentContext as ContextImpl).getNestedContext(nextPath);
  }
  
  /**
   * Create a nested context at the specified path
   * @param path The path to create the nested context at (e.g., "parent.child")
   * @param data Initial data for the context
   * @returns The created nested context
   */
  createNestedContext(path: string, data: Record<string, any> = {}): Context {
    const parts = path.split('.');
    
    if (parts.length === 0) {
      return this;
    }
    
    const currentPart = parts[0];
    const nextPath = parts.slice(1).join('.');
    
    // Check if the current part exists in this context
    let currentContext = this.get<Context>(currentPart);
    
    // If not, create it
    if (!currentContext) {
      currentContext = this.createChild({});
      this.set(currentPart, currentContext);
    }
    
    // If there are no more parts, merge the data and return
    if (parts.length === 1) {
      (currentContext as ContextImpl).merge(data);
      return currentContext;
    }
    
    // Otherwise, continue traversing
    return (currentContext as ContextImpl).createNestedContext(nextPath, data);
  }
}

/**
 * Context factory for creating new contexts
 */
export class ContextFactory {
  /**
   * Create a new root context
   * @param data Initial data for the context
   * @returns A new context with no parent
   */
  static createRoot(data: Record<string, any> = {}): Context {
    return new ContextImpl('root', data);
  }
  
  /**
   * Deserialize a context from a JSON string
   * @param serialized The serialized context
   * @param parentContextMap Optional map of parent contexts by ID
   * @returns A deserialized context
   */
  static deserialize(serialized: string, parentContextMap?: Map<string, Context>): Context {
    const parsed = JSON.parse(serialized);
    
    let parent: Context | undefined = undefined;
    
    // Handle parent reference or full parent object
    if (parsed.parent) {
      // Full parent object provided
      parent = ContextFactory.deserialize(JSON.stringify(parsed.parent));
    } else if (parsed.parentId && parentContextMap) {
      // Just parent ID provided
      parent = parentContextMap.get(parsed.parentId);
    }
    
    return new ContextImpl(parsed.id, parsed.data || {}, parent);
  }
}

/**
 * Global context singleton for application-wide state
 */
export class GlobalContext {
  private static instance: Context;
  
  /**
   * Get the global context instance
   * @returns The global context
   */
  static getInstance(): Context {
    if (!GlobalContext.instance) {
      GlobalContext.instance = ContextFactory.createRoot({
        appStartTime: new Date().toISOString()
      });
    }
    
    return GlobalContext.instance;
  }
  
  /**
   * Reset the global context
   * @param data Optional initial data for the new context
   */
  static reset(data: Record<string, any> = {}): void {
    GlobalContext.instance = ContextFactory.createRoot({
      appStartTime: new Date().toISOString(),
      ...data
    });
  }
} 