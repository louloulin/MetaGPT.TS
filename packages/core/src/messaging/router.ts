/**
 * TypeScript原生消息路由器实现
 * 
 * 高性能的消息路由引擎：
 * - 支持复杂的路由规则
 * - 中间件管道处理
 * - 并发控制和限流
 * - 指标收集和监控
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { SerializationMixin, SerializeField, SerializableClass } from '../base/serialization';
import { AdvancedMessageMatcher } from './matcher';
import type {
  RoutableMessage,
  RouteRule,
  RouteResult,
  RouterConfig,
  RouterMetrics,
  RouterEvents,
  RouterMiddleware,
  MessageFilter,
  MessageTransformer,
  MessageHandler,
  RouterId,
  RoutePattern,
} from './types';
import { createRouterId, isRoutableMessage } from './types';

/**
 * 并发控制器
 */
class ConcurrencyController {
  private activeCount = 0;
  private readonly maxConcurrency: number;
  private readonly queue: Array<() => void> = [];

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeTask = async () => {
        this.activeCount++;
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          this.processQueue();
        }
      };

      if (this.activeCount < this.maxConcurrency) {
        executeTask();
      } else {
        this.queue.push(executeTask);
      }
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.activeCount < this.maxConcurrency) {
      const nextTask = this.queue.shift();
      if (nextTask) {
        nextTask();
      }
    }
  }

  getStats(): { active: number; queued: number; maxConcurrency: number } {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
    };
  }
}

/**
 * 高性能消息路由器
 */
@SerializableClass({ 
  typeName: 'MessageRouter',
  version: '1.0.0'
})
export class MessageRouter<T extends RoutableMessage = RoutableMessage> 
  extends SerializationMixin 
  implements TypedEventEmitter<RouterEvents<T>> {
  
  private readonly emitter = new EventEmitter();
  
  @SerializeField()
  private readonly config: RouterConfig;
  
  @SerializeField()
  private readonly rules = new Map<string, RouteRule<T>>();
  
  @SerializeField({ serialize: false })
  private readonly matcher: AdvancedMessageMatcher;
  
  @SerializeField({ serialize: false })
  private readonly middlewares: RouterMiddleware<T>[] = [];
  
  @SerializeField({ serialize: false })
  private readonly concurrencyController: ConcurrencyController;
  
  @SerializeField()
  private readonly metrics: RouterMetrics;
  
  @SerializeField({ serialize: false })
  private readonly deadLetterQueue: T[] = [];
  
  @SerializeField({ serialize: false })
  private running = false;

  constructor(config: Partial<RouterConfig> = {}) {
    super();
    
    this.config = {
      id: createRouterId(config.id || `router-${Date.now()}`),
      name: config.name || 'MessageRouter',
      debug: config.debug || false,
      maxConcurrency: config.maxConcurrency || 10,
      messageTimeout: config.messageTimeout || 30000,
      enableMetrics: config.enableMetrics || true,
      deadLetterQueue: {
        enabled: true,
        maxSize: 1000,
        ttl: 3600000, // 1 hour
        ...config.deadLetterQueue,
      },
    };

    this.matcher = new AdvancedMessageMatcher();
    this.concurrencyController = new ConcurrencyController(this.config.maxConcurrency);
    
    this.metrics = {
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      filteredMessages: 0,
      averageProcessingTime: 0,
      currentQueueSize: 0,
      activeRules: 0,
      lastUpdated: new Date(),
    };

    if (this.config.debug) {
      logger.debug(`[MessageRouter:${this.config.id}] Initialized`);
    }
  }

  /**
   * 启动路由器
   */
  start(): void {
    if (this.running) {
      logger.warn(`[MessageRouter:${this.config.id}] Already running`);
      return;
    }

    this.running = true;

    if (this.config.debug) {
      logger.debug(`[MessageRouter:${this.config.id}] Started`);
    }
  }

  /**
   * 停止路由器
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.config.debug) {
      logger.debug(`[MessageRouter:${this.config.id}] Stopped`);
    }
  }

  /**
   * 路由消息
   */
  async route(message: T): Promise<RouteResult<T>> {
    if (!this.running) {
      throw new Error('Router is not running');
    }

    if (!isRoutableMessage(message)) {
      throw new Error('Invalid routable message');
    }

    const startTime = Date.now();
    
    this.emitEvent('message:received', message);
    this.updateMetrics('totalMessages', 1);

    try {
      // 执行中间件管道
      const result = await this.concurrencyController.execute(() =>
        this.executeMiddlewarePipeline(message)
      );

      // 更新指标
      const duration = Date.now() - startTime;
      this.updateProcessingTime(duration);
      
      if (result.success) {
        this.updateMetrics('successfulMessages', 1);
      } else {
        this.updateMetrics('failedMessages', 1);
      }

      this.emitEvent('message:routed', result);
      
      if (this.config.debug) {
        logger.debug(`[MessageRouter:${this.config.id}] Routed message ${message.id} in ${duration}ms`);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const result: RouteResult<T> = {
        success: false,
        message,
        handlerCount: 0,
        duration,
        error: error as Error,
      };

      this.updateMetrics('failedMessages', 1);
      this.emitEvent('message:failed', message, error as Error);
      
      // 添加到死信队列
      this.addToDeadLetterQueue(message);

      logger.error(`[MessageRouter:${this.config.id}] Failed to route message ${message.id}:`, error);
      
      return result;
    }
  }

  /**
   * 添加路由规则
   */
  addRule(rule: RouteRule<T>): void {
    this.rules.set(rule.id, rule);
    this.updateMetrics('activeRules', this.rules.size, false);
    this.emitEvent('rule:added', rule);

    if (this.config.debug) {
      logger.debug(`[MessageRouter:${this.config.id}] Added rule: ${rule.id}`);
    }
  }

  /**
   * 移除路由规则
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.updateMetrics('activeRules', this.rules.size, false);
      this.emitEvent('rule:removed', ruleId);

      if (this.config.debug) {
        logger.debug(`[MessageRouter:${this.config.id}] Removed rule: ${ruleId}`);
      }
    }
    return removed;
  }

  /**
   * 更新路由规则
   */
  updateRule(rule: RouteRule<T>): void {
    if (this.rules.has(rule.id)) {
      this.rules.set(rule.id, rule);
      this.emitEvent('rule:updated', rule);
      
      if (this.config.debug) {
        logger.debug(`[MessageRouter:${this.config.id}] Updated rule: ${rule.id}`);
      }
    }
  }

  /**
   * 获取路由规则
   */
  getRule(ruleId: string): RouteRule<T> | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * 获取所有路由规则
   */
  getAllRules(): RouteRule<T>[] {
    return Array.from(this.rules.values());
  }

  /**
   * 添加中间件
   */
  use(middleware: RouterMiddleware<T>): void {
    this.middlewares.push(middleware);
    
    if (this.config.debug) {
      logger.debug(`[MessageRouter:${this.config.id}] Added middleware`);
    }
  }

  /**
   * 获取路由器配置
   */
  getConfig(): RouterConfig {
    return { ...this.config };
  }

  /**
   * 检查路由器是否运行
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 获取路由器指标
   */
  getMetrics(): RouterMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取死信队列
   */
  getDeadLetterQueue(): T[] {
    return [...this.deadLetterQueue];
  }

  /**
   * 清空死信队列
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
    
    if (this.config.debug) {
      logger.debug(`[MessageRouter:${this.config.id}] Cleared dead letter queue`);
    }
  }

  /**
   * 执行中间件管道
   */
  private async executeMiddlewarePipeline(message: T): Promise<RouteResult<T>> {
    let currentMessage = message;
    let middlewareIndex = 0;

    const next = async (msg: T): Promise<RouteResult<T>> => {
      if (middlewareIndex < this.middlewares.length) {
        const middleware = this.middlewares[middlewareIndex++];
        return middleware(msg, next);
      } else {
        return this.executeRouting(msg);
      }
    };

    return next(currentMessage);
  }

  /**
   * 执行路由逻辑
   */
  private async executeRouting(message: T): Promise<RouteResult<T>> {
    const startTime = Date.now();
    let handlerCount = 0;
    let matchedPattern: RoutePattern | undefined;

    // 获取匹配的规则（按优先级排序）
    const matchedRules = this.getMatchedRules(message);
    
    for (const rule of matchedRules) {
      if (!rule.enabled) continue;

      try {
        // 应用过滤器
        const passedFilters = await this.applyFilters(message, rule.filters);
        if (!passedFilters) {
          this.updateMetrics('filteredMessages', 1);
          continue;
        }

        // 应用转换器
        const transformedMessage = await this.applyTransformers(message, rule.transformers);
        
        // 执行处理器
        await this.executeHandlers(transformedMessage, rule.handlers);
        
        handlerCount += rule.handlers.length;
        matchedPattern = rule.pattern;

      } catch (error) {
        logger.error(`[MessageRouter:${this.config.id}] Rule execution error:`, error);
        throw error;
      }
    }

    const duration = Date.now() - startTime;
    
    return {
      success: true,
      message,
      matchedPattern,
      handlerCount,
      duration,
    };
  }

  /**
   * 获取匹配的规则
   */
  private getMatchedRules(message: T): RouteRule<T>[] {
    const matched: RouteRule<T>[] = [];

    for (const rule of this.rules.values()) {
      if (this.matcher.match(rule.pattern, message)) {
        matched.push(rule);
      }
    }

    // 按优先级排序（高优先级优先）
    return matched.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 应用过滤器
   */
  private async applyFilters(message: T, filters: MessageFilter<T>[]): Promise<boolean> {
    for (const filter of filters) {
      const passed = await filter(message);
      if (!passed) {
        return false;
      }
    }
    return true;
  }

  /**
   * 应用转换器
   */
  private async applyTransformers(message: T, transformers: MessageTransformer<T, T>[]): Promise<T> {
    let currentMessage = message;
    
    for (const transformer of transformers) {
      const transformedMessage = await transformer(currentMessage);
      
      if (transformedMessage !== currentMessage) {
        this.emitEvent('message:transformed', currentMessage, transformedMessage);
        currentMessage = transformedMessage;
      }
    }
    
    return currentMessage;
  }

  /**
   * 执行处理器
   */
  private async executeHandlers(message: T, handlers: MessageHandler<T>[]): Promise<void> {
    await Promise.all(handlers.map(handler => handler(message)));
  }

  /**
   * 添加到死信队列
   */
  private addToDeadLetterQueue(message: T): void {
    if (!this.config.deadLetterQueue?.enabled) {
      return;
    }

    // 检查队列大小限制
    if (this.deadLetterQueue.length >= this.config.deadLetterQueue.maxSize) {
      this.deadLetterQueue.shift(); // 移除最旧的消息
    }

    this.deadLetterQueue.push(message);
  }

  /**
   * 更新指标
   */
  private updateMetrics(key: keyof RouterMetrics, value: number, increment: boolean = true): void {
    if (!this.config.enableMetrics) {
      return;
    }

    if (typeof this.metrics[key] === 'number') {
      if (increment) {
        (this.metrics as any)[key] += value;
      } else {
        (this.metrics as any)[key] = value;
      }
    }

    this.metrics.lastUpdated = new Date();
    this.emitEvent('metrics:updated', this.metrics);
  }

  /**
   * 更新处理时间
   */
  private updateProcessingTime(duration: number): void {
    if (!this.config.enableMetrics) {
      return;
    }

    const total = this.metrics.totalMessages;
    const currentAvg = this.metrics.averageProcessingTime;
    
    this.metrics.averageProcessingTime = ((currentAvg * (total - 1)) + duration) / total;
  }

  /**
   * 发射事件
   */
  private emitEvent<K extends keyof RouterEvents<T>>(
    event: K,
    ...args: Parameters<RouterEvents<T>[K]>
  ): void {
    this.emitter.emit(event, ...args);
  }

  /**
   * 事件监听器方法
   */
  on<K extends keyof RouterEvents<T>>(event: K, listener: RouterEvents<T>[K]): this {
    this.emitter.on(event, listener);
    return this;
  }

  off<K extends keyof RouterEvents<T>>(event: K, listener: RouterEvents<T>[K]): this {
    this.emitter.off(event, listener);
    return this;
  }

  /**
   * 序列化路径
   */
  getSerializationPath(): string {
    return `./routers/${this.config.id}.json`;
  }
}

/**
 * 类型化事件发射器接口
 */
interface TypedEventEmitter<T> {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  off<K extends keyof T>(event: K, listener: T[K]): this;
}

/**
 * 路由器工厂类
 */
export class RouterFactory {
  /**
   * 创建标准消息路由器
   */
  static createStandard<T extends RoutableMessage = RoutableMessage>(
    config?: Partial<RouterConfig>
  ): MessageRouter<T> {
    return new MessageRouter<T>({
      maxConcurrency: 10,
      messageTimeout: 30000,
      enableMetrics: true,
      ...config,
    });
  }

  /**
   * 创建高性能路由器
   */
  static createHighPerformance<T extends RoutableMessage = RoutableMessage>(
    config?: Partial<RouterConfig>
  ): MessageRouter<T> {
    return new MessageRouter<T>({
      maxConcurrency: 50,
      messageTimeout: 10000,
      enableMetrics: false,
      deadLetterQueue: {
        enabled: false,
        maxSize: 0,
        ttl: 0,
      },
      ...config,
    });
  }

  /**
   * 创建调试路由器
   */
  static createDebug<T extends RoutableMessage = RoutableMessage>(
    config?: Partial<RouterConfig>
  ): MessageRouter<T> {
    return new MessageRouter<T>({
      debug: true,
      maxConcurrency: 1,
      messageTimeout: 60000,
      enableMetrics: true,
      ...config,
    });
  }
}
