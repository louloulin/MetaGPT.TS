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
  /** Last accessed timestamp */
  lastAccessed: z.number().default(() => Date.now()),
  /** Number of times this memory has been accessed */
  accessCount: z.number().default(0),
  /** Associated metadata */
  metadata: z.record(z.any()).default({}),
  /** Importance score (0-1) */
  importance: z.number().min(0).max(1).default(0.5),
  /** Emotional valence (-1 to 1) */
  emotionalValence: z.number().min(-1).max(1).default(0),
  /** Vector embedding for similarity search */
  embedding: z.array(z.number()).optional(),
  /** Compressed/summarized version of the memory content */
  summary: z.string().optional(),
  /** Reference to related memory IDs */
  relatedMemories: z.array(z.string()).default([]),
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
  /** Emotional valence range (min) */
  minValence?: number;
  /** Emotional valence range (max) */
  maxValence?: number;
  /** Query vector for semantic search */
  queryVector?: number[];
  /** Number of similar memories to retrieve in vector search */
  similarityCount?: number;
  /** Sort by recency of access */
  sortByRecency?: boolean;
  /** Sort by frequency of access */
  sortByFrequency?: boolean;
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
 * Short-term memory interface for temporary, highly accessible memories
 */
export interface ShortTermMemory extends Memory {
  /** Get current active memories (recent and important) */
  getActive(): Promise<z.infer<typeof MemoryEntrySchema>[]>;
  /** Transfer memories to working memory based on criteria */
  transferToWorking(workingMemory: WorkingMemory): Promise<void>;
  /** Set capacity for short-term memory */
  setCapacity(capacity: number): void;
  /** Get current capacity */
  getCapacity(): number;
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
  /** Get related memories for a given memory */
  getRelatedMemories(id: string): Promise<z.infer<typeof MemoryEntrySchema>[]>;
}

/**
 * Long-term memory interface for persistent storage
 */
export interface LongTermMemory extends Memory {
  /** Consolidate memories from working memory */
  consolidate(workingMemory: WorkingMemory): Promise<void>;
  /** Forget old or unimportant memories */
  forget(options: MemoryQueryOptions): Promise<void>;
  /** Generate a summary of a memory */
  summarize(id: string): Promise<string>;
  /** Find patterns between memories */
  findPatterns(options: MemoryQueryOptions): Promise<{
    pattern: string;
    memories: z.infer<typeof MemoryEntrySchema>[];
    confidence: number;
  }[]>;
  /** Store memories to persistent storage */
  persist(): Promise<void>;
  /** Load memories from persistent storage */
  load(): Promise<void>;
}

/**
 * Memory manager interface for coordinating different memory types
 */
export interface MemoryManager {
  /** Short-term memory instance */
  shortTerm: ShortTermMemory;
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
  /** Update memory access patterns */
  updateAccess(id: string): Promise<void>;
  /** Generate a memory importance score */
  calculateImportance(content: string, metadata?: Record<string, any>): Promise<number>;
  /** Cleanup memory systems */
  cleanup(): Promise<void>;
} 