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
  llm: LLMProvider;
  defaultTopicType: ResearchTopicType;
  minReliability: ReliabilityRating;
  maxSources: number;
  
  /**
   * Constructor
   */
  constructor(config: ResearcherConfig) {
    super(
      'Researcher',
      'Information Specialist',
      'Conduct thorough research on topics, analyze information from multiple sources, and synthesize findings into comprehensive reports',
      'Maintain objectivity, cite sources, verify information reliability, and provide balanced perspectives',
      []
    );
    
    logger.info('[Researcher] Initializing with config:', {
      defaultTopicType: config.defaultTopicType ?? ResearchTopicType.GENERAL,
      minReliability: config.minReliability ?? ReliabilityRating.MEDIUM,
      maxSources: config.maxSources ?? 10,
      react_mode: config.react_mode ?? 'plan_and_act',
      max_react_loop: config.max_react_loop ?? 5,
    });
    
    this.llm = config.llm;
    this.defaultTopicType = config.defaultTopicType ?? ResearchTopicType.GENERAL;
    this.minReliability = config.minReliability ?? ReliabilityRating.MEDIUM;
    this.maxSources = config.maxSources ?? 10;
    
    // Set reaction mode
    this.setReactMode(
      config.react_mode === 'react' ? 'react' : 'plan_and_act',
      config.max_react_loop ?? 5
    );
    
    // Initialize actions
    this.initialize();
  }
  
  /**
   * Initialize the researcher with actions
   */
  private initialize(): void {
    // Create a default Research action
    const researchAction = new Research({
      name: 'Research',
      llm: this.llm,
      args: {
        min_reliability: this.minReliability,
        max_sources: this.maxSources
      }
    });
    
    // Add actions
    this.actions = [researchAction];
    
    logger.info(`[Researcher] Initialized with ${this.actions.length} actions`);
  }
  
  /**
   * Override the think method to customize the researcher's decision making
   */
  async think(): Promise<boolean> {
    logger.debug(`[Researcher] Thinking about next action...`);
    
    // Get recent messages
    const messages = this.context.memory.getMessages();
    if (messages.length === 0) {
      logger.debug(`[Researcher] No messages to process`);
      return false;
    }
    
    // Get the most recent message
    const latestMessage = messages[messages.length - 1];
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
    
    // Set as the next action to execute
    this.setTodo(researchAction);
    
    return true;
  }
  
  /**
   * Determine the type of research topic from the query
   */
  private determineTopicType(query: string): ResearchTopicType {
    // Simple heuristic for topic type classification
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('code') || lowerQuery.includes('programming') || 
        lowerQuery.includes('software') || lowerQuery.includes('development') ||
        lowerQuery.includes('technology')) {
      return ResearchTopicType.TECHNICAL;
    } else if (lowerQuery.includes('market') || lowerQuery.includes('business') || 
               lowerQuery.includes('company') || lowerQuery.includes('industry') ||
               lowerQuery.includes('economics')) {
      return ResearchTopicType.BUSINESS;
    } else if (lowerQuery.includes('science') || lowerQuery.includes('research') ||
               lowerQuery.includes('study') || lowerQuery.includes('experiment')) {
      return ResearchTopicType.SCIENTIFIC;
    } else if (lowerQuery.includes('academic') || lowerQuery.includes('theory') ||
               lowerQuery.includes('philosophy') || lowerQuery.includes('literature')) {
      return ResearchTopicType.ACADEMIC;
    } else {
      return ResearchTopicType.GENERAL;
    }
  }
  
  /**
   * Execute a research task based on a message
   */
  async executeResearch(message: Message): Promise<ActionOutput> {
    logger.info(`[Researcher] Executing research based on: ${message.content.substring(0, 50)}...`);
    
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
    
    // Execute the research
    return await researchAction.run();
  }
} 