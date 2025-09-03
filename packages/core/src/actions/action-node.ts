/**
 * ActionNode System
 * 
 * Enhanced TypeScript implementation of ActionNode system inspired by MetaGPT Python version.
 * Provides structured action execution with dependency management, validation, and orchestration.
 * 
 * @module actions/action-node
 * @category Core
 */

import { z } from 'zod';
import type { Action, ActionContext, StreamActionOutput } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { logger } from '../utils/logger';
import { SerializationMixin } from '../base/serialization';

/**
 * Action node status enumeration
 */
export enum ActionNodeStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ROLLED_BACK = 'rolled_back'
}

/**
 * Action node execution mode
 */
export enum ActionNodeMode {
  SIMPLE = 'simple',
  COMPLEX = 'complex',
  PARALLEL = 'parallel'
}

/**
 * Action node fill mode for different output formats
 */
export enum FillMode {
  JSON = 'json',
  MARKDOWN = 'markdown',
  RAW = 'raw',
  XML = 'xml',
  CODE = 'code'
}

/**
 * Review mode for action node validation
 */
export enum ReviewMode {
  HUMAN = 'human',
  AUTO = 'auto',
  DISABLED = 'disabled'
}

/**
 * Revise mode for action node correction
 */
export enum ReviseMode {
  HUMAN = 'human',
  HUMAN_REVIEW = 'human_review',
  AUTO = 'auto'
}

/**
 * Action node configuration interface
 */
export interface ActionNodeConfig {
  /** Node identifier */
  key: string;
  /** Expected output type */
  expectedType: string;
  /** Execution instruction */
  instruction: string;
  /** Example output */
  example: any;
  /** Initial content */
  content?: string;
  /** Child nodes */
  children?: Record<string, ActionNode>;
  /** Output schema format */
  schema?: FillMode;
  /** Execution timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Enable caching */
  enableCache?: boolean;
  /** Custom validation function */
  validator?: (output: any) => boolean | Promise<boolean>;
  /** Rollback function */
  rollback?: (result: any) => Promise<void>;
}

/**
 * Action node execution result
 */
export interface ActionNodeResult {
  /** Node identifier */
  nodeId: string;
  /** Execution success status */
  success: boolean;
  /** Execution result */
  result?: any;
  /** Error information */
  error?: Error;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Execution metadata */
  metadata?: Record<string, any>;
}

/**
 * Action node execution context
 */
export interface ActionNodeExecutionContext {
  /** LLM provider */
  llm: LLMProvider;
  /** Execution context */
  context: string;
  /** System messages */
  systemMessages?: string[];
  /** Input arguments */
  args?: Record<string, any>;
  /** Execution mode */
  mode?: ActionNodeMode;
  /** Fill mode */
  fillMode?: FillMode;
  /** Review mode */
  reviewMode?: ReviewMode;
  /** Revise mode */
  reviseMode?: ReviseMode;
  /** Timeout override */
  timeout?: number;
  /** Excluded fields */
  exclude?: string[];
}

/**
 * Enhanced ActionNode class with TypeScript-specific optimizations
 */
export class ActionNode extends SerializationMixin {
  /** Node configuration */
  private config: ActionNodeConfig;
  
  /** Node status */
  private status: ActionNodeStatus = ActionNodeStatus.PENDING;
  
  /** Execution result */
  private result: any = null;
  
  /** Execution error */
  private error: Error | null = null;
  
  /** Execution start time */
  private startTime: number = 0;
  
  /** Execution duration */
  private duration: number = 0;
  
  /** Dependency nodes */
  private dependencies: ActionNode[] = [];
  
  /** Dependent nodes */
  private dependents: ActionNode[] = [];
  
  /** Execution metadata */
  private metadata: Record<string, any> = {};
  
  /** Cache for results */
  private static cache = new Map<string, any>();

  constructor(config: ActionNodeConfig) {
    super();
    this.config = { ...config };
    this.validateConfig();
  }

  /**
   * Validate node configuration
   */
  private validateConfig(): void {
    const schema = z.object({
      key: z.string().min(1),
      expectedType: z.string().min(1),
      instruction: z.string().min(1),
      example: z.any(),
      content: z.string().optional(),
      children: z.record(z.any()).optional(),
      schema: z.nativeEnum(FillMode).optional(),
      timeout: z.number().positive().optional(),
      maxRetries: z.number().min(0).optional(),
      enableCache: z.boolean().optional(),
      validator: z.function().optional(),
      rollback: z.function().optional()
    });

    try {
      schema.parse(this.config);
    } catch (error) {
      throw new Error(`Invalid ActionNode configuration: ${error}`);
    }
  }

  /**
   * Get node identifier
   */
  get key(): string {
    return this.config.key;
  }

  /**
   * Get node status
   */
  get nodeStatus(): ActionNodeStatus {
    return this.status;
  }

  /**
   * Get execution result
   */
  get executionResult(): any {
    return this.result;
  }

  /**
   * Get execution error
   */
  get executionError(): Error | null {
    return this.error;
  }

  /**
   * Get execution duration
   */
  get executionDuration(): number {
    return this.duration;
  }

  /**
   * Get node metadata
   */
  get nodeMetadata(): Record<string, any> {
    return { ...this.metadata };
  }

  /**
   * Add dependency node
   */
  addDependency(node: ActionNode): void {
    if (!this.dependencies.includes(node)) {
      this.dependencies.push(node);
      node.dependents.push(this);
    }
  }

  /**
   * Remove dependency node
   */
  removeDependency(node: ActionNode): void {
    const index = this.dependencies.indexOf(node);
    if (index !== -1) {
      this.dependencies.splice(index, 1);
      const dependentIndex = node.dependents.indexOf(this);
      if (dependentIndex !== -1) {
        node.dependents.splice(dependentIndex, 1);
      }
    }
  }

  /**
   * Get dependency nodes
   */
  getDependencies(): ActionNode[] {
    return [...this.dependencies];
  }

  /**
   * Get dependent nodes
   */
  getDependents(): ActionNode[] {
    return [...this.dependents];
  }

  /**
   * Check if all dependencies are satisfied
   */
  areDependenciesSatisfied(): boolean {
    return this.dependencies.every(dep => dep.status === ActionNodeStatus.COMPLETED);
  }

  /**
   * Add child node
   */
  addChild(node: ActionNode): void {
    if (!this.config.children) {
      this.config.children = {};
    }
    this.config.children[node.key] = node;
  }

  /**
   * Get child node by key
   */
  getChild(key: string): ActionNode | undefined {
    return this.config.children?.[key];
  }

  /**
   * Get all child nodes
   */
  getChildren(): Record<string, ActionNode> {
    return { ...this.config.children } || {};
  }

  /**
   * Set node metadata
   */
  setMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  /**
   * Get node metadata value
   */
  getMetadata<T>(key: string): T | undefined {
    return this.metadata[key] as T | undefined;
  }

  /**
   * Generate cache key for result caching
   */
  private generateCacheKey(context: ActionNodeExecutionContext): string {
    const contextHash = JSON.stringify({
      key: this.config.key,
      instruction: this.config.instruction,
      context: context.context,
      args: context.args,
      mode: context.mode,
      fillMode: context.fillMode
    });
    
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < contextHash.length; i++) {
      const char = contextHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `actionnode_${Math.abs(hash)}`;
  }

  /**
   * Get serialization path for this node
   */
  getSerializationPath(): string {
    return `./serialized/ActionNode_${this.config.key}_${Date.now()}.json`;
  }

  /**
   * Convert node to JSON for serialization
   */
  toJSON(): Record<string, any> {
    return {
      config: this.config,
      status: this.status,
      result: this.result,
      error: this.error?.message,
      duration: this.duration,
      metadata: this.metadata,
      dependencies: this.dependencies.map(dep => dep.key),
      dependents: this.dependents.map(dep => dep.key)
    };
  }

  /**
   * Create node from JSON data
   */
  static fromJSON(data: Record<string, any>): ActionNode {
    const node = new ActionNode(data.config);
    node.status = data.status || ActionNodeStatus.PENDING;
    node.result = data.result;
    node.error = data.error ? new Error(data.error) : null;
    node.duration = data.duration || 0;
    node.metadata = data.metadata || {};
    return node;
  }

  /**
   * Execute the action node
   */
  async execute(context: ActionNodeExecutionContext): Promise<ActionNodeResult> {
    // Check if dependencies are satisfied
    if (!this.areDependenciesSatisfied()) {
      const pendingDeps = this.dependencies
        .filter(dep => dep.status !== ActionNodeStatus.COMPLETED)
        .map(dep => dep.key);

      const error = new Error(`Dependencies not satisfied: ${pendingDeps.join(', ')}`);
      return this.createFailureResult(error);
    }

    // Check cache if enabled
    if (this.config.enableCache) {
      const cacheKey = this.generateCacheKey(context);
      const cachedResult = ActionNode.cache.get(cacheKey);
      if (cachedResult) {
        logger.debug(`[ActionNode:${this.key}] Using cached result`);
        this.result = cachedResult;
        this.status = ActionNodeStatus.COMPLETED;
        return this.createSuccessResult(cachedResult);
      }
    }

    this.startTime = Date.now();
    this.status = ActionNodeStatus.RUNNING;
    this.error = null;

    try {
      logger.info(`[ActionNode:${this.key}] Starting execution`);

      // Collect dependency results as inputs
      const dependencyInputs = this.collectDependencyInputs();

      // Merge with provided args
      const executionArgs = {
        ...context.args,
        ...dependencyInputs
      };

      // Execute based on mode
      let result: any;
      switch (context.mode || ActionNodeMode.SIMPLE) {
        case ActionNodeMode.SIMPLE:
          result = await this.executeSimple(context, executionArgs);
          break;
        case ActionNodeMode.COMPLEX:
          result = await this.executeComplex(context, executionArgs);
          break;
        case ActionNodeMode.PARALLEL:
          result = await this.executeParallel(context, executionArgs);
          break;
        default:
          throw new Error(`Unsupported execution mode: ${context.mode}`);
      }

      // Validate result if validator is provided
      if (this.config.validator) {
        const isValid = await this.config.validator(result);
        if (!isValid) {
          throw new Error('Result validation failed');
        }
      }

      // Cache result if enabled
      if (this.config.enableCache) {
        const cacheKey = this.generateCacheKey(context);
        ActionNode.cache.set(cacheKey, result);
      }

      this.result = result;
      this.status = ActionNodeStatus.COMPLETED;
      this.duration = Date.now() - this.startTime;

      logger.info(`[ActionNode:${this.key}] Execution completed in ${this.duration}ms`);

      // Notify dependents
      await this.notifyDependents(context);

      return this.createSuccessResult(result);

    } catch (error) {
      this.error = error as Error;
      this.status = ActionNodeStatus.FAILED;
      this.duration = Date.now() - this.startTime;

      logger.error(`[ActionNode:${this.key}] Execution failed:`, error);

      return this.createFailureResult(error as Error);
    }
  }

  /**
   * Execute in simple mode
   */
  private async executeSimple(
    context: ActionNodeExecutionContext,
    args: Record<string, any>
  ): Promise<any> {
    const prompt = this.buildPrompt(context, args);

    switch (context.fillMode || FillMode.JSON) {
      case FillMode.JSON:
        return await this.fillJSON(context.llm, prompt);
      case FillMode.MARKDOWN:
        return await this.fillMarkdown(context.llm, prompt);
      case FillMode.RAW:
        return await this.fillRaw(context.llm, prompt);
      case FillMode.XML:
        return await this.fillXML(context.llm, prompt);
      case FillMode.CODE:
        return await this.fillCode(context.llm, prompt);
      default:
        throw new Error(`Unsupported fill mode: ${context.fillMode}`);
    }
  }

  /**
   * Execute in complex mode (process children)
   */
  private async executeComplex(
    context: ActionNodeExecutionContext,
    args: Record<string, any>
  ): Promise<any> {
    if (!this.config.children || Object.keys(this.config.children).length === 0) {
      return await this.executeSimple(context, args);
    }

    const results: Record<string, any> = {};
    const exclude = context.exclude || [];

    for (const [key, child] of Object.entries(this.config.children)) {
      if (exclude.includes(key)) {
        continue;
      }

      const childResult = await child.execute({
        ...context,
        args: { ...args, ...results }
      });

      if (!childResult.success) {
        throw new Error(`Child node ${key} failed: ${childResult.error?.message}`);
      }

      results[key] = childResult.result;
    }

    return results;
  }

  /**
   * Execute in parallel mode
   */
  private async executeParallel(
    context: ActionNodeExecutionContext,
    args: Record<string, any>
  ): Promise<any> {
    if (!this.config.children || Object.keys(this.config.children).length === 0) {
      return await this.executeSimple(context, args);
    }

    const exclude = context.exclude || [];
    const childPromises: Promise<{ key: string; result: ActionNodeResult }>[] = [];

    for (const [key, child] of Object.entries(this.config.children)) {
      if (exclude.includes(key)) {
        continue;
      }

      const promise = child.execute({
        ...context,
        args
      }).then(result => ({ key, result }));

      childPromises.push(promise);
    }

    const childResults = await Promise.all(childPromises);
    const results: Record<string, any> = {};

    for (const { key, result } of childResults) {
      if (!result.success) {
        throw new Error(`Child node ${key} failed: ${result.error?.message}`);
      }
      results[key] = result.result;
    }

    return results;
  }

  /**
   * Collect inputs from dependency nodes
   */
  private collectDependencyInputs(): Record<string, any> {
    const inputs: Record<string, any> = {};

    for (const dep of this.dependencies) {
      if (dep.status === ActionNodeStatus.COMPLETED && dep.result !== null) {
        inputs[dep.key] = dep.result;
      }
    }

    return inputs;
  }

  /**
   * Notify dependent nodes that this node has completed
   */
  private async notifyDependents(context: ActionNodeExecutionContext): Promise<void> {
    const readyDependents = this.dependents.filter(dep =>
      dep.areDependenciesSatisfied() && dep.status === ActionNodeStatus.PENDING
    );

    // Execute ready dependents in parallel
    const notifications = readyDependents.map(dep =>
      dep.execute(context).catch(error => {
        logger.error(`[ActionNode:${this.key}] Dependent ${dep.key} failed:`, error);
      })
    );

    await Promise.all(notifications);
  }

  /**
   * Create success result
   */
  private createSuccessResult(result: any): ActionNodeResult {
    return {
      nodeId: this.key,
      success: true,
      result,
      duration: this.duration,
      metadata: { ...this.metadata }
    };
  }

  /**
   * Create failure result
   */
  private createFailureResult(error: Error): ActionNodeResult {
    return {
      nodeId: this.key,
      success: false,
      error,
      duration: this.duration,
      metadata: { ...this.metadata }
    };
  }

  /**
   * Build prompt for LLM execution
   */
  private buildPrompt(context: ActionNodeExecutionContext, args: Record<string, any>): string {
    let prompt = `## Context\n${context.context}\n\n`;

    if (Object.keys(args).length > 0) {
      prompt += `## Input Arguments\n`;
      for (const [key, value] of Object.entries(args)) {
        prompt += `- ${key}: ${JSON.stringify(value)}\n`;
      }
      prompt += '\n';
    }

    prompt += `## Instruction\n${this.config.instruction}\n\n`;

    if (this.config.example) {
      prompt += `## Example\n${JSON.stringify(this.config.example, null, 2)}\n\n`;
    }

    return prompt;
  }

  /**
   * Fill with JSON format
   */
  private async fillJSON(llm: LLMProvider, prompt: string): Promise<any> {
    const response = await llm.chat(prompt + '\nPlease respond in valid JSON format.');

    try {
      return JSON.parse(response);
    } catch (error) {
      logger.warn(`[ActionNode:${this.key}] Failed to parse JSON response, returning raw text`);
      return response;
    }
  }

  /**
   * Fill with Markdown format
   */
  private async fillMarkdown(llm: LLMProvider, prompt: string): Promise<string> {
    return await llm.chat(prompt + '\nPlease respond in Markdown format.');
  }

  /**
   * Fill with raw text format
   */
  private async fillRaw(llm: LLMProvider, prompt: string): Promise<string> {
    return await llm.chat(prompt);
  }

  /**
   * Fill with XML format
   */
  private async fillXML(llm: LLMProvider, prompt: string): Promise<any> {
    const xmlPrompt = prompt + `\n\nPlease respond in XML format with the following structure:
<${this.config.key}>
  <content>Your response here</content>
</${this.config.key}>`;

    const response = await llm.chat(xmlPrompt);

    // Simple XML parsing - extract content between tags
    const match = response.match(new RegExp(`<${this.config.key}>(.*?)</${this.config.key}>`, 's'));
    if (match) {
      const contentMatch = match[1].match(/<content>(.*?)<\/content>/s);
      return contentMatch ? contentMatch[1].trim() : match[1].trim();
    }

    return response;
  }

  /**
   * Fill with code format
   */
  private async fillCode(llm: LLMProvider, prompt: string): Promise<string> {
    const codePrompt = prompt + '\nPlease respond with code wrapped in ```code blocks```.';
    const response = await llm.chat(codePrompt);

    // Extract code from markdown code blocks
    const codeMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);
    return codeMatch ? codeMatch[1].trim() : response;
  }

  /**
   * Rollback the action node execution
   */
  async rollback(): Promise<void> {
    if (this.status === ActionNodeStatus.COMPLETED && this.config.rollback && this.result) {
      try {
        logger.info(`[ActionNode:${this.key}] Rolling back execution`);
        await this.config.rollback(this.result);
        this.status = ActionNodeStatus.ROLLED_BACK;
        logger.info(`[ActionNode:${this.key}] Rollback completed`);
      } catch (error) {
        logger.error(`[ActionNode:${this.key}] Rollback failed:`, error);
        throw error;
      }
    }
  }

  /**
   * Reset the node to pending status
   */
  reset(): void {
    this.status = ActionNodeStatus.PENDING;
    this.result = null;
    this.error = null;
    this.duration = 0;
    this.startTime = 0;
    this.metadata = {};
  }

  /**
   * Clone the action node
   */
  clone(): ActionNode {
    const clonedConfig = JSON.parse(JSON.stringify(this.config));
    const clonedNode = new ActionNode(clonedConfig);
    clonedNode.metadata = { ...this.metadata };
    return clonedNode;
  }

  /**
   * Get node summary for debugging
   */
  getSummary(): Record<string, any> {
    return {
      key: this.key,
      status: this.status,
      hasResult: this.result !== null,
      hasError: this.error !== null,
      duration: this.duration,
      dependencyCount: this.dependencies.length,
      dependentCount: this.dependents.length,
      childrenCount: Object.keys(this.config.children || {}).length
    };
  }
}
