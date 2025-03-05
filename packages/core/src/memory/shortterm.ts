import type { ShortTermMemory, WorkingMemory } from './types';
import type { MemoryEntrySchema, MemoryQueryOptions } from './types';
import type { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Short-term memory implementation
 * 
 * Features:
 * - Fast access to recent memories
 * - Limited capacity with automatic forgetting
 * - Transfer to working memory based on importance and recency
 * - Automatic decay of memory importance over time
 */
export class ShortTermMemoryImpl implements ShortTermMemory {
  private memories: Map<string, z.infer<typeof MemoryEntrySchema>> = new Map();
  private capacity: number = 20; // Default capacity
  private decayInterval: NodeJS.Timeout | null = null;

  constructor(capacity?: number) {
    if (capacity) {
      this.capacity = capacity;
    }
    // Start decay process
    this.startDecay();
  }

  /**
   * Start the automatic decay process for short-term memories
   */
  private startDecay(): void {
    // Run decay every 30 seconds
    this.decayInterval = setInterval(() => {
      this.applyDecay();
    }, 30 * 1000);
  }

  /**
   * Stop the automatic decay process
   */
  public stopDecay(): void {
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = null;
    }
  }

  /**
   * Apply decay to all memories
   * Newer memories decay slower than older ones
   */
  private applyDecay(): void {
    const now = Date.now();
    const decayFactor = 0.95; // 5% decay per interval

    for (const memory of this.memories.values()) {
      // Calculate age in minutes
      const ageInMinutes = (now - memory.timestamp) / (60 * 1000);
      
      // Apply decay based on age
      // Newer memories decay slower
      const decayRate = Math.min(0.2, 0.01 * ageInMinutes);
      memory.importance *= Math.max(decayFactor, 1 - decayRate);
      
      // Remove memories that fall below threshold
      if (memory.importance < 0.05) {
        this.memories.delete(memory.id);
      }
    }

    // Enforce capacity limit
    this.enforceCapacity();
  }

  /**
   * Enforce the memory capacity limit
   * Remove least important memories when over capacity
   */
  private enforceCapacity(): void {
    if (this.memories.size <= this.capacity) {
      return;
    }

    // Sort memories by importance and recency
    const sortedMemories = Array.from(this.memories.values())
      .sort((a, b) => {
        // Combined score of importance and recency
        const scoreA = a.importance * 0.7 + (a.lastAccessed / Date.now()) * 0.3;
        const scoreB = b.importance * 0.7 + (b.lastAccessed / Date.now()) * 0.3;
        return scoreA - scoreB;
      });

    // Remove least important memories until we're within capacity
    while (sortedMemories.length > this.capacity) {
      const memory = sortedMemories.shift();
      if (memory) {
        this.memories.delete(memory.id);
      }
    }
  }

  /**
   * Add a new memory
   */
  public async add(
    content: string,
    type: string,
    metadata: Record<string, any> = {}
  ): Promise<z.infer<typeof MemoryEntrySchema>> {
    const memory = {
      id: uuidv4(),
      content,
      type,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      metadata,
      importance: metadata.importance ?? 0.7, // Short-term memories start with higher importance
      emotionalValence: metadata.emotionalValence ?? 0,
      embedding: metadata.embedding ?? [],
      relatedMemories: metadata.relatedMemories ?? [],
    };

    this.memories.set(memory.id, memory);
    
    // Enforce capacity limit
    this.enforceCapacity();
    
    return memory;
  }

  /**
   * Get a memory by ID
   */
  public async get(id: string): Promise<z.infer<typeof MemoryEntrySchema> | null> {
    const memory = this.memories.get(id);
    
    if (memory) {
      // Update access information
      memory.lastAccessed = Date.now();
      memory.accessCount += 1;
      
      // Increase importance slightly each time it's accessed
      memory.importance = Math.min(1, memory.importance + 0.05);
    }
    
    return memory || null;
  }

  /**
   * Search memories by query options
   */
  public async search(options: MemoryQueryOptions): Promise<z.infer<typeof MemoryEntrySchema>[]> {
    let results = Array.from(this.memories.values());

    // Apply filters
    if (options.type) {
      results = results.filter(m => m.type === options.type);
    }

    if (options.startTime) {
      results = results.filter(m => m.timestamp >= options.startTime!);
    }

    if (options.endTime) {
      results = results.filter(m => m.timestamp <= options.endTime!);
    }

    if (typeof options.minImportance === 'number') {
      results = results.filter(m => m.importance >= options.minImportance!);
    }

    if (typeof options.minValence === 'number') {
      results = results.filter(m => m.emotionalValence >= options.minValence!);
    }

    if (typeof options.maxValence === 'number') {
      results = results.filter(m => m.emotionalValence <= options.maxValence!);
    }

    if (options.metadata) {
      results = results.filter(m => {
        return Object.entries(options.metadata!).every(([key, value]) => {
          if (typeof value === 'function') {
            return value(m.metadata[key]);
          }
          return m.metadata[key] === value;
        });
      });
    }

    if (options.content) {
      const searchContent = options.content.toLowerCase();
      results = results.filter(m => 
        m.content.toLowerCase().includes(searchContent)
      );
    }

    // Apply sorting
    if (options.sortByRecency) {
      results.sort((a, b) => b.lastAccessed - a.lastAccessed);
    } else if (options.sortByFrequency) {
      results.sort((a, b) => b.accessCount - a.accessCount);
    } else {
      // Default sorting by importance and timestamp
      results.sort((a, b) => {
        const importanceDiff = b.importance - a.importance;
        return importanceDiff !== 0 ? importanceDiff : b.timestamp - a.timestamp;
      });
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    // Update access information for all returned memories
    results.forEach(memory => {
      const storedMemory = this.memories.get(memory.id);
      if (storedMemory) {
        storedMemory.lastAccessed = Date.now();
        storedMemory.accessCount += 1;
      }
    });

    return results;
  }

  /**
   * Update a memory
   */
  public async update(
    id: string,
    updates: Partial<z.infer<typeof MemoryEntrySchema>>
  ): Promise<void> {
    const memory = this.memories.get(id);
    if (!memory) {
      throw new Error(`Memory ${id} not found`);
    }

    Object.assign(memory, updates);
    this.memories.set(id, memory);
  }

  /**
   * Delete a memory
   */
  public async delete(id: string): Promise<void> {
    this.memories.delete(id);
  }

  /**
   * Clear all memories
   */
  public async clear(): Promise<void> {
    this.memories.clear();
  }

  /**
   * Get active memories (recently accessed or high importance)
   */
  public async getActive(): Promise<z.infer<typeof MemoryEntrySchema>[]> {
    const now = Date.now();
    const recentThreshold = now - (5 * 60 * 1000); // 5 minutes
    const importanceThreshold = 0.6;

    return Array.from(this.memories.values())
      .filter(memory => 
        memory.lastAccessed >= recentThreshold || 
        memory.importance >= importanceThreshold
      )
      .sort((a, b) => {
        // Score is a combination of recency and importance
        const scoreA = (a.lastAccessed / now) * 0.5 + a.importance * 0.5;
        const scoreB = (b.lastAccessed / now) * 0.5 + b.importance * 0.5;
        return scoreB - scoreA;
      });
  }

  /**
   * Transfer important memories to working memory
   */
  public async transferToWorking(workingMemory: WorkingMemory): Promise<void> {
    try {
      // Get memories that are important or frequently accessed
      const memoriesToTransfer = Array.from(this.memories.values())
        .filter(memory => 
          memory.importance >= 0.7 || 
          memory.accessCount >= 3
        );

      for (const memory of memoriesToTransfer) {
        // Transfer to working memory with reference to original
        await workingMemory.add(
          memory.content,
          memory.type,
          {
            ...memory.metadata,
            originalId: memory.id,
            fromShortTerm: true,
            timestamp: memory.timestamp,
            importance: memory.importance,
            emotionalValence: memory.emotionalValence,
            relatedMemories: memory.relatedMemories,
          }
        );

        // Log this transfer for debugging
        logger.debug(`Transferred memory ${memory.id} from short-term to working memory`);
      }
    } catch (error) {
      logger.error('Error transferring memories to working memory:', error);
    }
  }

  /**
   * Set capacity for short-term memory
   */
  public setCapacity(capacity: number): void {
    this.capacity = capacity;
    this.enforceCapacity();
  }

  /**
   * Get current capacity
   */
  public getCapacity(): number {
    return this.capacity;
  }
} 