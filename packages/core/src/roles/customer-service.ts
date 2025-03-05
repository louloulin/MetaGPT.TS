/**
 * CustomerService Role
 * 
 * Responsible for handling customer inquiries, providing support, and resolving issues.
 * The CustomerService role extends the Sales role with additional focus on customer care.
 */

import { Sales } from './sales';
import type { SalesConfig } from './sales';
import type { Message, MessageMetadata } from '../types/message';
import type { Action } from '../types/action';
import { logger } from '../utils/logger';
import { BaseAction } from '../actions/base-action';

/**
 * Configuration for the CustomerService role
 */
export interface CustomerServiceConfig extends SalesConfig {
  /**
   * Optional customer FAQ database
   */
  faqDatabase?: string;
  
  /**
   * Optional support ticket templates
   */
  supportTemplates?: Record<string, string>;
  
  /**
   * Optional product knowledge base
   * Redefining here to access in CustomerService
   */
  productKnowledgeBase?: string;
}

/**
 * Principles governing CustomerService behavior
 */
export const CUSTOMER_SERVICE_PRINCIPLES = `
1. Maintain a courteous and professional demeanor at all times.
2. Show empathy and understanding towards customer concerns.
3. Provide accurate information without making promises that cannot be kept.
4. Seek to resolve issues efficiently and to the customer's satisfaction.
5. Escalate complex problems when they exceed your capacity to resolve.
6. Respect customer privacy and handle sensitive information appropriately.
7. Conclude interactions by confirming the customer's needs have been addressed.
`;

/**
 * CustomerService Role
 * Handles customer support inquiries and resolves issues
 */
export class CustomerService extends Sales {
  // Customer FAQ database
  private faqDatabase?: string;
  
  // Support ticket templates
  private supportTemplates: Record<string, string> = {};
  
  // Local product knowledge base reference
  private customerProductKnowledgeBase?: string;

  /**
   * Create a new CustomerService role
   */
  constructor(config: CustomerServiceConfig) {
    super({
      ...config,
      name: config.name || 'CustomerService',
      profile: config.profile || 'I am a Customer Service representative focused on resolving issues and providing support.',
      goal: config.goal || 'Address customer concerns with empathy and provide effective solutions to their problems.',
      constraints: config.constraints || 'I maintain professionalism, provide accurate information, and prioritize customer satisfaction.',
      desc: config.desc || 'Customer service representative responsible for support and issue resolution.'
    });

    // Initialize memory system with appropriate configuration
    this.context.memory = this.context.memory || {
      get: () => [],
      getMessages: () => [],
      add: async (message: Message) => {
        await super.addToMemory(message);
      },
      remove: async (id: string) => {
        // Implementation for removing messages
        const messages = this.context.memory.get();
        const index = messages.findIndex((msg: Message) => msg.id === id);
        if (index !== -1) {
          messages.splice(index, 1);
        }
      },
      clear: async () => {
        // Implementation for clearing messages
        this.context.memory.messages = [];
      }
    };

    // Initialize FAQ database
    this.faqDatabase = config.faqDatabase;
    
    // Initialize support templates
    if (config.supportTemplates) {
      this.supportTemplates = config.supportTemplates;
    }
    
    // Store product knowledge base locally
    this.customerProductKnowledgeBase = config.productKnowledgeBase;

    logger.info(`[${this.name}] CustomerService role initialized`);
  }

  /**
   * Override addToMemory to handle customer service specific memory management
   */
  protected async addToMemory(message: Message): Promise<void> {
    try {
      // Add importance metadata for customer service messages
      const enhancedMessage: Message = {
        ...message,
        metadata: {
          ...(message.metadata || {}),
          importance: this.calculateMessageImportance(message),
          tags: [...(message.metadata?.tags || []), 'customer_service'],
          context: {
            ...(message.metadata?.context || {}),
            service_type: 'customer_support'
          }
        }
      };

      await super.addToMemory(enhancedMessage);
    } catch (error) {
      logger.error(`[${this.name}] Error adding message to memory: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate message importance based on customer service criteria
   */
  private calculateMessageImportance(message: Message): number {
    const content = message.content.toLowerCase();
    
    // Higher importance for urgent issues
    if (content.includes('urgent') || content.includes('emergency')) {
      return 0.9;
    }
    
    // Higher importance for specific issues
    if (content.includes('problem') || content.includes('issue') || content.includes('error')) {
      return 0.7;
    }
    
    // Default importance
    return 0.5;
  }

  /**
   * Handle incoming messages specific to CustomerService
   * @param message Incoming message
   * @returns Response message
   */
  protected async handleMessage(message: Message): Promise<Message> {
    try {
      logger.info(`[${this.name}] Handling customer service message: ${message.content.substring(0, 50)}...`);
      
      // Add message to working memory
      await this.addToWorkingMemory(message);
      
      // Get search and summarize action
      const searchAction = this.actions.find(action => action.name === 'SearchAndSummarize');
      
      if (!searchAction) {
        return this.createMessage(
          'Sorry, I cannot process your request at the moment due to missing search capabilities.'
        );
      }
      
      // Get messages from working memory
      const messages = await this.getMessages();
      const enhancedMessages = [...messages, message];
      
      // Configure search action with appropriate context
      const combinedContext = [
        CUSTOMER_SERVICE_PRINCIPLES,
        this.faqDatabase || '',
        this.customerProductKnowledgeBase || ''
      ].filter(Boolean).join('\n\n');
      
      // Create a custom system message incorporating customer service principles
      const systemMessage = `You are a customer service representative. ${CUSTOMER_SERVICE_PRINCIPLES}`;
      
      // Update the action's context directly
      searchAction.context.memory = this.context.memory;
      searchAction.context.workingMemory = this.context.workingMemory;
      searchAction.context.args = {
        messages: enhancedMessages,
        context: combinedContext,
        system_messages: [systemMessage]
      };
      
      // Execute the search action
      const result = await searchAction.run();
      
      // Create and store response message
      const response = this.createMessage(result.content);
      await this.addToWorkingMemory(response);
      
      return response;
    } catch (error) {
      logger.error(`[${this.name}] Error handling message: ${error}`);
      throw error;
    }
  }

  /**
   * Get appropriate support template if applicable
   * @param message Customer message
   * @returns Template string if found, empty string otherwise
   */
  private getSupportTemplate(message: string): string {
    // Simple template matching based on keywords
    const lowerMessage = message.toLowerCase();
    
    for (const [key, template] of Object.entries(this.supportTemplates)) {
      if (lowerMessage.includes(key.toLowerCase())) {
        return template;
      }
    }
    
    return '';
  }

  /**
   * Override run to handle customer service specific logic
   */
  public async run(message?: Message): Promise<Message> {
    logger.info(`[${this.name}] Running role...`);
    
    if (!message) {
      return this.createMessage('No message provided');
    }

    // Handle the message directly
    return await this.handleMessage(message);
  }
} 