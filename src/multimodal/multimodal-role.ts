/**
 * Multimodal Role Integration
 * 
 * This module provides integration between MetaGPT roles and multimodal capabilities,
 * allowing roles to process and generate content with multiple modalities.
 */

import { Role, RoleContext, Message, MessageOptions } from '../roles/role';
import type { MediaType, MediaContent, MultiModalMessage } from './multimodal-provider';
import type { MultiModalProvider } from './multimodal-provider';
import { logger } from '../utils/logger';

/**
 * Options for multimodal roles
 */
export interface MultiModalRoleOptions {
  /**
   * Multimodal provider to use
   */
  provider: MultiModalProvider;
  
  /**
   * Model to use for multimodal processing
   */
  model?: string;
  
  /**
   * Temperature for generation
   */
  temperature?: number;
  
  /**
   * Maximum tokens to generate
   */
  maxTokens?: number;
  
  /**
   * Additional provider-specific options
   */
  providerOptions?: Record<string, any>;
}

/**
 * Extended message type with multimodal content support
 */
export interface MultiModalContent {
  /**
   * Text content
   */
  text?: string;
  
  /**
   * Media content
   */
  media?: MediaContent[];
}

/**
 * Mixin class for adding multimodal capabilities to a role
 */
export function MultiModalRoleMixin<T extends new (...args: any[]) => Role>(BaseRole: T) {
  return class MultiModalRole extends BaseRole {
    protected multimodalProvider: MultiModalProvider;
    protected multimodalModel: string;
    protected multimodalOptions: Omit<MultiModalRoleOptions, 'provider' | 'model'>;
    
    constructor(...args: any[]) {
      super(...args);
      
      const options = args.find(arg => arg?.provider instanceof Object) as MultiModalRoleOptions | undefined;
      
      if (!options?.provider) {
        throw new Error('MultiModalRole requires a multimodal provider');
      }
      
      this.multimodalProvider = options.provider;
      this.multimodalModel = options.model || this.multimodalProvider.getSupportedModels()[0];
      this.multimodalOptions = {
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens,
        providerOptions: options.providerOptions || {},
      };
      
      // Validate model support
      if (!this.multimodalProvider.getSupportedModels().includes(this.multimodalModel)) {
        throw new Error(`Model ${this.multimodalModel} is not supported by provider ${this.multimodalProvider.getName()}`);
      }
    }
    
    /**
     * Process an image and add it to the role's context
     * 
     * @param imageData Image data as URL, base64, or Buffer
     * @param format Image format
     * @param messageOptions Additional message options
     * @returns The analysis result
     */
    async processImage(
      imageData: string | Buffer | Uint8Array,
      format: string,
      messageOptions?: MessageOptions
    ): Promise<string> {
      try {
        logger.info(`[${this.name}] Processing image input`);
        
        // Analyze the image
        const analysis = await this.multimodalProvider.analyzeImage(
          imageData,
          format as any,
          `You are ${this.profile}. Analyze this image and describe what you see in detail.`
        );
        
        // Add the analysis as a message to the context
        const message = new Message({
          content: analysis,
          role: 'assistant',
          cause_by: this.profile,
          send_to: this.profile,
          ...messageOptions,
        });
        
        this.rc.memory.add(message);
        
        return analysis;
      } catch (error) {
        logger.error(`[${this.name}] Error processing image:`, error);
        throw new Error(`Failed to process image: ${(error as Error).message}`);
      }
    }
    
    /**
     * Generate a response to a multimodal query
     * 
     * @param content Multimodal content including text and media
     * @param messageOptions Additional message options
     * @returns The generated response
     */
    async generateMultiModalResponse(
      content: MultiModalContent,
      messageOptions?: MessageOptions
    ): Promise<string> {
      try {
        logger.info(`[${this.name}] Generating multimodal response`);
        
        // Convert to provider message format
        const messages: MultiModalMessage[] = [];
        
        // Add system message with the role's profile
        messages.push({
          role: 'system',
          content: `You are ${this.profile}. ${this.system_prompt || ''}`,
        });
        
        // Add context from memory as text messages
        for (const msg of this.rc.memory.get()) {
          if (msg.role !== 'system') {
            messages.push({
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            });
          }
        }
        
        // Add the multimodal query
        const userContent: (string | MediaContent)[] = [];
        
        if (content.text) {
          userContent.push(content.text);
        }
        
        if (content.media && content.media.length > 0) {
          userContent.push(...content.media);
        }
        
        messages.push({
          role: 'user',
          content: userContent,
        });
        
        // Generate response
        const response = await this.multimodalProvider.generateResponse(
          messages,
          {
            model: this.multimodalModel,
            temperature: this.multimodalOptions.temperature,
            maxTokens: this.multimodalOptions.maxTokens,
            ...this.multimodalOptions.providerOptions,
          }
        );
        
        // Add the response to memory
        const responseMessage = new Message({
          content: response,
          role: 'assistant',
          cause_by: this.profile,
          send_to: 'user',
          ...messageOptions,
        });
        
        this.rc.memory.add(responseMessage);
        
        return response;
      } catch (error) {
        logger.error(`[${this.name}] Error generating multimodal response:`, error);
        throw new Error(`Failed to generate multimodal response: ${(error as Error).message}`);
      }
    }
    
    /**
     * Generate a streaming response to a multimodal query
     * 
     * @param content Multimodal content including text and media
     * @param messageOptions Additional message options
     * @returns Async iterable of response chunks
     */
    async *generateMultiModalResponseStream(
      content: MultiModalContent,
      messageOptions?: MessageOptions
    ): AsyncIterable<string> {
      try {
        logger.info(`[${this.name}] Generating multimodal response stream`);
        
        // Convert to provider message format
        const messages: MultiModalMessage[] = [];
        
        // Add system message with the role's profile
        messages.push({
          role: 'system',
          content: `You are ${this.profile}. ${this.system_prompt || ''}`,
        });
        
        // Add context from memory as text messages
        for (const msg of this.rc.memory.get()) {
          if (msg.role !== 'system') {
            messages.push({
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            });
          }
        }
        
        // Add the multimodal query
        const userContent: (string | MediaContent)[] = [];
        
        if (content.text) {
          userContent.push(content.text);
        }
        
        if (content.media && content.media.length > 0) {
          userContent.push(...content.media);
        }
        
        messages.push({
          role: 'user',
          content: userContent,
        });
        
        // Generate streaming response
        let fullResponse = '';
        
        for await (const chunk of this.multimodalProvider.generateResponseStream(
          messages,
          {
            model: this.multimodalModel,
            temperature: this.multimodalOptions.temperature,
            maxTokens: this.multimodalOptions.maxTokens,
            ...this.multimodalOptions.providerOptions,
          }
        )) {
          fullResponse += chunk;
          yield chunk;
        }
        
        // Add the complete response to memory
        const responseMessage = new Message({
          content: fullResponse,
          role: 'assistant',
          cause_by: this.profile,
          send_to: 'user',
          ...messageOptions,
        });
        
        this.rc.memory.add(responseMessage);
      } catch (error) {
        logger.error(`[${this.name}] Error generating multimodal response stream:`, error);
        throw new Error(`Failed to generate multimodal response stream: ${(error as Error).message}`);
      }
    }
  };
}

/**
 * Create a new multimodal role instance
 * 
 * @param BaseRole The base role class
 * @param options Multimodal options
 * @returns A new multimodal role class
 */
export function createMultiModalRole<T extends new (...args: any[]) => Role>(
  BaseRole: T,
  options: MultiModalRoleOptions
): new (...args: any[]) => InstanceType<ReturnType<typeof MultiModalRoleMixin<T>>> {
  const MultiModalRoleClass = MultiModalRoleMixin(BaseRole);
  
  return class extends MultiModalRoleClass {
    constructor(...args: any[]) {
      super(...args, options);
    }
  } as any;
} 