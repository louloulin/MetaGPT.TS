import type { WorkingMemory } from './types';
import type { MemoryEntrySchema, MemoryQueryOptions } from './types';
import type { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * In-memory implementation of working memory
 * 
 * Features:
 * - Focus of attention mechanism
 * - Efficient search and retrieval
 * - Related memories tracking
 * - Access patterns monitoring
 */
export class WorkingMemoryImpl implements WorkingMemory {
  private memories: Map<string, z.infer<typeof MemoryEntrySchema>> = new Map();
  private focusId: string | null = null;
  private capacity: number = 50; // Working memory has larger capacity than short-term

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
      timestamp: metadata.timestamp || Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      metadata,
      importance: metadata.importance ?? 0.5,
      emotionalValence: metadata.emotionalValence ?? 0,
      embedding: metadata.embedding ?? [],
      summary: metadata.summary,
      relatedMemories: metadata.relatedMemories ?? [],
    };

    // Auto-link with similar memories
    await this.linkWithSimilarMemories(memory);

    this.memories.set(memory.id, memory);
    
    // If over capacity, remove least important memories
    this.enforceCapacity();
    
    return memory;
  }

  /**
   * Auto-link a new memory with similar existing memories
   */
  private async linkWithSimilarMemories(
    memory: z.infer<typeof MemoryEntrySchema>
  ): Promise<void> {
    try {
      // Find similar memories based on content
      const similarMemories = Array.from(this.memories.values())
        .filter(m => {
          // Skip if already linked
          if (m.relatedMemories.includes(memory.id) || memory.relatedMemories.includes(m.id)) {
            return false;
          }
          
          // Check for content similarity (simple text matching for now)
          // In a real implementation, this would use vector similarity
          const contentSimilarity = this.calculateTextSimilarity(
            m.content.toLowerCase(),
            memory.content.toLowerCase()
          );
          
          return contentSimilarity > 0.3; // Threshold for considering memories related
        })
        .slice(0, 5); // Limit to top 5 similar memories
      
      // Create bidirectional links
      for (const similar of similarMemories) {
        // Add to the new memory's related list
        if (!memory.relatedMemories.includes(similar.id)) {
          memory.relatedMemories.push(similar.id);
        }
        
        // Add to the existing memory's related list
        const existingMemory = this.memories.get(similar.id);
        if (existingMemory && !existingMemory.relatedMemories.includes(memory.id)) {
          existingMemory.relatedMemories.push(memory.id);
          this.memories.set(existingMemory.id, existingMemory);
        }
      }
    } catch (error) {
      logger.error('Error linking memories:', error);
    }
  }

  /**
   * Calculate text similarity score (Jaccard similarity of word sets)
   * This is a simple implementation - in production, use embeddings and cosine similarity
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
    
    if (words1.size === 0 || words2.size === 0) {
      return 0;
    }
    
    // Calculate intersection
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    
    // Calculate union
    const union = new Set([...words1, ...words2]);
    
    // Jaccard similarity
    return intersection.size / union.size;
  }

  /**
   * Enforce memory capacity limits
   */
  private enforceCapacity(): void {
    if (this.memories.size <= this.capacity) {
      return;
    }

    // Sort memories by combined score of importance, recency and access frequency
    const sortedMemories = Array.from(this.memories.values())
      .sort((a, b) => {
        // Focused memory should always be kept
        if (a.id === this.focusId) return 1;
        if (b.id === this.focusId) return -1;
        
        // Score based on importance, recency, and access frequency
        const now = Date.now();
        const recencyScoreA = (now - a.lastAccessed) / (24 * 60 * 60 * 1000); // Normalize to days
        const recencyScoreB = (now - b.lastAccessed) / (24 * 60 * 60 * 1000);
        
        const scoreA = (a.importance * 0.6) + 
                      (1 / (1 + recencyScoreA) * 0.25) + 
                      (Math.min(a.accessCount, 10) / 10 * 0.15);
        
        const scoreB = (b.importance * 0.6) + 
                      (1 / (1 + recencyScoreB) * 0.25) + 
                      (Math.min(b.accessCount, 10) / 10 * 0.15);
        
        return scoreA - scoreB;
      });

    // Remove lowest scoring memories until we're within capacity
    // But keep the focus memory and its related memories
    const protectedIds = new Set<string>();
    if (this.focusId) {
      protectedIds.add(this.focusId);
      
      // Add directly related memories to protected set
      const focusMemory = this.memories.get(this.focusId);
      if (focusMemory && focusMemory.relatedMemories) {
        focusMemory.relatedMemories.forEach(id => protectedIds.add(id));
      }
    }

    // Remove memories until we're within capacity, skipping protected ones
    while (this.memories.size > this.capacity && sortedMemories.length > 0) {
      const memory = sortedMemories.shift();
      if (memory && !protectedIds.has(memory.id)) {
        this.memories.delete(memory.id);
      }
    }
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

    // Custom sorting based on options
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
    
    // If content changed significantly, re-evaluate related memories
    if (updates.content && 
        this.calculateTextSimilarity(memory.content, updates.content) < 0.7) {
      memory.content = updates.content;
      // Clear existing relations and re-link
      memory.relatedMemories = [];
      await this.linkWithSimilarMemories(memory);
    }
    
    this.memories.set(id, memory);
  }

  /**
   * Delete a memory
   */
  public async delete(id: string): Promise<void> {
    // Remove from related memories lists
    for (const memory of this.memories.values()) {
      const relatedIndex = memory.relatedMemories.indexOf(id);
      if (relatedIndex >= 0) {
        memory.relatedMemories.splice(relatedIndex, 1);
      }
    }
    
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
    if (!this.focusId) return null;
    
    const focusMemory = this.memories.get(this.focusId);
    if (focusMemory) {
      // Update access information
      focusMemory.lastAccessed = Date.now();
      focusMemory.accessCount += 1;
      return focusMemory;
    }
    
    return null;
  }

  /**
   * Set focus of attention
   */
  public async setFocus(id: string): Promise<void> {
    if (!this.memories.has(id)) {
      throw new Error(`Memory ${id} not found`);
    }
    
    // Update the focus memory
    const memory = this.memories.get(id);
    if (memory) {
      memory.lastAccessed = Date.now();
      memory.accessCount += 1;
      memory.importance = Math.min(1, memory.importance + 0.1); // Increase importance
    }
    
    this.focusId = id;
  }

  /**
   * Clear focus of attention
   */
  public async clearFocus(): Promise<void> {
    this.focusId = null;
  }

  /**
   * Get related memories for a given memory
   */
  public async getRelatedMemories(id: string): Promise<z.infer<typeof MemoryEntrySchema>[]> {
    const memory = this.memories.get(id);
    if (!memory) {
      throw new Error(`Memory ${id} not found`);
    }
    
    const relatedMemories: z.infer<typeof MemoryEntrySchema>[] = [];
    
    // Collect directly linked memories
    for (const relatedId of memory.relatedMemories) {
      const related = this.memories.get(relatedId);
      if (related) {
        related.lastAccessed = Date.now();
        related.accessCount += 1;
        relatedMemories.push(related);
      }
    }
    
    // If we have few direct relations, add semantically similar ones
    if (relatedMemories.length < 3) {
      const similarMemories = Array.from(this.memories.values())
        .filter(m => {
          // Skip if it's the same memory or already included
          if (m.id === id || relatedMemories.some(r => r.id === m.id)) {
            return false;
          }
          
          // Check for content similarity
          const similarity = this.calculateTextSimilarity(
            m.content.toLowerCase(),
            memory.content.toLowerCase()
          );
          
          return similarity > 0.2;
        })
        .sort((a, b) => {
          // Sort by similarity (would use embedding similarity in production)
          const simA = this.calculateTextSimilarity(
            a.content.toLowerCase(),
            memory.content.toLowerCase()
          );
          const simB = this.calculateTextSimilarity(
            b.content.toLowerCase(),
            memory.content.toLowerCase()
          );
          return simB - simA;
        })
        .slice(0, 5 - relatedMemories.length);
      
      // Add to results and update access patterns
      for (const similar of similarMemories) {
        similar.lastAccessed = Date.now();
        similar.accessCount += 1;
        relatedMemories.push(similar);
      }
    }
    
    return relatedMemories;
  }
} 