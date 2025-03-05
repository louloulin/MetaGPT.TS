/**
 * Multimodal Memory Module
 * 
 * This module provides memory management for multimodal content, enabling
 * storage, retrieval, and association of different modalities (text, images, etc.).
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import type { MediaContent, MediaType } from './multimodal-provider';
import type { ImageAnalysisResult } from './image-processor';
import { MultimodalCache } from './multimodal-cache';

// Schema for multimodal memory entry
export const MemoryEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  modality: z.enum(['text', 'image', 'audio', 'video', 'mixed']),
  content: z.union([
    z.string(),
    z.object({
      text: z.string().optional(),
      mediaItems: z.array(z.any()).optional(),
    }),
  ]),
  analysis: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  embedding: z.array(z.number()).optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(0).max(1).optional(),
  associations: z.array(z.string()).optional(),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

export interface MemoryQueryOptions {
  modality?: 'text' | 'image' | 'audio' | 'video' | 'mixed';
  timeRange?: { start?: number; end?: number };
  tags?: string[];
  metadata?: Record<string, any>;
  importanceThreshold?: number;
  limit?: number;
  sortBy?: 'time' | 'importance' | 'relevance';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Multimodal memory manager
 */
export class MultimodalMemory {
  private memories: Map<string, MemoryEntry>;
  private vectorStore?: any; // Placeholder for vector storage
  private cache: MultimodalCache;
  private decayRate: number;
  private consolidationThreshold: number;
  
  constructor(options: {
    cacheOptions?: any;
    decayRate?: number;
    consolidationThreshold?: number;
  } = {}) {
    this.memories = new Map();
    this.cache = new MultimodalCache(options.cacheOptions);
    this.decayRate = options.decayRate || 0.01; // Daily decay rate
    this.consolidationThreshold = options.consolidationThreshold || 3; // Number of recalls needed for consolidation
    
    logger.info('Initialized MultimodalMemory');
    
    // Setup periodic maintenance
    setInterval(() => this.performMaintenance(), 60 * 60 * 1000); // Every hour
  }
  
  /**
   * Store a text memory
   */
  storeTextMemory(
    text: string,
    metadata?: Record<string, any>,
    tags?: string[],
    importance?: number
  ): string {
    const id = uuidv4();
    const memory: MemoryEntry = {
      id,
      timestamp: Date.now(),
      modality: 'text',
      content: text,
      metadata,
      tags,
      importance: importance ?? 0.5,
      associations: [],
    };
    
    this.memories.set(id, memory);
    logger.debug(`Stored text memory: ${id}`);
    
    return id;
  }
  
  /**
   * Store an image memory
   */
  storeImageMemory(
    imageData: string | Buffer | Uint8Array,
    analysis?: ImageAnalysisResult,
    textDescription?: string,
    metadata?: Record<string, any>,
    tags?: string[],
    importance?: number
  ): string {
    const id = uuidv4();
    
    // Use cache to avoid duplicate storage
    let imageAnalysis = analysis;
    if (!imageAnalysis && typeof imageData !== 'string') {
      // Check cache for existing analysis
      const cachedAnalysis = this.cache.getImageAnalysis(imageData);
      if (cachedAnalysis) {
        imageAnalysis = cachedAnalysis;
      }
    }
    
    const memory: MemoryEntry = {
      id,
      timestamp: Date.now(),
      modality: 'image',
      content: {
        text: textDescription,
        mediaItems: [{ type: 'image', data: typeof imageData === 'string' ? imageData : 'binary-data' }],
      },
      analysis: imageAnalysis || undefined,
      metadata: {
        ...metadata,
        hasOriginalImage: true,
      },
      tags: tags || [],
      importance: importance ?? 0.5,
      associations: [],
    };
    
    this.memories.set(id, memory);
    logger.debug(`Stored image memory: ${id}`);
    
    return id;
  }
  
  /**
   * Store a mixed modality memory
   */
  storeMixedMemory(
    text: string,
    mediaItems: MediaContent[],
    analyses?: Record<string, any>,
    metadata?: Record<string, any>,
    tags?: string[],
    importance?: number
  ): string {
    const id = uuidv4();
    const memory: MemoryEntry = {
      id,
      timestamp: Date.now(),
      modality: 'mixed',
      content: {
        text,
        mediaItems: mediaItems.map(item => ({
          type: item.type,
          data: typeof item.data === 'string' ? item.data : 'binary-data',
          format: item.format,
        })),
      },
      analysis: analyses,
      metadata,
      tags,
      importance: importance ?? 0.6, // Mixed modalities slightly more important by default
      associations: [],
    };
    
    this.memories.set(id, memory);
    logger.debug(`Stored mixed memory: ${id}`);
    
    return id;
  }
  
  /**
   * Retrieve a specific memory by ID
   */
  getMemory(id: string): MemoryEntry | null {
    const memory = this.memories.get(id);
    
    if (!memory) {
      return null;
    }
    
    // Record access for importance calculation
    this.recordAccess(id);
    
    return memory;
  }
  
  /**
   * Search memories based on query parameters
   */
  queryMemories(options: MemoryQueryOptions = {}): MemoryEntry[] {
    let results = Array.from(this.memories.values());
    
    // Filter by modality
    if (options.modality) {
      results = results.filter(memory => memory.modality === options.modality);
    }
    
    // Filter by time range
    if (options.timeRange) {
      if (options.timeRange.start) {
        results = results.filter(memory => memory.timestamp >= (options.timeRange?.start ?? 0));
      }
      if (options.timeRange.end) {
        results = results.filter(memory => memory.timestamp <= (options.timeRange?.end ?? Infinity));
      }
    }
    
    // Filter by tags (any match)
    if (options.tags && options.tags.length > 0) {
      results = results.filter(memory => 
        memory.tags && memory.tags.some(tag => options.tags?.includes(tag))
      );
    }
    
    // Filter by metadata
    if (options.metadata) {
      results = results.filter(memory => {
        if (!memory.metadata) return false;
        
        return Object.entries(options.metadata || {}).every(([key, value]) => 
          memory.metadata?.[key] === value
        );
      });
    }
    
    // Filter by importance threshold
    if (options.importanceThreshold !== undefined) {
      results = results.filter(memory => 
        (memory.importance || 0) >= (options.importanceThreshold || 0)
      );
    }
    
    // Sort results
    const sortBy = options.sortBy || 'time';
    const sortDirection = options.sortDirection || 'desc';
    
    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'time':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'importance':
          comparison = (a.importance || 0) - (b.importance || 0);
          break;
        case 'relevance':
          // Relevance would normally use embeddings
          // For now, just use recency as a proxy
          comparison = a.timestamp - b.timestamp;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }
    
    // Record access for importance calculation
    results.forEach(memory => this.recordAccess(memory.id));
    
    return results;
  }
  
  /**
   * Search memories by semantic similarity (placeholder - would use embeddings)
   */
  searchSimilar(query: string, options: MemoryQueryOptions = {}): MemoryEntry[] {
    // This is a placeholder. In a real implementation, we would use embeddings
    // For now, just do a basic text search
    let results = Array.from(this.memories.values()).filter(memory => {
      if (typeof memory.content === 'string') {
        return memory.content.toLowerCase().includes(query.toLowerCase());
      } else if (memory.content && typeof memory.content === 'object' && 'text' in memory.content) {
        return memory.content.text?.toLowerCase().includes(query.toLowerCase());
      }
      return false;
    });
    
    // Apply other filters from options
    if (options.modality) {
      results = results.filter(memory => memory.modality === options.modality);
    }
    
    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }
    
    // Record access for importance calculation
    results.forEach(memory => this.recordAccess(memory.id));
    
    return results;
  }
  
  /**
   * Create an association between memories
   */
  associate(sourceId: string, targetId: string, bidirectional: boolean = true): boolean {
    const source = this.memories.get(sourceId);
    const target = this.memories.get(targetId);
    
    if (!source || !target) {
      return false;
    }
    
    // Add association to source
    if (!source.associations) {
      source.associations = [];
    }
    
    if (!source.associations.includes(targetId)) {
      source.associations.push(targetId);
    }
    
    // Add bidirectional association if requested
    if (bidirectional) {
      if (!target.associations) {
        target.associations = [];
      }
      
      if (!target.associations.includes(sourceId)) {
        target.associations.push(sourceId);
      }
    }
    
    return true;
  }
  
  /**
   * Get associated memories
   */
  getAssociations(id: string): MemoryEntry[] {
    const memory = this.memories.get(id);
    
    if (!memory || !memory.associations || memory.associations.length === 0) {
      return [];
    }
    
    return memory.associations
      .map(assocId => this.memories.get(assocId))
      .filter((m): m is MemoryEntry => m !== undefined);
  }
  
  /**
   * Update memory metadata
   */
  updateMetadata(id: string, metadata: Record<string, any>): boolean {
    const memory = this.memories.get(id);
    
    if (!memory) {
      return false;
    }
    
    memory.metadata = {
      ...memory.metadata,
      ...metadata,
    };
    
    return true;
  }
  
  /**
   * Update memory tags
   */
  updateTags(id: string, tags: string[]): boolean {
    const memory = this.memories.get(id);
    
    if (!memory) {
      return false;
    }
    
    memory.tags = tags;
    return true;
  }
  
  /**
   * Set memory importance manually
   */
  setImportance(id: string, importance: number): boolean {
    const memory = this.memories.get(id);
    
    if (!memory) {
      return false;
    }
    
    // Clamp importance between 0 and 1
    memory.importance = Math.min(1, Math.max(0, importance));
    return true;
  }
  
  /**
   * Delete a memory
   */
  deleteMemory(id: string): boolean {
    // Remove associations to this memory
    for (const memory of this.memories.values()) {
      if (memory.associations) {
        memory.associations = memory.associations.filter(assocId => assocId !== id);
      }
    }
    
    return this.memories.delete(id);
  }
  
  /**
   * Get memory statistics
   */
  getStats(): {
    totalMemories: number;
    byModality: Record<string, number>;
    avgImportance: number;
    oldestMemory: number;
    newestMemory: number;
  } {
    const stats = {
      totalMemories: this.memories.size,
      byModality: {
        text: 0,
        image: 0,
        audio: 0,
        video: 0,
        mixed: 0,
      },
      avgImportance: 0,
      oldestMemory: Date.now(),
      newestMemory: 0,
    };
    
    let totalImportance = 0;
    
    for (const memory of this.memories.values()) {
      // Count by modality
      if (stats.byModality[memory.modality] !== undefined) {
        stats.byModality[memory.modality]++;
      }
      
      // Track importance
      totalImportance += memory.importance || 0;
      
      // Track time range
      if (memory.timestamp < stats.oldestMemory) {
        stats.oldestMemory = memory.timestamp;
      }
      if (memory.timestamp > stats.newestMemory) {
        stats.newestMemory = memory.timestamp;
      }
    }
    
    // Calculate average importance
    stats.avgImportance = this.memories.size > 0 
      ? totalImportance / this.memories.size 
      : 0;
    
    return stats;
  }
  
  /**
   * Record memory access for recency calculations
   */
  private recordAccess(id: string): void {
    const memory = this.memories.get(id);
    
    if (memory) {
      // Update access count in metadata
      if (!memory.metadata) {
        memory.metadata = {};
      }
      
      memory.metadata.accessCount = (memory.metadata.accessCount || 0) + 1;
      memory.metadata.lastAccessed = Date.now();
      
      // Consider consolidation (increase importance) based on access frequency
      if (memory.metadata.accessCount >= this.consolidationThreshold) {
        this.consolidateMemory(memory);
      }
    }
  }
  
  /**
   * Consolidate important memories (increase importance)
   */
  private consolidateMemory(memory: MemoryEntry): void {
    if (!memory.importance) {
      memory.importance = 0.5;
    }
    
    // Increase importance, but cap at 1.0
    memory.importance = Math.min(1.0, memory.importance + 0.1);
    
    // Reset consolidation counter
    if (memory.metadata) {
      memory.metadata.accessCount = 0;
    }
    
    logger.debug(`Consolidated memory ${memory.id}, new importance: ${memory.importance}`);
  }
  
  /**
   * Apply memory decay based on time and importance
   */
  private applyDecay(): void {
    const now = Date.now();
    
    for (const memory of this.memories.values()) {
      // Skip if no importance set
      if (memory.importance === undefined) {
        continue;
      }
      
      // Calculate age in days
      const ageInDays = (now - memory.timestamp) / (1000 * 60 * 60 * 24);
      
      // Apply decay based on age
      const decay = this.decayRate * ageInDays;
      memory.importance = Math.max(0, memory.importance - decay);
    }
  }
  
  /**
   * Perform periodic maintenance tasks
   */
  private performMaintenance(): void {
    logger.debug('Performing memory maintenance');
    
    // Apply memory decay
    this.applyDecay();
    
    // Forget very unimportant old memories
    const now = Date.now();
    const forgottenIds: string[] = [];
    
    for (const [id, memory] of this.memories.entries()) {
      // Only consider memories older than 30 days
      const ageInDays = (now - memory.timestamp) / (1000 * 60 * 60 * 24);
      
      if (ageInDays > 30 && (memory.importance || 0) < 0.1) {
        this.memories.delete(id);
        forgottenIds.push(id);
      }
    }
    
    if (forgottenIds.length > 0) {
      logger.debug(`Forgot ${forgottenIds.length} unimportant memories`);
    }
  }
} 