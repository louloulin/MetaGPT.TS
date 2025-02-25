import type { MemoryManager } from './types';
import type { Message } from '../types/message';
import type { z } from 'zod';
import type { MemoryEntrySchema } from './types';
import { WorkingMemoryImpl } from './working';
import { LongTermMemoryImpl } from './longterm';

/**
 * Memory manager implementation for coordinating working and long-term memory
 */
export class MemoryManagerImpl implements MemoryManager {
  public readonly working: WorkingMemoryImpl;
  public readonly longTerm: LongTermMemoryImpl;

  constructor() {
    this.working = new WorkingMemoryImpl();
    this.longTerm = new LongTermMemoryImpl();
  }

  /**
   * Initialize memory systems
   */
  public async init(): Promise<void> {
    // Initialize working memory
    await this.working.clear();

    // Initialize long-term memory
    await this.longTerm.clear();
  }

  /**
   * Process a message through memory systems
   * This involves:
   * 1. Storing the message in working memory
   * 2. Updating importance based on context
   * 3. Triggering consolidation if needed
   */
  public async processMessage(message: Message): Promise<void> {
    // Store message in working memory
    const memory = await this.working.add(message.content, 'message', {
      role: message.role,
      causedBy: message.causedBy,
      sentFrom: message.sentFrom,
      sendTo: Array.from(message.sendTo),
      instructContent: message.instructContent,
      timestamp: Date.now(),
    });

    // Update importance based on:
    // - Message role (system > assistant > user)
    // - Presence of instruction content
    // - Number of recipients
    let importance = 0.5;
    
    if (message.role === 'system') {
      importance += 0.3;
    } else if (message.role === 'assistant') {
      importance += 0.2;
    }

    if (message.instructContent) {
      importance += 0.1;
    }

    if (message.sendTo.size > 1) {
      importance += 0.1;
    }

    await this.working.update(memory.id, { importance });

    // Get working memory size
    const workingMemories = await this.working.search({});

    // Trigger consolidation if working memory is too large
    if (workingMemories.length > 100) {
      await this.longTerm.consolidate(this.working);
    }
  }

  /**
   * Retrieve relevant memories for context
   */
  public async getContext(message: Message): Promise<z.infer<typeof MemoryEntrySchema>[]> {
    // Get recent memories from working memory (last 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const workingMemories = await this.working.search({
      startTime: oneHourAgo,
      limit: 10,
    });

    // Get relevant memories from long-term memory using content search
    const searchTerms = message.content.toLowerCase().split(/\s+/);
    const longTermMemories = await this.longTerm.search({
      content: message.content,
      minImportance: 0.2,
      limit: 20,
    });

    // Calculate relevance scores for all memories
    const scoredMemories = [...workingMemories, ...longTermMemories].map(memory => {
      // Time decay factor (exponential decay over 24 hours)
      const timeDecay = Math.exp(-(Date.now() - memory.timestamp) / (24 * 60 * 60 * 1000));
      
      // Content similarity (word overlap)
      const memoryWords = memory.content.toLowerCase().split(/\s+/);
      const overlap = searchTerms.filter(term => 
        memoryWords.some(word => word.includes(term) || term.includes(word))
      ).length;
      const contentSimilarity = overlap / Math.max(searchTerms.length, memoryWords.length);
      
      // Combine scores with weights
      const score = (timeDecay * 0.2) +           // Recency
                   (memory.importance * 0.3) +     // Importance
                   (contentSimilarity * 0.5);      // Content matching (higher weight)
      
      return { memory, score };
    });

    // Sort by score and return top memories
    return scoredMemories
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.memory);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
  }

  /**
   * Cleanup memory systems
   * This involves:
   * 1. Consolidating remaining working memories
   * 2. Forgetting old and unimportant memories
   * 3. Clearing working memory
   */
  public async cleanup(): Promise<void> {
    // Consolidate remaining working memories
    await this.longTerm.consolidate(this.working);

    // Forget old memories
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    await this.longTerm.forget({
      endTime: oneMonthAgo,
      minImportance: 0.8, // Keep very important old memories
    });

    // Clear working memory
    await this.working.clear();
  }
} 