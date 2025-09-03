import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import type { 
  Tool, 
  ToolConfig, 
  ToolContext, 
  ToolResult, 
  ToolId,
  ToolType,
  ToolStateType,
  ToolInfo,
  ToolMetrics,
  ToolExecutionOptions,
  ToolEvents
} from '../types/tool';
import {
  ToolState,
  ToolPriority
} from '../types/tool';

/**
 * 简化的工具基类
 * 提供核心功能而不依赖复杂的外部系统
 */
export abstract class SimpleBaseTool implements Tool {
  readonly id: ToolId;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: string;
  readonly type: ToolType;
  readonly context: ToolContext;
  
  protected _enabled: boolean = true;
  protected _state: ToolStateType = ToolState.IDLE;
  protected _eventEmitter: EventEmitter;
  protected _metrics: ToolMetrics;
  protected _createdAt: Date;
  protected _lastExecutedAt?: Date;
  protected _tags: Set<string>;
  protected _abortController?: AbortController;

  constructor(config: ToolConfig) {
    // 应用默认值并验证配置
    const configWithDefaults = {
      priority: ToolPriority.NORMAL,
      dependencies: [],
      tags: [],
      enabled: true,
      timeout: 30000,
      retries: 0,
      metadata: {},
      ...config,
    };
    
    const validConfig = configWithDefaults;

    // 初始化基本属性
    this.id = (validConfig.id || `tool-${uuidv4()}`) as ToolId;
    this.name = validConfig.name;
    this.description = validConfig.description;
    this.version = validConfig.version;
    this.category = validConfig.category;
    this.type = validConfig.type as ToolType;
    this._enabled = validConfig.enabled!;
    this._createdAt = new Date();
    this._tags = new Set(validConfig.tags || []);

    // 构建增强的上下文
    this.context = {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      state: this._state,
      args: validConfig.args || {},
      stateData: {},
      history: [],
      metrics: {
        executionCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        successCount: 0,
        failureCount: 0,
      },
      metadata: validConfig.metadata || {},
    };

    // 初始化事件发射器
    this._eventEmitter = new EventEmitter();
    this._eventEmitter.setMaxListeners(100);

    // 初始化指标
    this._metrics = {
      executionCount: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      resourceUsage: {
        cpu: { min: 0, max: 0, avg: 0 },
        memory: { min: 0, max: 0, avg: 0 },
        network: { min: 0, max: 0, avg: 0 },
      },
    };

    logger.debug(`Tool created: ${this.name} (${this.id})`);
    this._eventEmitter.emit('tool:created', this.getInfo());
  }

  /**
   * 获取工具启用状态
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * 设置工具启用状态
   */
  set enabled(value: boolean) {
    this._enabled = value;
    logger.debug(`Tool ${this.name} enabled: ${value}`);
  }

  /**
   * 获取工具状态
   */
  getState(): ToolStateType {
    return this._state;
  }

  /**
   * 获取工具信息
   */
  getInfo(): ToolInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      state: this._state,
      createdAt: this._createdAt,
      lastExecutedAt: this._lastExecutedAt,
      tags: new Set(this._tags),
      metadata: { ...this.context.metadata },
    };
  }

  /**
   * 获取工具指标
   */
  getMetrics(): ToolMetrics {
    return { ...this._metrics };
  }

  /**
   * 执行工具（增强版本）
   */
  async execute(args?: Record<string, any>, options?: ToolExecutionOptions): Promise<ToolResult> {
    if (!this._enabled) {
      throw new Error(`Tool ${this.name} is disabled`);
    }

    if (this._state === ToolState.RUNNING) {
      throw new Error(`Tool ${this.name} is already running`);
    }

    // 创建中止控制器
    this._abortController = new AbortController();
    const timeout = options?.timeout || 30000;
    const timeoutId = setTimeout(() => {
      this._abortController?.abort();
    }, timeout);

    const startTime = new Date();
    let result: ToolResult;

    try {
      // 转换到运行状态
      this._state = ToolState.RUNNING;
      this.context.state = this._state;
      this._eventEmitter.emit('tool:started', this.getInfo());

      // 更新上下文
      this.context.args = { ...this.context.args, ...args };
      if (options?.environmentId) {
        this.context.environmentId = options.environmentId;
      }
      if (options?.sessionId) {
        this.context.sessionId = options.sessionId;
      }

      // 执行具体的工具逻辑
      result = await this.executeInternal(args, options);

      // 转换到完成状态
      this._state = ToolState.COMPLETED;
      this.context.state = this._state;
      this._eventEmitter.emit('tool:completed', this.getInfo(), result);

    } catch (error) {
      // 转换到失败状态
      this._state = ToolState.FAILED;
      this.context.state = this._state;
      
      const toolError = error as Error;
      result = this.createErrorResult(toolError, startTime);
      
      this._eventEmitter.emit('tool:failed', this.getInfo(), toolError);
      await this.handleError(toolError);
      
      throw error;
    } finally {
      clearTimeout(timeoutId);
      this._abortController = undefined;
      
      // 更新指标
      this.updateMetrics(result, startTime);
      this._lastExecutedAt = new Date();
      
      // 回到空闲状态
      this._state = ToolState.IDLE;
      this.context.state = this._state;
    }

    return result;
  }

  /**
   * 子类必须实现的具体执行逻辑
   */
  protected abstract executeInternal(args?: Record<string, any>, options?: ToolExecutionOptions): Promise<ToolResult>;

  /**
   * 取消工具执行
   */
  async cancel(): Promise<void> {
    if (this._state === ToolState.RUNNING) {
      this._abortController?.abort();
      this._state = ToolState.CANCELLED;
      this.context.state = this._state;
      this._eventEmitter.emit('tool:cancelled', this.getInfo());
      logger.debug(`Tool ${this.name} cancelled`);
    }
  }

  /**
   * 重置工具状态
   */
  async reset(): Promise<void> {
    if (this._state !== ToolState.IDLE) {
      this._state = ToolState.IDLE;
      this.context.state = this._state;
      this.context.stateData = {};
      logger.debug(`Tool ${this.name} reset`);
    }
  }

  /**
   * 验证工具是否可用
   */
  async validate(): Promise<boolean> {
    return this._enabled;
  }

  /**
   * 处理工具执行异常
   */
  async handleError(error: Error): Promise<void> {
    logger.error(`Tool ${this.name} failed:`, error);
    
    // 记录错误到历史
    this.context.history.push({
      type: 'error',
      timestamp: new Date(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    });

    // 子类可以覆盖此方法以提供自定义错误处理
    await this.onError(error);
  }

  /**
   * 错误处理钩子，子类可以覆盖
   */
  protected async onError(error: Error): Promise<void> {
    // 默认实现为空，子类可以覆盖
  }

  /**
   * 获取工具帮助信息
   */
  getHelp(): string {
    const tags = Array.from(this._tags).join(', ');
    const metrics = this.getMetrics();
    
    return `
Tool: ${this.name} (v${this.version})
ID: ${this.id}
Type: ${this.type}
Category: ${this.category}
Description: ${this.description}
Enabled: ${this._enabled}
State: ${this._state}
Tags: ${tags || 'None'}

Performance Metrics:
- Executions: ${metrics.executionCount}
- Success Rate: ${(metrics.successRate * 100).toFixed(1)}%
- Average Execution Time: ${metrics.averageExecutionTime.toFixed(2)}ms

Arguments:
${this.formatArgs()}
    `.trim();
  }

  /**
   * 序列化工具状态
   */
  serialize(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version: this.version,
      category: this.category,
      type: this.type,
      enabled: this._enabled,
      state: this._state,
      context: this.context,
      metrics: this._metrics,
      createdAt: this._createdAt.toISOString(),
      lastExecutedAt: this._lastExecutedAt?.toISOString(),
      tags: Array.from(this._tags),
    };
  }

  /**
   * 反序列化工具状态
   */
  async deserialize(data: Record<string, any>): Promise<void> {
    if (data.enabled !== undefined) {
      this._enabled = data.enabled;
    }
    if (data.state) {
      this._state = data.state;
    }
    if (data.context) {
      Object.assign(this.context, data.context);
    }
    if (data.metrics) {
      Object.assign(this._metrics, data.metrics);
    }
    if (data.lastExecutedAt) {
      this._lastExecutedAt = new Date(data.lastExecutedAt);
    }
    if (data.tags) {
      this._tags = new Set(data.tags);
    }
    
    logger.debug(`Tool ${this.name} deserialized`);
  }

  /**
   * 创建工具执行结果
   */
  protected createResult(
    success: boolean,
    message: string,
    data?: any,
    metadata?: Record<string, any>,
    startTime?: Date
  ): ToolResult {
    const now = new Date();
    const start = startTime || now;
    
    return {
      toolId: this.id,
      success,
      message,
      data,
      executionTime: now.getTime() - start.getTime(),
      startTime: start,
      endTime: now,
      metadata: metadata || {},
      outputFiles: [],
      warnings: [],
    };
  }

  /**
   * 创建错误结果
   */
  protected createErrorResult(error: Error, startTime: Date): ToolResult {
    const now = new Date();
    
    return {
      toolId: this.id,
      success: false,
      message: `Tool execution failed: ${error.message}`,
      error: {
        code: error.name,
        message: error.message,
        stack: error.stack,
      },
      executionTime: now.getTime() - startTime.getTime(),
      startTime,
      endTime: now,
      metadata: {},
      outputFiles: [],
      warnings: [],
    };
  }

  /**
   * 更新工具指标
   */
  private updateMetrics(result: ToolResult, startTime: Date): void {
    this._metrics.executionCount++;
    this._metrics.totalExecutionTime += result.executionTime;
    this._metrics.averageExecutionTime = this._metrics.totalExecutionTime / this._metrics.executionCount;
    
    if (result.success) {
      this._metrics.successCount++;
    } else {
      this._metrics.failureCount++;
    }
    
    this._metrics.successRate = this._metrics.successCount / this._metrics.executionCount;
    this._metrics.lastExecutionTime = result.endTime;

    // 更新上下文中的指标
    this.context.metrics = {
      executionCount: this._metrics.executionCount,
      totalExecutionTime: this._metrics.totalExecutionTime,
      averageExecutionTime: this._metrics.averageExecutionTime,
      successCount: this._metrics.successCount,
      failureCount: this._metrics.failureCount,
      lastExecutionTime: this._metrics.lastExecutionTime,
    };
  }

  /**
   * 格式化参数说明
   */
  private formatArgs(): string {
    const args = this.context.args || {};
    if (Object.keys(args).length === 0) {
      return 'No arguments';
    }
    
    return Object.entries(args)
      .map(([key, value]) => `- ${key}: ${typeof value} = ${JSON.stringify(value)}`)
      .join('\n');
  }

  /**
   * 事件监听器方法
   */
  on<K extends keyof ToolEvents>(event: K, listener: ToolEvents[K]): this {
    this._eventEmitter.on(event, listener);
    return this;
  }

  /**
   * 移除事件监听器
   */
  off<K extends keyof ToolEvents>(event: K, listener: ToolEvents[K]): this {
    this._eventEmitter.off(event, listener);
    return this;
  }

  /**
   * 发射事件
   */
  protected emit<K extends keyof ToolEvents>(event: K, ...args: Parameters<ToolEvents[K]>): boolean {
    return this._eventEmitter.emit(event, ...args);
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    await this.cancel();
    this._eventEmitter.removeAllListeners();
    logger.debug(`Tool ${this.name} disposed`);
  }
}
