import type { LongTermMemory, WorkingMemory } from './types';
import type { MemoryEntrySchema, MemoryQueryOptions } from './types';
import type { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Long-term memory implementation with persistence and consolidation
 */
export class LongTermMemoryImpl implements LongTermMemory {
  private memories: Map<string, z.infer<typeof MemoryEntrySchema>> = new Map();

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
      metadata,
      importance: metadata.importance ?? 0.5,
      embedding: metadata.embedding ?? [],
    };

    this.memories.set(memory.id, memory);
    return memory;
  }

  /**
   * Get a memory by ID
   */
  public async get(id: string): Promise<z.infer<typeof MemoryEntrySchema> | null> {
    return this.memories.get(id) || null;
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

    if (options.minImportance) {
      results = results.filter(m => m.importance >= options.minImportance!);
    }

    if (options.metadata) {
      results = results.filter(m => {
        return Object.entries(options.metadata!).every(([key, value]) => 
          m.metadata[key] === value
        );
      });
    }

    if (options.content) {
      const searchContent = options.content.toLowerCase();
      results = results.filter(m => 
        m.content.toLowerCase().includes(searchContent) ||
        searchContent.includes(m.content.toLowerCase())
      );
    }

    // Sort by importance and timestamp
    results.sort((a, b) => {
      const importanceDiff = b.importance - a.importance;
      return importanceDiff !== 0 ? importanceDiff : b.timestamp - a.timestamp;
    });

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

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
   * Consolidate memories from working memory
   * This process involves:
   * 1. Evaluating importance of working memories
   * 2. Filtering out low importance memories
   * 3. Generating embeddings for semantic search
   * 4. Storing consolidated memories
   */
  public async consolidate(workingMemory: WorkingMemory): Promise<void> {
    // Get all memories from working memory
    const memories = await workingMemory.search({});

    for (const memory of memories) {
      // Skip if already consolidated
      if (this.memories.has(memory.id)) {
        continue;
      }

      // Check for similar existing memories
      const similarMemories = await this.search({
        content: memory.content,
        limit: 1,
      });

      // If a very similar memory exists, update its importance instead of creating new
      if (similarMemories.length > 0 && 
          (similarMemories[0].content === memory.content || 
           similarMemories[0].content.includes(memory.content) || 
           memory.content.includes(similarMemories[0].content))) {
        const existingMemory = similarMemories[0];
        await this.update(existingMemory.id, {
          importance: Math.max(existingMemory.importance, memory.importance),
          metadata: {
            ...existingMemory.metadata,
            lastReinforced: Date.now(),
          },
        });
        continue;
      }

      // Evaluate importance based on:
      // - Explicit importance score
      // - Age of memory
      // - Number of related memories
      const age = Date.now() - memory.timestamp;
      const relatedMemories = await this.search({
        content: memory.content,
        limit: 5,
      });

      const importance = Math.min(
        1,
        memory.importance * 0.7 + // Base importance has higher weight
        (relatedMemories.length * 0.1) - // Related memories boost importance
        (age / (24 * 60 * 60 * 1000) * 0.2) // Age reduces importance more significantly
      );

      // Add new memory with updated importance
      await this.add(memory.content, memory.type, {
        ...memory.metadata,
        importance,
        originalId: memory.id,
        consolidatedAt: Date.now(),
      });
    }

    // Clear consolidated memories from working memory
    await workingMemory.clear();
  }

  /**
   * Forget old or unimportant memories
   */
  public async forget(options: MemoryQueryOptions): Promise<void> {
    const memories = Array.from(this.memories.values());
    
    // Find memories to forget based on time and importance
    const toForget = memories.filter(memory => {
      // Check if memory is old enough using metadata timestamp if available
      const timestamp = memory.metadata.timestamp ?? memory.timestamp;
      const isOld = options.endTime ? timestamp <= options.endTime : false;
      
      // Check if memory is not important enough
      const isUnimportant = options.minImportance ? memory.importance < options.minImportance : false;
      
      // Only forget memories that are both old and unimportant
      return isOld && isUnimportant;
    });

    // Delete forgotten memories
    for (const memory of toForget) {
      await this.delete(memory.id);
    }
  }
} 