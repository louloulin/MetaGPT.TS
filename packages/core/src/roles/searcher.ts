/**
 * Searcher Role
 * 
 * This role specializes in searching for information on the web and summarizing results.
 * It leverages the SearchAndSummarize action to provide relevant and concise information
 * in response to user queries.
 */

import { BaseRole } from './base-role';
import { SearchAndSummarize } from '../actions/search-and-summarize';
import { SearchProviderType } from '../config/search';
import type { Message } from '../types/message';
import type { LLMProvider } from '../types/llm';
import type { Action, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Configuration interface for the Searcher role
 */
export interface SearcherConfig {
  llm: LLMProvider;
  name?: string;
  profile?: string;
  searchProvider?: SearchProviderType;
  maxResults?: number;
  react_mode?: 'plan_and_act' | 'react';
  max_react_loop?: number;
}

/**
 * Searcher role for providing search services to users
 */
export class Searcher extends BaseRole {
  llm: LLMProvider;
  searchProvider: SearchProviderType;
  maxResults: number;
  name: string;
  profile: string;
  actions: Action[];
  
  /**
   * Constructor
   */
  constructor(config: SearcherConfig) {
    super(
      config.name || 'Searcher',
      config.profile || 'Web Search Specialist',
      'Provide search services for users by finding and summarizing relevant information',
      'Answer should be rich, complete, and properly cited',
      []
    );
    
    this.name = config.name || 'Searcher';
    this.profile = config.profile || 'Web Search Specialist';
    this.llm = config.llm;
    this.searchProvider = config.searchProvider ?? SearchProviderType.SERPAPI;
    this.maxResults = config.maxResults ?? 5;
    this.actions = [];
    
    // Initialize actions
    this.initialize();
  }
  
  /**
   * Initialize the searcher with actions
   */
  private initialize(): void {
    // Create a SearchAndSummarize action
    const searchAction = new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: this.llm,
      args: {
        provider: this.searchProvider,
        max_results: this.maxResults
      }
    });
    
    // Add actions
    this.actions = [searchAction];
    
    logger.info(`[Searcher] Initialized with ${this.actions.length} actions`);
  }
  
  /**
   * Override the think method to customize the searcher's decision making
   */
  async think(): Promise<boolean> {
    logger.debug(`[Searcher] Thinking about next action...`);
    
    // Get recent messages
    const messages = this.context.memory.getMessages();
    
    if (messages.length === 0) {
      logger.debug(`[Searcher] No messages to process`);
      return false;
    }
    
    // Set up the SearchAndSummarize action
    const searchAction = this.actions[0] as SearchAndSummarize;
    
    // Clone the action to avoid modifying the original
    const newSearchAction = new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: this.llm,
      args: {
        messages: messages,
        provider: this.searchProvider,
        max_results: this.maxResults
      }
    });
    
    // Set as the next action to execute
    this.setTodo(newSearchAction);
    
    return true;
  }
  
  /**
   * Execute a search and summarize task based on a message
   */
  async executeSearch(message: Message): Promise<ActionOutput> {
    logger.info(`[Searcher] Executing search based on: ${message.content.substring(0, 50)}...`);
    
    // Create a new SearchAndSummarize action with the appropriate arguments
    const searchAction = new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: this.llm,
      args: {
        messages: [message],
        provider: this.searchProvider,
        max_results: this.maxResults
      }
    });
    
    // Execute the search
    return await searchAction.run();
  }
  
  addToMemory(message: Message): void {
    this.context.memory.add(message);
  }
} 