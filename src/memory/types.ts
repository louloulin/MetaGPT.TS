import { z } from 'zod';
import type { Message } from '../types/message';

/**
 * Memory entry schema for storing individual memories
 */
export const MemoryEntrySchema = z.object({
  /** Unique identifier for the memory */
  id: z.string().uuid(),
  /** Content of the memory */
  content: z.string(),
  /** Type of memory (e.g., conversation, fact, experience) */
  type: z.string(),
  /** Creation timestamp */
  timestamp: z.number().default(() => Date.now()),
  /** Associated metadata */
  metadata: z.record(z.any()).default({}),
  /** Importance score (0-1) */
  importance: z.number().min(0).max(1).default(0.5),
  /** Vector embedding for similarity search */
  embedding?: z.array(z.number()),
});

/**
 * Memory query options
 */
export interface MemoryQueryOptions {
  /** Content to search for */
  content?: string;
  /** Type of memories to search */
  type?: string;
  /** Time range start */
  startTime?: number;
  /** Time range end */
  endTime?: number;
  /** Minimum importance score */
  minImportance?: number;
  /** Maximum number of results */
  limit?: number;
  /** Metadata filters */
  metadata?: Record<string, any>;
}

/**
 * Memory interface for storing and retrieving memories
 */
export interface Memory {
  /** Add a new memory */
  add(content: string, type: string, metadata?: Record<string, any>): Promise<z.infer<typeof MemoryEntrySchema>>;
  /** Get a memory by ID */
  get(id: string): Promise<z.infer<typeof MemoryEntrySchema> | null>;
  /** Search memories by query options */
  search(options: MemoryQueryOptions): Promise<z.infer<typeof MemoryEntrySchema>[]>;
  /** Update a memory */
  update(id: string, updates: Partial<z.infer<typeof MemoryEntrySchema>>): Promise<void>;
  /** Delete a memory */
  delete(id: string): Promise<void>;
  /** Clear all memories */
  clear(): Promise<void>;
}

/**
 * Working memory interface for temporary storage
 */
export interface WorkingMemory extends Memory {
  /** Get current focus of attention */
  getFocus(): Promise<z.infer<typeof MemoryEntrySchema> | null>;
  /** Set focus of attention */
  setFocus(id: string): Promise<void>;
  /** Clear focus of attention */
  clearFocus(): Promise<void>;
}

/**
 * Long-term memory interface for persistent storage
 */
export interface LongTermMemory extends Memory {
  /** Consolidate memories from working memory */
  consolidate(workingMemory: WorkingMemory): Promise<void>;
  /** Forget old or unimportant memories */
  forget(options: MemoryQueryOptions): Promise<void>;
}

/**
 * Memory manager interface for coordinating different memory types
 */
export interface MemoryManager {
  /** Working memory instance */
  working: WorkingMemory;
  /** Long-term memory instance */
  longTerm: LongTermMemory;
  /** Initialize memory systems */
  init(): Promise<void>;
  /** Process a message through memory */
  processMessage(message: Message): Promise<void>;
  /** Retrieve relevant memories for context */
  getContext(message: Message): Promise<z.infer<typeof MemoryEntrySchema>[]>;
  /** Cleanup memory systems */
  cleanup(): Promise<void>;
} 