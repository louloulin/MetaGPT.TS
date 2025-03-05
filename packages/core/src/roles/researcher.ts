/**
 * Researcher Role
 * 
 * This role specializes in information gathering, analysis, and synthesis.
 * It leverages the Research action to investigate topics, collect data from various sources,
 * evaluate information reliability, and produce comprehensive research reports.
 */

import { BaseRole } from './base-role';
import { Research } from '../actions/research';
import type { Message } from '../types/message';
import type { LLMProvider } from '../types/llm';
import type { Action, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';
import { ResearchTopicType, ReliabilityRating } from '../actions/research';

/**
 * Configuration interface for the Researcher role
 */
export interface ResearcherConfig {
  llm: LLMProvider;
  defaultTopicType?: ResearchTopicType;
  minReliability?: ReliabilityRating;
  maxSources?: number;
  react_mode?: 'plan_and_act' | 'react';
  max_react_loop?: number;
}

/**
 * Researcher role for conducting comprehensive research on various topics
 */
export class Researcher extends BaseRole {
  private readonly llm: LLMProvider;
  private readonly defaultTopicType: ResearchTopicType;
  private readonly minReliability: ReliabilityRating;
  private readonly maxSources: number;
  
  /**
   * Constructor
   */
  constructor(config: ResearcherConfig) {
    const defaultTopicType = config.defaultTopicType ?? ResearchTopicType.GENERAL;
    const minReliability = config.minReliability ?? ReliabilityRating.MEDIUM;
    const maxSources = config.maxSources ?? 10;
    const reactMode = config.react_mode ?? 'plan_and_act';
    const maxReactLoop = config.max_react_loop ?? 5;

    // Initialize base role with required parameters
    const researchAction = new Research({
      name: 'Research',
      llm: config.llm,
      args: {
        min_reliability: minReliability,
        max_sources: maxSources
      }
    });

    // Ensure Research action properly implements Action interface
    researchAction.handleException = async (error: Error): Promise<ActionOutput> => {
      logger.error(`[Research] Error during research:`, error);
      return {
        status: 'failed',
        content: `Research failed: ${error.message}`,
      };
    };

    super(
      'Researcher',
      'Information Specialist',
      'Conduct thorough research on topics, analyze information from multiple sources, and synthesize findings into comprehensive reports',
      'Maintain objectivity, cite sources, verify information reliability, and provide balanced perspectives',
      [researchAction]
    );
    
    logger.info('[Researcher] Initializing with config:', {
      defaultTopicType,
      minReliability,
      maxSources,
      react_mode: reactMode,
      max_react_loop: maxReactLoop,
    });
    
    this.llm = config.llm;
    this.defaultTopicType = defaultTopicType;
    this.minReliability = minReliability;
    this.maxSources = maxSources;
    
    // Set reaction mode
    this.setReactMode(reactMode, maxReactLoop);
  }
  
  /**
   * Override the think method to customize the researcher's decision making
   */
  async think(): Promise<boolean> {
    logger.debug(`[Researcher] Thinking about next action...`);
    
    try {
      // Get recent messages using parent class method
      const messages = await this.context.memory.get();
      if (!messages || messages.length === 0) {
        logger.debug(`[Researcher] No messages to process`);
        return false;
      }
      
      // Get the most recent message
      const latestMessage = messages[messages.length - 1];
      if (!latestMessage || !latestMessage.content) {
        logger.debug(`[Researcher] Latest message is invalid`);
        return false;
      }

      logger.debug(`[Researcher] Processing message: ${latestMessage.content.substring(0, 50)}...`);
      
      // Extract query from message
      const query = latestMessage.content;
      const topicType = this.determineTopicType(query);
      
      // Create a new research action with appropriate arguments
      const researchAction = new Research({
        name: 'Research',
        llm: this.llm,
        args: {
          query: query,
          topic_type: topicType,
          objective: `Research comprehensive information about: ${query}`,
          min_reliability: this.minReliability,
          max_sources: this.maxSources
        }
      });

      // Add handleException implementation
      researchAction.handleException = async (error: Error): Promise<ActionOutput> => {
        logger.error(`[Research] Error during research:`, error);
        return {
          status: 'failed',
          content: `Research failed: ${error.message}`,
        };
      };
      
      // Set as the next action to execute
      this.setTodo(researchAction);
      
      return true;
    } catch (error) {
      logger.error(`[Researcher] Error during think:`, error);
      return false;
    }
  }
  
  /**
   * Determine the type of research topic from the query
   */
  private determineTopicType(query: string): ResearchTopicType {
    // Simple heuristic for topic type classification
    const lowerQuery = query.toLowerCase();
    
    // Technical topics
    if (lowerQuery.includes('code') || lowerQuery.includes('programming') || 
        lowerQuery.includes('software') || lowerQuery.includes('development') ||
        lowerQuery.includes('technology') || lowerQuery.includes('api') ||
        lowerQuery.includes('framework') || lowerQuery.includes('library')) {
      return ResearchTopicType.TECHNICAL;
    } 
    
    // Business topics
    if (lowerQuery.includes('market') || lowerQuery.includes('business') || 
        lowerQuery.includes('company') || lowerQuery.includes('industry') ||
        lowerQuery.includes('economics') || lowerQuery.includes('finance') ||
        lowerQuery.includes('startup') || lowerQuery.includes('investment')) {
      return ResearchTopicType.BUSINESS;
    } 
    
    // Scientific topics
    if (lowerQuery.includes('science') || lowerQuery.includes('research') ||
        lowerQuery.includes('study') || lowerQuery.includes('experiment') ||
        lowerQuery.includes('analysis') || lowerQuery.includes('data') ||
        lowerQuery.includes('discovery') || lowerQuery.includes('hypothesis')) {
      return ResearchTopicType.SCIENTIFIC;
    } 
    
    // Academic topics
    if (lowerQuery.includes('academic') || lowerQuery.includes('theory') ||
        lowerQuery.includes('philosophy') || lowerQuery.includes('literature') ||
        lowerQuery.includes('history') || lowerQuery.includes('education') ||
        lowerQuery.includes('thesis') || lowerQuery.includes('dissertation')) {
      return ResearchTopicType.ACADEMIC;
    }
    
    // If no specific category is matched, return GENERAL
    return ResearchTopicType.GENERAL;
  }
  
  /**
   * Execute a research task based on a message
   */
  async executeResearch(message: Message): Promise<ActionOutput> {
    logger.info(`[Researcher] Executing research based on: ${message.content.substring(0, 50)}...`);
    
    // Add message to memory
    await this.addToMemory(message);
    
    // Create a new research action with appropriate arguments
    const researchAction = new Research({
      name: 'Research',
      llm: this.llm,
      args: {
        query: message.content,
        topic_type: this.determineTopicType(message.content),
        objective: `Research comprehensive information about: ${message.content}`,
        min_reliability: this.minReliability,
        max_sources: this.maxSources
      }
    });
    
    // Execute the research through the state machine
    this.setTodo(researchAction);
    const result = await researchAction.run();
    
    // Add result to working memory
    await this.addToWorkingMemory(this.createMessage(result.content));
    
    return result;
  }
} 