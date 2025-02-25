import type { WorkingMemory } from './types';
import type { MemoryEntrySchema, MemoryQueryOptions } from './types';
import type { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory implementation of working memory
 */
export class WorkingMemoryImpl implements WorkingMemory {
  private memories: Map<string, z.infer<typeof MemoryEntrySchema>> = new Map();
  private focusId: string | null = null;

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

    if (typeof options.minImportance === 'number') {
      results = results.filter(m => m.importance >= options.minImportance!);
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

    // Sort by timestamp and importance
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
    if (this.focusId === id) {
      this.focusId = null;
    }
  }

  /**
   * Clear all memories
   */
  public async clear(): Promise<void> {
    this.memories.clear();
    this.focusId = null;
  }

  /**
   * Get current focus of attention
   */
  public async getFocus(): Promise<z.infer<typeof MemoryEntrySchema> | null> {
    return this.focusId ? this.memories.get(this.focusId) || null : null;
  }

  /**
   * Set focus of attention
   */
  public async setFocus(id: string): Promise<void> {
    if (!this.memories.has(id)) {
      throw new Error(`Memory ${id} not found`);
    }
    this.focusId = id;
  }

  /**
   * Clear focus of attention
   */
  public async clearFocus(): Promise<void> {
    this.focusId = null;
  }
} 