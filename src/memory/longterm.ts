import type { LongTermMemory, WorkingMemory } from './types';
import type { MemoryEntrySchema, MemoryQueryOptions } from './types';
import type { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import type { LLMProvider } from '../types/llm';

/**
 * Long-term memory implementation with persistence and consolidation
 * 
 * Features:
 * - Memory consolidation from working memory
 * - Memory forgetting for obsolete information
 * - Pattern recognition between memories
 * - Summary generation for compressed storage
 * - Persistent storage for memories
 */
export class LongTermMemoryImpl implements LongTermMemory {
  private memories: Map<string, z.infer<typeof MemoryEntrySchema>> = new Map();
  private llmProvider?: LLMProvider;
  private storagePath?: string;
  
  constructor(llmProvider?: LLMProvider, storagePath?: string) {
    this.llmProvider = llmProvider;
    this.storagePath = storagePath;
    
    // Load memories from storage if path is provided
    if (this.storagePath) {
      this.load().catch(err => {
        logger.warn('Failed to load memories from storage:', err);
      });
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
      importance: metadata.importance ?? 0.5,
      emotionalValence: metadata.emotionalValence ?? 0,
      embedding: metadata.embedding ?? [],
      relatedMemories: metadata.relatedMemories ?? [],
    };
    
    // Generate a summary if content is long and LLM provider is available
    if (content.length > 500 && this.llmProvider) {
      try {
        memory.summary = await this.generateSummary(content);
      } catch (error) {
        logger.warn('Failed to generate memory summary:', error);
      }
    }

    this.memories.set(memory.id, memory);
    
    // Auto-save if storage path is set
    if (this.storagePath) {
      this.persist().catch(err => {
        logger.warn('Failed to persist memories:', err);
      });
    }
    
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

    if (options.minImportance) {
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
      results = results.filter(m => {
        // Check in main content
        if (m.content.toLowerCase().includes(searchContent)) {
          return true;
        }
        
        // Check in summary if available
        if (m.summary && m.summary.toLowerCase().includes(searchContent)) {
          return true;
        }
        
        return false;
      });
    }

    // Apply custom sorting
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

    // Update access patterns for returned memories
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

    // Regenerate summary if content changed substantially and we have an LLM provider
    if (updates.content && 
        memory.content !== updates.content && 
        updates.content.length > 500 && 
        this.llmProvider) {
      try {
        updates.summary = await this.generateSummary(updates.content);
      } catch (error) {
        logger.warn('Failed to update memory summary:', error);
      }
    }

    Object.assign(memory, updates);
    this.memories.set(id, memory);
    
    // Auto-save if storage path is set
    if (this.storagePath) {
      this.persist().catch(err => {
        logger.warn('Failed to persist memories after update:', err);
      });
    }
  }

  /**
   * Delete a memory
   */
  public async delete(id: string): Promise<void> {
    this.memories.delete(id);
    
    // Remove from related memories
    for (const memory of this.memories.values()) {
      const index = memory.relatedMemories.indexOf(id);
      if (index >= 0) {
        memory.relatedMemories.splice(index, 1);
      }
    }
    
    // Auto-save if storage path is set
    if (this.storagePath) {
      this.persist().catch(err => {
        logger.warn('Failed to persist memories after deletion:', err);
      });
    }
  }

  /**
   * Clear all memories
   */
  public async clear(): Promise<void> {
    this.memories.clear();
    
    // Auto-save if storage path is set
    if (this.storagePath) {
      this.persist().catch(err => {
        logger.warn('Failed to persist memories after clear:', err);
      });
    }
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
    try {
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
          limit: 5,
        });

        // If a very similar memory exists, update its importance instead of creating new
        const exactMatch = similarMemories.find(m => 
          m.content === memory.content || 
          (m.summary && m.summary === memory.content) ||
          (memory.summary && memory.summary === m.content)
        );
        
        if (exactMatch) {
          await this.update(exactMatch.id, {
            importance: Math.max(exactMatch.importance, memory.importance),
            lastAccessed: Date.now(),
            accessCount: exactMatch.accessCount + 1,
            metadata: {
              ...exactMatch.metadata,
              lastReinforced: Date.now(),
            },
          });
          continue;
        }

        // For memories that don't have exact matches but are similar,
        // establish relationships between them
        const relatedIds: string[] = [];
        for (const similar of similarMemories) {
          if (this.calculateSimilarity(memory.content, similar.content) > 0.3) {
            relatedIds.push(similar.id);
            
            // Add bidirectional relationship
            if (!similar.relatedMemories.includes(memory.id)) {
              similar.relatedMemories.push(memory.id);
              this.memories.set(similar.id, similar);
            }
          }
        }

        // Evaluate importance based on:
        // - Explicit importance score
        // - Age of memory
        // - Number of related memories
        // - Access frequency
        const age = Date.now() - memory.timestamp;
        const ageImportanceReduction = Math.min(0.3, age / (30 * 24 * 60 * 60 * 1000) * 0.3); // 30% max reduction over 30 days
        
        const importance = Math.min(
          1,
          Math.max(
            0.1,
            memory.importance * 0.6 - // Base importance has higher weight
            ageImportanceReduction + // Age reduces importance
            (relatedIds.length * 0.05) + // Related memories boost importance slightly
            (Math.min(memory.accessCount, 10) * 0.02) // Access frequency provides minor boost
          )
        );

        // Generate summary for long content
        let summary = memory.summary;
        if (!summary && memory.content.length > 500 && this.llmProvider) {
          try {
            summary = await this.generateSummary(memory.content);
          } catch (error) {
            logger.warn('Failed to generate summary during consolidation:', error);
          }
        }

        // Add new memory with updated importance and relationship information
        await this.add(memory.content, memory.type, {
          ...memory.metadata,
          importance,
          originalId: memory.id,
          consolidatedAt: Date.now(),
          relatedMemories: relatedIds.concat(memory.relatedMemories || []),
          summary
        });
      }
    } catch (error) {
      logger.error('Error consolidating memories:', error);
    }
  }

  /**
   * Calculate text similarity
   * Simple implementation - in production use embeddings and cosine similarity
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Extract words, remove short ones (likely stop words)
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    if (words1.size === 0 || words2.size === 0) {
      return 0;
    }
    
    // Jaccard similarity: intersection / union
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
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
      
      // Check if memory hasn't been accessed recently
      const isRarelyAccessed = memory.accessCount < 2;
      
      // Only forget memories that are old and either unimportant or rarely accessed
      return isOld && (isUnimportant || isRarelyAccessed);
    });

    // Delete forgotten memories
    for (const memory of toForget) {
      await this.delete(memory.id);
    }
    
    logger.info(`Forgot ${toForget.length} memories from long-term memory`);
  }
  
  /**
   * Generate a summary of a memory
   */
  public async summarize(id: string): Promise<string> {
    const memory = await this.get(id);
    if (!memory) {
      throw new Error(`Memory ${id} not found`);
    }
    
    // If we already have a summary, return it
    if (memory.summary) {
      return memory.summary;
    }
    
    // Generate a new summary
    try {
      const summary = await this.generateSummary(memory.content);
      
      // Save the summary
      await this.update(id, { summary });
      
      return summary;
    } catch (error) {
      logger.error('Error generating summary:', error);
      return `Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  /**
   * Find patterns between memories
   */
  public async findPatterns(options: MemoryQueryOptions): Promise<{
    pattern: string;
    memories: z.infer<typeof MemoryEntrySchema>[];
    confidence: number;
  }[]> {
    if (!this.llmProvider) {
      throw new Error('LLM provider is required for pattern finding');
    }
    
    // Get memories matching the query
    const memories = await this.search({
      ...options,
      limit: options.limit || 20, // Limit the number of memories to analyze
    });
    
    if (memories.length < 2) {
      return [];
    }
    
    try {
      // Prepare memory content for pattern analysis
      const memoryTexts = memories.map(m => m.content).join('\n\n');
      
      // Create a prompt for the LLM to find patterns
      const prompt = `Analyze the following set of related memories and identify patterns, trends, or connections between them. 
For each pattern you identify, provide:
1. A clear description of the pattern
2. A confidence score from 0.0 to 1.0 indicating how certain you are of this pattern

Here are the memories to analyze:

${memoryTexts}

Identify at least 1 and at most 3 significant patterns. Return your analysis in the following JSON format:
[
  {
    "pattern": "Description of the pattern",
    "confidence": 0.85,
    "explanation": "Brief explanation of why this is a pattern"
  }
]`;

      // Get pattern analysis from LLM
      const response = await this.llmProvider.generate(prompt, {
        temperature: 0.7,
        maxTokens: 1000
      });
      
      // Extract JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/m);
      if (!jsonMatch) {
        logger.warn('Failed to extract JSON from pattern analysis response');
        return [];
      }
      
      // Parse patterns
      const patterns = JSON.parse(jsonMatch[0]);
      
      // Map to return format
      return patterns.map((p: any) => ({
        pattern: p.pattern,
        memories,
        confidence: p.confidence
      }));
    } catch (error) {
      logger.error('Error finding patterns in memories:', error);
      return [];
    }
  }
  
  /**
   * Store memories to persistent storage
   */
  public async persist(): Promise<void> {
    if (!this.storagePath) {
      throw new Error('Storage path is required for persistence');
    }
    
    try {
      // Ensure directory exists
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Convert memories to serializable format
      const serializedMemories = Array.from(this.memories.values());
      
      // Write to file
      fs.writeFileSync(
        this.storagePath,
        JSON.stringify(serializedMemories, null, 2),
        'utf8'
      );
      
      logger.debug(`Persisted ${serializedMemories.length} memories to ${this.storagePath}`);
    } catch (error) {
      logger.error('Error persisting memories:', error);
      throw error;
    }
  }
  
  /**
   * Load memories from persistent storage
   */
  public async load(): Promise<void> {
    if (!this.storagePath) {
      throw new Error('Storage path is required for loading memories');
    }
    
    try {
      // Check if file exists
      if (!fs.existsSync(this.storagePath)) {
        logger.info(`No memory file found at ${this.storagePath}, starting with empty memory`);
        return;
      }
      
      // Read file
      const data = fs.readFileSync(this.storagePath, 'utf8');
      
      // Parse memories
      const loadedMemories = JSON.parse(data) as z.infer<typeof MemoryEntrySchema>[];
      
      // Clear existing memories and load new ones
      this.memories.clear();
      for (const memory of loadedMemories) {
        this.memories.set(memory.id, memory);
      }
      
      logger.info(`Loaded ${loadedMemories.length} memories from ${this.storagePath}`);
    } catch (error) {
      logger.error('Error loading memories:', error);
      throw error;
    }
  }
  
  /**
   * Generate a summary for memory content
   */
  private async generateSummary(content: string): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider is required for summary generation');
    }
    
    const prompt = `Summarize the following text in a concise way that retains the most important information. 
The summary should be no more than 2-3 sentences.

Text to summarize:
${content}

Summary:`;

    const response = await this.llmProvider.generate(prompt, {
      temperature: 0.3,
      maxTokens: 200
    });
    
    return response.trim();
  }
} 