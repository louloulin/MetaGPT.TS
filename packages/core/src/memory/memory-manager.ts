import type { Message } from '../types/message';
import type { LLMProvider } from '../types/llm';
import type {
  MemoryEntrySchema,
  MemoryManager,
  MemoryQueryOptions,
  ShortTermMemory,
  WorkingMemory,
  LongTermMemory
} from './types';
import { ShortTermMemoryImpl } from './shortterm';
import { WorkingMemoryImpl } from './working';
import { LongTermMemoryImpl } from './longterm';
import { z } from 'zod';
import { logger } from '../utils/logger';
import path from 'path';

/**
 * Enhanced memory manager implementation
 * 
 * This memory manager implements a hierarchical memory system with:
 * - Short-term memory for temporary storage with fast access
 * - Working memory for active processing and context
 * - Long-term memory for persistent storage and pattern recognition
 * 
 * The manager handles the flow of information between these memory types,
 * implements automatic importance scoring, and provides context retrieval.
 */
export class MemoryManagerImpl implements MemoryManager {
  public shortTerm: ShortTermMemory;
  public working: WorkingMemory;
  public longTerm: LongTermMemory;
  private llmProvider?: LLMProvider;
  private storageBasePath?: string;
  private importanceCache: Map<string, number> = new Map();
  private initialized = false;

  constructor(llmProvider?: LLMProvider, storageBasePath?: string) {
    this.llmProvider = llmProvider;
    this.storageBasePath = storageBasePath;
    
    // Initialize memory systems
    this.shortTerm = new ShortTermMemoryImpl();
    this.working = new WorkingMemoryImpl();
    
    // Initialize long-term memory with storage path if provided
    const longTermStoragePath = this.storageBasePath 
      ? path.join(this.storageBasePath, 'longterm-memories.json')
      : undefined;
      
    this.longTerm = new LongTermMemoryImpl(
      this.llmProvider,
      longTermStoragePath
    );
  }

  /**
   * Initialize memory systems
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      // Run any necessary initialization tasks
      await this.longTerm.load();
      
      // Set up periodic memory consolidation and cleanup
      setInterval(() => {
        this.runMemoryMaintenance().catch(err => {
          logger.error('Memory maintenance error:', err);
        });
      }, 15 * 60 * 1000); // Run every 15 minutes
      
      this.initialized = true;
      logger.info('Memory manager initialized');
    } catch (error) {
      logger.error('Failed to initialize memory manager:', error);
      throw error;
    }
  }
  
  /**
   * Process a message through memory systems
   */
  public async processMessage(message: Message): Promise<void> {
    try {
      // Calculate importance score
      const importance = await this.calculateImportance(
        message.content,
        { role: message.role, ...message.metadata }
      );
      
      // Store in short-term memory first
      await this.shortTerm.add(message.content, 'message', {
        messageId: message.id,
        role: message.role,
        timestamp: message.timestamp,
        importance,
        ...message.metadata
      });
      
      // For high importance messages, immediately add to working memory
      if (importance >= 0.7) {
        await this.working.add(message.content, 'message', {
          messageId: message.id,
          role: message.role,
          timestamp: message.timestamp,
          importance,
          ...message.metadata
        });
      }
      
      // Periodically transfer from short-term to working memory
      if (Math.random() < 0.2) { // 20% chance to run transfer on each message
        await this.shortTerm.transferToWorking(this.working);
      }
    } catch (error) {
      logger.error('Error processing message in memory:', error);
    }
  }
  
  /**
   * Retrieve relevant memories for context based on a message
   */
  public async getContext(message: Message): Promise<z.infer<typeof MemoryEntrySchema>[]> {
    try {
      const combinedResults: z.infer<typeof MemoryEntrySchema>[] = [];
      const seenIds = new Set<string>();
      
      // First check active short-term memories (most recent)
      const shortTermResults = await this.shortTerm.getActive();
      for (const memory of shortTermResults) {
        combinedResults.push(memory);
        seenIds.add(memory.id);
      }
      
      // Then check working memory for related content
      const workingResults = await this.working.search({
        content: message.content,
        limit: 5,
        minImportance: 0.3
      });
      
      for (const memory of workingResults) {
        if (!seenIds.has(memory.id)) {
          combinedResults.push(memory);
          seenIds.add(memory.id);
        }
      }
      
      // For messages with specific intent or pattern, check long-term memory
      const hasIntent = message.metadata && 'intent' in message.metadata;
      const requiresContext = message.metadata && 'requiresContext' in message.metadata;
      
      if (hasIntent || requiresContext) {
        const longTermResults = await this.longTerm.search({
          content: message.content,
          limit: 3,
          minImportance: 0.6
        });
        
        for (const memory of longTermResults) {
          if (!seenIds.has(memory.id)) {
            combinedResults.push(memory);
            seenIds.add(memory.id);
          }
        }
      }
      
      // If found related memories in working memory, also get their related memories
      if (workingResults.length > 0 && workingResults[0].relatedMemories.length > 0) {
        const relatedIds = workingResults[0].relatedMemories.slice(0, 2); // Limit to 2 related memories
        
        for (const relatedId of relatedIds) {
          const memory = await this.working.get(relatedId) || 
                         await this.longTerm.get(relatedId);
                        
          if (memory && !seenIds.has(memory.id)) {
            combinedResults.push(memory);
            seenIds.add(memory.id);
          }
        }
      }
      
      // Sort by importance
      combinedResults.sort((a, b) => b.importance - a.importance);
      
      // Update access counts
      for (const memory of combinedResults) {
        await this.updateAccess(memory.id);
      }
      
      return combinedResults;
    } catch (error) {
      logger.error('Error retrieving context:', error);
      return [];
    }
  }
  
  /**
   * Update memory access patterns
   */
  public async updateAccess(id: string): Promise<void> {
    try {
      // Try to find and update in each memory system
      const shortTermMemory = await this.shortTerm.get(id);
      if (shortTermMemory) {
        await this.shortTerm.update(id, {
          lastAccessed: Date.now(),
          accessCount: (shortTermMemory.accessCount || 0) + 1
        });
        return;
      }
      
      const workingMemory = await this.working.get(id);
      if (workingMemory) {
        await this.working.update(id, {
          lastAccessed: Date.now(),
          accessCount: (workingMemory.accessCount || 0) + 1
        });
        return;
      }
      
      const longTermMemory = await this.longTerm.get(id);
      if (longTermMemory) {
        await this.longTerm.update(id, {
          lastAccessed: Date.now(),
          accessCount: (longTermMemory.accessCount || 0) + 1
        });
      }
    } catch (error) {
      logger.warn('Error updating memory access:', error);
    }
  }
  
  /**
   * Calculate importance score for memory content
   */
  public async calculateImportance(
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<number> {
    // Check if we have a cached score for this exact content
    const cacheKey = `${content.substring(0, 50)}`;
    if (this.importanceCache.has(cacheKey)) {
      return this.importanceCache.get(cacheKey)!;
    }
    
    try {
      let score = 0.5; // Default mid-importance
      
      // Rule-based scoring
      // 1. Length-based importance (longer messages often contain more info)
      const lengthScore = Math.min(0.2, content.length / 2000 * 0.2);
      
      // 2. Presence of entities, questions, or commands
      const hasQuestion = content.includes('?');
      const hasCommand = content.startsWith('!') || 
                         /^(create|make|generate|find|search|analyze|build|explain|list|show)/i.test(content);
      const questionScore = hasQuestion ? 0.15 : 0;
      const commandScore = hasCommand ? 0.2 : 0;
      
      // 3. Role-based scoring
      const roleScore = metadata.role === 'user' ? 0.1 : 0;
      
      // 4. Explicit importance in metadata
      const metadataScore = metadata.importance !== undefined ? metadata.importance * 0.3 : 0;
      
      // 5. Recency boost
      const timestamp = metadata.timestamp || Date.now();
      const recencyScore = Math.max(0, 0.1 - ((Date.now() - timestamp) / (24 * 60 * 60 * 1000)) * 0.1);
      
      // Calculate combined score
      score = Math.min(1, Math.max(0.1, 
        0.5 + // base score
        lengthScore +
        questionScore +
        commandScore +
        roleScore +
        metadataScore +
        recencyScore
      ));
      
      // If LLM provider available, use it for more advanced scoring for longer content
      if (this.llmProvider && content.length > 100 && Math.random() < 0.1) {
        try {
          score = await this.getLLMImportanceScore(content, score);
        } catch (error) {
          logger.warn('Error using LLM for importance scoring:', error);
        }
      }
      
      // Cache the result
      this.importanceCache.set(cacheKey, score);
      
      // Prevent cache from growing too large
      if (this.importanceCache.size > 1000) {
        const oldestKey = this.importanceCache.keys().next().value;
        if (oldestKey !== undefined) {
          this.importanceCache.delete(oldestKey);
        }
      }
      
      return score;
    } catch (error) {
      logger.warn('Error calculating importance score:', error);
      return 0.5; // Default importance
    }
  }
  
  /**
   * Use LLM to generate importance score
   */
  private async getLLMImportanceScore(content: string, baseScore: number): Promise<number> {
    if (!this.llmProvider) {
      return baseScore;
    }
    
    const prompt = `Rate the importance of the following text on a scale from 0.1 to 1.0, where:
- 0.1-0.3: Low importance, routine information
- 0.4-0.6: Moderate importance, useful but not critical
- 0.7-0.9: High importance, contains key information
- 1.0: Critical importance, essential information

Consider factors like:
- Presence of key information or insights
- Actionable instructions or requests
- Novel or unique information
- Emotional significance
- Future relevance

TEXT TO RATE:
${content}

Return only a single number between 0.1 and 1.0 as your rating.`;

    try {
      const response = await this.llmProvider.generate(prompt, {
        temperature: 0.1,
        maxTokens: 10
      });
      
      // Extract numeric score from response
      const scoreMatch = response.match(/([0-9](\.[0-9]+)?)/);
      if (scoreMatch && scoreMatch[0]) {
        const llmScore = parseFloat(scoreMatch[0]);
        if (!isNaN(llmScore) && llmScore >= 0.1 && llmScore <= 1.0) {
          // Blend LLM score with rule-based score
          return 0.7 * llmScore + 0.3 * baseScore;
        }
      }
    } catch (error) {
      logger.warn('Error getting LLM importance score:', error);
    }
    
    return baseScore;
  }
  
  /**
   * Run periodic memory maintenance
   */
  private async runMemoryMaintenance(): Promise<void> {
    try {
      // Transfer important memories from short-term to working memory
      await this.shortTerm.transferToWorking(this.working);
      
      // Consolidate working memory to long-term memory
      await this.longTerm.consolidate(this.working);
      
      // Forget old, unimportant memories from long-term memory
      const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
      await this.longTerm.forget({
        endTime: twoWeeksAgo,
        minImportance: 0.4
      });
      
      logger.info('Memory maintenance completed');
    } catch (error) {
      logger.error('Error during memory maintenance:', error);
    }
  }
  
  /**
   * Cleanup memory systems
   */
  public async cleanup(): Promise<void> {
    try {
      // Run one final consolidation
      await this.longTerm.consolidate(this.working);
      
      // Persist long-term memory
      await this.longTerm.persist();
      
      logger.info('Memory cleanup completed');
    } catch (error) {
      logger.error('Error during memory cleanup:', error);
    }
  }
} 