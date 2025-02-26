import { z } from 'zod';
import type { Action, ActionContext, ActionOutput, ActionConfig } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { ActionContextSchema, ActionOutputSchema } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Base Action Class
 * Provides core functionality for all actions
 */
export abstract class BaseAction implements Action {
  name: string;
  context: ActionContext;
  llm: LLMProvider;
  prefix: string = '';
  desc: string = '';

  constructor(config: ActionConfig) {
    // Validate configuration
    const validConfig = z.object({
      name: z.string(),
      description: z.string().optional(),
      prefix: z.string().optional(),
      args: z.record(z.any()).optional(),
      llm: z.any(),
      memory: z.any().optional(),
      workingMemory: z.any().optional(),
    }).parse(config);

    this.name = validConfig.name;
    this.llm = validConfig.llm;
    this.prefix = validConfig.prefix || '';
    this.desc = validConfig.description || '';

    // Build context
    this.context = ActionContextSchema.parse({
      name: validConfig.name,
      description: validConfig.description || '',
      args: validConfig.args || {},
      llm: validConfig.llm,
      memory: validConfig.memory,
      workingMemory: validConfig.workingMemory,
    });
  }

  /**
   * Execute the action
   * Subclasses must implement this method
   */
  abstract run(): Promise<ActionOutput>;

  /**
   * Handle exceptions
   * @param error Error object
   */
  async handleException(error: Error): Promise<void> {
    logger.error(`Action ${this.name} failed:`, error);
    // Subclasses can override this method to provide custom error handling
  }

  /**
   * Validate action output
   * @param output Action output
   * @returns Validated output
   */
  protected validateOutput(output: ActionOutput): ActionOutput {
    return ActionOutputSchema.parse(output);
  }

  /**
   * Create action output
   * @param content Output content
   * @param status Action status
   * @param instructContent Instruction content (optional)
   * @returns Action output
   */
  protected createOutput(
    content: string,
    status: 'completed' | 'failed' | 'blocked' = 'completed',
    instructContent?: any
  ): ActionOutput {
    return this.validateOutput({
      content,
      status,
      instructContent,
    });
  }

  /**
   * Get action argument
   * @param key Argument key
   * @returns Argument value
   */
  protected getArg<T>(key: string): T | undefined {
    return this.context.args?.[key] as T;
  }

  /**
   * Set action argument
   * @param key Argument key
   * @param value Argument value
   */
  protected setArg<T>(key: string, value: T): void {
    if (!this.context.args) {
      this.context.args = {};
    }
    this.context.args[key] = value;
  }

  /**
   * Set action prefix
   * @param prefix Prefix to set
   * @returns This action for chaining
   */
  setPrefix(prefix: string): this {
    this.prefix = prefix;
    if (this.llm && typeof this.llm.setSystemPrompt === 'function') {
      this.llm.setSystemPrompt(prefix);
    }
    return this;
  }

  /**
   * Ask the LLM a question
   * @param prompt - The prompt to send to the LLM
   * @returns The LLM's response
   */
  protected async ask(prompt: string): Promise<string> {
    try {
      if (!this.llm) {
        throw new Error(`[${this.name}] No LLM provider set for action`);
      }
      
      // Apply system messages if provided
      const systemMessages = this.getArg<string[]>('system_messages') || [];
      let currentSystemPrompt = '';
      
      if (systemMessages.length > 0) {
        currentSystemPrompt = systemMessages.join('\n');
      }

      // Set system prompt if different from current
      if (currentSystemPrompt && 
          this.llm &&
          typeof this.llm.setSystemPrompt === 'function' && 
          typeof this.llm.getSystemPrompt === 'function' &&
          this.llm.getSystemPrompt() !== currentSystemPrompt) {
        this.llm.setSystemPrompt(currentSystemPrompt);
      }

      // Send prompt to LLM
      logger.debug(`[${this.name}] Asking LLM: ${prompt.substring(0, 100)}...`);
      const response = await this.llm.chat(prompt);
      logger.debug(`[${this.name}] LLM response: ${response.substring(0, 100)}...`);
      
      return response;
    } catch (error) {
      logger.error(`[${this.name}] Error asking LLM:`, error);
      throw error;
    }
  }

  /**
   * Ask the LLM a question with streaming response
   * @param prompt - The prompt to send to the LLM
   * @returns The LLM's response as an async generator
   */
  protected async *askStream(prompt: string): AsyncGenerator<string> {
    try {
      if (!this.llm) {
        throw new Error(`[${this.name}] No LLM provider set for action`);
      }
      
      // Apply system messages if provided
      const systemMessages = this.getArg<string[]>('system_messages') || [];
      let currentSystemPrompt = '';
      
      if (systemMessages.length > 0) {
        currentSystemPrompt = systemMessages.join('\n');
      }

      // Set system prompt if different from current
      if (currentSystemPrompt && 
          this.llm &&
          typeof this.llm.setSystemPrompt === 'function' && 
          typeof this.llm.getSystemPrompt === 'function' &&
          this.llm.getSystemPrompt() !== currentSystemPrompt) {
        this.llm.setSystemPrompt(currentSystemPrompt);
      }

      // Send prompt to LLM with streaming
      logger.debug(`[${this.name}] Asking LLM (streaming): ${prompt.substring(0, 100)}...`);
      
      // Check if chatStream method exists on the LLM provider
      if (this.llm && 'chatStream' in this.llm && typeof this.llm.chatStream === 'function') {
        for await (const chunk of this.llm.chatStream(prompt)) {
          yield chunk;
        }
      } else if (this.llm && 'generateStream' in this.llm && typeof this.llm.generateStream === 'function') {
        // Fall back to generateStream if chatStream is not available
        for await (const chunk of this.llm.generateStream(prompt)) {
          yield chunk;
        }
      } else {
        // Fall back to non-streaming if streaming is not available
        const response = await this.llm.chat(prompt);
        yield response;
      }
      
      logger.debug(`[${this.name}] LLM streaming response completed`);
    } catch (error) {
      logger.error(`[${this.name}] Error asking LLM with streaming:`, error);
      throw error;
    }
  }

  /**
   * Get string representation of the action
   * @returns String representation
   */
  toString(): string {
    return `${this.name}(${this.desc})`;
  }
} 