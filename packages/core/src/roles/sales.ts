/**
 * Sales Role
 * 
 * Responsible for handling customer inquiries and providing product information.
 * The Sales role provides expert knowledge about products and services.
 */

import { BaseRole } from './base-role';
import type { Message } from '../types/message';
import type { Action } from '../types/action';
import { SearchAndSummarize } from '../actions/search-and-summarize';
import { logger } from '../utils/logger';
import type { LLMProvider } from '../types/llm';
import { SearchProviderType } from '../config/search';
import { BaseAction } from '../actions/base-action';

/**
 * Configuration for the Sales role
 */
export interface SalesConfig {
  /**
   * LLM provider to use
   */
  llm: LLMProvider;
  
  /**
   * Optional product knowledge base
   */
  productKnowledgeBase?: string;
  
  /**
   * Search provider to use
   */
  searchProvider?: SearchProviderType;
  
  /**
   * Name of the sales representative
   */
  name?: string;
  
  /**
   * Profile of the sales representative
   */
  profile?: string;
  
  /**
   * Goal of the sales representative
   */
  goal?: string;
  
  /**
   * Constraints for the sales representative
   */
  constraints?: string;
  
  /**
   * Description of the sales representative
   */
  desc?: string;
}

/**
 * Sales Role
 * Handles customer inquiries and provides product information
 */
export class Sales extends BaseRole {
  // Optional product knowledge base
  private productKnowledgeBase?: string;

  /**
   * Create a new Sales role
   */
  constructor(config: SalesConfig) {
    super(
      config.name || 'Sales',
      config.profile || 'I am a Sales representative with expertise in product information.',
      config.goal || 'Address customer inquiries with professional and accurate information about products and services.',
      config.constraints || 'I provide factual information, avoid making unrealistic promises, and maintain a professional tone.',
      [],
      config.desc || 'Sales representative responsible for handling product inquiries and providing information.'
    );

    // Initialize product knowledge base
    this.productKnowledgeBase = config.productKnowledgeBase;

    // Add search and summarize action
    this.actions.push(new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: config.llm,
      args: {
        provider: config.searchProvider || SearchProviderType.SERPAPI,
        max_results: 5
      }
    }));

    logger.info(`[${this.name}] Sales role initialized`);
  }

  /**
   * Handle incoming messages specific to Sales
   * @param message Incoming message
   * @returns Response message
   */
  protected async handleMessage(message: Message): Promise<Message> {
    logger.info(`[${this.name}] Handling message: ${message.content.substring(0, 50)}...`);
    
    // Get search and summarize action
    const searchAction = this.actions.find(action => action.name === 'SearchAndSummarize');
    
    if (!searchAction) {
      return this.createMessage(
        'Sorry, I cannot process your request at the moment due to missing search capabilities.'
      );
    }
    
    // Set the messages for context
    const messages = this.context.memory.getMessages();
    (searchAction as BaseAction).setArg('messages', [...messages, message]);
    
    // Use product knowledge base if available
    if (this.productKnowledgeBase) {
      (searchAction as BaseAction).setArg('context', this.productKnowledgeBase);
    }
    
    // Execute the search action
    const result = await searchAction.run();
    
    return this.createMessage(result.content);
  }

  /**
   * Decide next action based on current context
   * Overrides the base method to handle Sales-specific logic
   */
  protected async decideNextAction(message?: Message): Promise<Action | null> {
    // In Sales, we primarily use the SearchAndSummarize action
    const searchAction = this.actions.find(action => action.name === 'SearchAndSummarize');
    
    if (!searchAction) {
      logger.warn(`[${this.name}] SearchAndSummarize action not found`);
      return null;
    }
    
    // Set up the action with latest messages
    const messages = this.context.memory.getMessages();
    (searchAction as BaseAction).setArg('messages', messages);
    
    return searchAction;
  }
} 