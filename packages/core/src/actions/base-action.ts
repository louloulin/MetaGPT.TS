import { z } from 'zod';
import type { Action, ActionConfig, ActionContext, StreamActionOutput } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { ActionContextSchema } from '../types/action';
import { ArrayMemory } from '../types/memory';
import { logger } from '../utils/logger';
import { handleLLMResponse } from '../utils/stream-helper';

/**
 * Type for streaming callback function
 */
export type ActionStreamCallback = (chunk: string) => void;

/**
 * Action run mode enum
 */
export enum ActionRunMode {
  REGULAR = 'regular',
  STREAMING = 'streaming'
}

/**
 * Action run options interface
 */
export interface ActionRunOptions {
  mode?: ActionRunMode;
  streamCallback?: ActionStreamCallback;
  systemMessages?: string[];
  args?: Record<string, any>;
}

/**
 * Base Action Class
 * Provides core functionality for all actions
 */
export abstract class BaseAction implements Action {
  name: string;
  context: ActionContext;
  private _llm: LLMProvider;
  prefix: string = '';
  desc: string = '';
  private _useStream: boolean = false;
  private _streamOptions: {
    timeout: number;
    debug: boolean;
  } = {
    timeout: 30000,
    debug: false
  };

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
      useStream: z.boolean().optional(),
      streamOptions: z.object({
        timeout: z.number().optional(),
        debug: z.boolean().optional()
      }).optional()
    }).parse(config);

    this.name = validConfig.name;
    this._llm = validConfig.llm;
    this.prefix = validConfig.prefix || '';
    this.desc = validConfig.description || '';
    this._useStream = validConfig.useStream ?? false;
    
    if (validConfig.streamOptions) {
      this._streamOptions = {
        timeout: validConfig.streamOptions.timeout ?? 30000,
        debug: validConfig.streamOptions.debug ?? false
      };
    }

    // Build context with default memory implementation if not provided
    const memory = validConfig.memory || new ArrayMemory();
    const workingMemory = validConfig.workingMemory || memory;

    this.context = ActionContextSchema.parse({
      name: validConfig.name,
      description: validConfig.description || '',
      args: validConfig.args || {},
      memory,
      workingMemory,
    });

    // Ensure args is initialized
    if (!this.context.args) {
      this.context.args = {};
    }
  }

  /**
   * Run the action with specified mode and options
   * @param options Run options including mode and callbacks
   * @returns Action output
   */
  async run(options?: ActionRunOptions): Promise<StreamActionOutput> {
    try {
      // Apply options
      if (options?.systemMessages) {
        this.setArg('system_messages', options.systemMessages);
      }
      if (options?.args) {
        Object.entries(options.args).forEach(([key, value]) => {
          this.setArg(key, value);
        });
      }

      // Choose run mode
      if (options?.mode === ActionRunMode.STREAMING) {
        return this.runStream(options.streamCallback);
      } else {
        return this.runRegular();
      }
    } catch (error) {
      logger.error(`[${this.name}] Error in run:`, error);
      return this.handleException(error as Error);
    }
  }

  /**
   * Regular (non-streaming) run implementation
   * @returns Action output
   */
  private async runRegular(): Promise<StreamActionOutput> {
    try {
      // Get prompt from action implementation
      const prompt = await this.prompt();
      
      if (!prompt) {
        return this.createOutput(
          'No prompt available.',
          'failed'
        );
      }
      
      // Generate response using LLM without streaming
      const response = await this.ask(prompt);
      
      return this.createOutput(
        response,
        'completed'
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in runRegular:`, error);
      return this.handleException(error as Error);
    }
  }

  /**
   * Run the action with streaming support
   * @param callback Optional callback for streaming chunks
   * @returns Action output
   */
  private async runStream(callback?: ActionStreamCallback): Promise<StreamActionOutput> {
    try {
      logger.info(`[${this.name}] Running action with streaming`);
      
      // Get prompt from action implementation
      const prompt = await this.prompt();
      
      if (!prompt) {
        return this.createOutput(
          'No prompt available for streaming.',
          'failed'
        );
      }
      
      // Generate response using LLM with streaming
      let fullResponse = '';
      for await (const chunk of this.askStream(prompt)) {
        fullResponse += chunk;
        if (callback) {
          callback(chunk);
        }
      }
      
      return this.createOutput(
        fullResponse,
        'completed'
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in runStream:`, error);
      return this.handleException(error as Error);
    }
  }

  /**
   * Handle exceptions
   * @param error Error object
   */
  protected async handleException(error: Error): Promise<StreamActionOutput> {
    logger.error(`Action ${this.name} failed:`, error);
    return this.createOutput(
      `Action failed: ${error.message}`,
      'failed'
    );
  }

  /**
   * Create an action output
   * @param content Output content
   * @param status Output status
   * @param metadata Optional metadata
   * @returns Action output
   */
  protected createOutput(
    content: string,
    status: 'completed' | 'failed' | 'created' | 'running' | 'blocked' = 'completed',
    metadata?: Record<string, any>
  ): StreamActionOutput {
    return {
      content,
      status,
      metadata
    };
  }

  /**
   * Get an argument value by key
   */
  protected getArg<T>(key: string): T | undefined {
    return this.context.args?.[key] as T;
  }

  /**
   * Set an argument value
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
  protected setPrefix(prefix: string): this {
    this.prefix = prefix;
    if (this._llm && typeof this._llm.setSystemPrompt === 'function') {
      this._llm.setSystemPrompt(prefix);
    }
    return this;
  }

  /**
   * Ask the LLM a question with support for streaming
   * @param prompt - The prompt to send to the LLM
   * @returns The LLM's response
   */
  protected async ask(prompt: string): Promise<string> {
    try {
      if (!this._llm) {
        throw new Error(`[${this.name}] No LLM provider set for action`);
      }
      
      await this.applySystemMessages();

      // Send prompt to LLM
      const promptPreview = prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
      logger.debug(`[${this.name}] Asking LLM: ${promptPreview}`);
      
      let response: string;
      if (this._useStream && this._llm.chatStream) {
        response = await handleLLMResponse(
          this._llm,
          prompt,
          this.name,
          this._streamOptions
        );
      } else {
        const rawResponse = await this._llm.chat(prompt) as string | { content: string };
        response = typeof rawResponse === 'object' && 'content' in rawResponse ? rawResponse.content : rawResponse;
      }
      
      if (!response) {
        throw new Error(`[${this.name}] No response received from LLM`);
      }
      
      const responsePreview = response.length > 100 ? response.substring(0, 100) + '...' : response;
      logger.debug(`[${this.name}] LLM response: ${responsePreview}`);
      
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
      if (!this._llm) {
        throw new Error(`[${this.name}] No LLM provider set for action`);
      }
      
      await this.applySystemMessages();

      // Send prompt to LLM with streaming
      logger.debug(`[${this.name}] Asking LLM (streaming): ${prompt.substring(0, 100)}...`);
      
      // Check if chatStream method exists on the LLM provider
      if (this._llm && 'chatStream' in this._llm && typeof this._llm.chatStream === 'function') {
        for await (const chunk of this._llm.chatStream(prompt)) {
          yield chunk;
        }
      } else if (this._llm && 'generateStream' in this._llm && typeof this._llm.generateStream === 'function') {
        // Fall back to generateStream if chatStream is not available
        for await (const chunk of this._llm.generateStream(prompt)) {
          yield chunk;
        }
      } else {
        // Fall back to non-streaming if streaming is not available
        const response = await this._llm.chat(prompt);
        yield response;
      }
      
      logger.debug(`[${this.name}] LLM streaming response completed`);
    } catch (error) {
      logger.error(`[${this.name}] Error asking LLM with streaming:`, error);
      throw error;
    }
  }

  /**
   * Apply system messages to LLM if provided
   */
  private async applySystemMessages(): Promise<void> {
    const systemMessages = this.getArg<string[]>('system_messages') || [];
    const currentSystemPrompt = systemMessages.join('\n');
    
    if (currentSystemPrompt && 
        this._llm &&
        typeof this._llm.setSystemPrompt === 'function' && 
        typeof this._llm.getSystemPrompt === 'function' &&
        this._llm.getSystemPrompt() !== currentSystemPrompt) {
      this._llm.setSystemPrompt(currentSystemPrompt);
    }
  }

  /**
   * Get the LLM provider
   * @returns The LLM provider
   */
  protected async getLLM(): Promise<LLMProvider> {
    if (!this._llm) {
      throw new Error('No LLM provider available');
    }
    return this._llm;
  }

  /**
   * Get the prompt for the action
   * This should be implemented by derived classes
   * @returns Prompt string
   */
  protected abstract prompt(): Promise<string>;

  /**
   * Get string representation of the action
   * @returns String representation
   */
  toString(): string {
    return `${this.name}(${this.desc})`;
  }
} 