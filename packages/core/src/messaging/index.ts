/**
 * TypeScript原生消息路由系统
 * 
 * 完整的消息路由解决方案：
 * - 高性能消息路由器
 * - 灵活的过滤和转换机制
 * - 类型安全的消息构建
 * - 丰富的中间件支持
 * - 性能监控和指标收集
 */

// 核心类型导出
export type {
  RoutePattern,
  RoutableMessage,
  MessageFilter,
  MessageTransformer,
  MessageHandler,
  RouteRule,
  RouteResult,
  RouterConfig,
  RouterMetrics,
  RouterEvents,
  RouterMiddleware,
  MessageBuilder,
  MessageMatcher,
  RouterId,
  FilterId,
  MiddlewareId,
  MessagePriorityLevel,
  RouteHistoryEntry,
  ExtractRouteType,
  HandlerForMessage,
  RouteRuleMap,
} from './types';

// 类型守卫和工厂函数
export {
  MessagePriority,
  isRoutableMessage,
  isRoutePattern,
  createRouterId,
  createFilterId,
  createMiddlewareId,
  RoutePatternSchema,
  RoutableMessageSchema,
  RouteRuleSchema,
} from './types';

// 核心路由器
export {
  MessageRouter,
  RouterFactory,
} from './router';

// 消息匹配器
export {
  AdvancedMessageMatcher,
  defaultMessageMatcher,
  builtInMatchers,
} from './matcher';

// 消息构建器和工厂
export {
  RoutableMessageBuilder,
  RouteRuleBuilder,
  MessageFactory,
  RouteRuleFactory,
} from './builders';

// 过滤器和中间件
export {
  ContentFilters,
  PriorityFilters,
  TimeFilters,
  RoleFilters,
  CompositeFilters,
  MessageTransformers,
  RouterMiddlewares,
} from './filters';

/**
 * 消息路由系统管理器
 * 提供统一的API来管理多个路由器实例
 */
export class MessageRoutingSystem {
  private routers = new Map<RouterId, MessageRouter>();
  private defaultRouter?: MessageRouter;

  /**
   * 创建并注册路由器
   */
  createRouter(config?: Partial<RouterConfig>): MessageRouter {
    const router = new MessageRouter(config);
    this.routers.set(router.getConfig().id, router);

    if (!this.defaultRouter) {
      this.defaultRouter = router;
    }

    return router;
  }

  /**
   * 获取路由器
   */
  getRouter(id: RouterId): MessageRouter | undefined {
    return this.routers.get(id);
  }

  /**
   * 获取默认路由器
   */
  getDefaultRouter(): MessageRouter | undefined {
    return this.defaultRouter;
  }

  /**
   * 设置默认路由器
   */
  setDefaultRouter(id: RouterId): boolean {
    const router = this.routers.get(id);
    if (router) {
      this.defaultRouter = router;
      return true;
    }
    return false;
  }

  /**
   * 移除路由器
   */
  removeRouter(id: RouterId): boolean {
    const router = this.routers.get(id);
    if (router) {
      router.stop();
      this.routers.delete(id);
      
      if (this.defaultRouter === router) {
        this.defaultRouter = this.routers.values().next().value;
      }
      
      return true;
    }
    return false;
  }

  /**
   * 启动所有路由器
   */
  startAll(): void {
    for (const router of this.routers.values()) {
      router.start();
    }
  }

  /**
   * 停止所有路由器
   */
  stopAll(): void {
    for (const router of this.routers.values()) {
      router.stop();
    }
  }

  /**
   * 获取系统统计信息
   */
  getSystemStats(): {
    totalRouters: number;
    activeRouters: number;
    totalMessages: number;
    totalRules: number;
  } {
    let activeRouters = 0;
    let totalMessages = 0;
    let totalRules = 0;

    for (const router of this.routers.values()) {
      if (router.isRunning()) {
        activeRouters++;
      }
      
      const metrics = router.getMetrics();
      totalMessages += metrics.totalMessages;
      totalRules += metrics.activeRules;
    }

    return {
      totalRouters: this.routers.size,
      activeRouters,
      totalMessages,
      totalRules,
    };
  }

  /**
   * 路由消息到默认路由器
   */
  async route(message: RoutableMessage): Promise<RouteResult> {
    if (!this.defaultRouter) {
      throw new Error('No default router configured');
    }
    
    return this.defaultRouter.route(message);
  }

  /**
   * 路由消息到指定路由器
   */
  async routeToRouter(routerId: RouterId, message: RoutableMessage): Promise<RouteResult> {
    const router = this.routers.get(routerId);
    if (!router) {
      throw new Error(`Router not found: ${routerId}`);
    }
    
    return router.route(message);
  }

  /**
   * 广播消息到所有路由器
   */
  async broadcast(message: RoutableMessage): Promise<RouteResult[]> {
    const results: RouteResult[] = [];
    
    for (const router of this.routers.values()) {
      if (router.isRunning()) {
        try {
          const result = await router.route(message);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            message,
            handlerCount: 0,
            duration: 0,
            error: error as Error,
          });
        }
      }
    }
    
    return results;
  }
}

/**
 * 默认消息路由系统实例
 */
export const defaultRoutingSystem = new MessageRoutingSystem();

/**
 * 便捷函数：创建标准路由器
 */
export function createMessageRouter(config?: Partial<RouterConfig>): MessageRouter {
  return new MessageRouter(config);
}

/**
 * 便捷函数：创建高性能路由器
 */
export function createHighPerformanceRouter(config?: Partial<RouterConfig>): MessageRouter {
  return new MessageRouter({
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
 * 便捷函数：创建调试路由器
 */
export function createDebugRouter(config?: Partial<RouterConfig>): MessageRouter {
  return new MessageRouter({
    debug: true,
    maxConcurrency: 1,
    messageTimeout: 60000,
    enableMetrics: true,
    ...config,
  });
}

/**
 * 便捷函数：创建用户消息
 */
export function createUserMessage(content: string, options?: {
  priority?: MessagePriorityLevel;
  tags?: string[];
  metadata?: any;
}): RoutableMessage {
  return MessageFactory.createUserMessage(content, options);
}

/**
 * 便捷函数：创建系统消息
 */
export function createSystemMessage(content: string, options?: {
  priority?: MessagePriorityLevel;
  tags?: string[];
  metadata?: any;
}): RoutableMessage {
  return MessageFactory.createSystemMessage(content, options);
}

/**
 * 便捷函数：创建任务消息
 */
export function createTaskMessage(content: string, taskType: string, options?: {
  priority?: MessagePriorityLevel;
  assignee?: string;
  deadline?: Date;
  metadata?: any;
}): RoutableMessage {
  return MessageFactory.createTaskMessage(content, taskType, options);
}

/**
 * 消息路由工具类
 */
export class MessageRoutingUtils {
  /**
   * 验证路由模式
   */
  static validatePattern(pattern: string): boolean {
    return isRoutePattern(pattern);
  }

  /**
   * 解析路由模式
   */
  static parsePattern(pattern: RoutePattern): { type: string; value: string } {
    if (pattern === '*') {
      return { type: 'wildcard', value: '*' };
    }

    const colonIndex = pattern.indexOf(':');
    if (colonIndex === -1) {
      return { type: 'unknown', value: pattern };
    }

    return {
      type: pattern.substring(0, colonIndex),
      value: pattern.substring(colonIndex + 1),
    };
  }

  /**
   * 创建复合过滤器
   */
  static createCompositeFilter(
    operator: 'and' | 'or' | 'not',
    ...filters: MessageFilter[]
  ): MessageFilter {
    switch (operator) {
      case 'and':
        return CompositeFilters.and(...filters);
      case 'or':
        return CompositeFilters.or(...filters);
      case 'not':
        if (filters.length !== 1) {
          throw new Error('NOT operator requires exactly one filter');
        }
        return CompositeFilters.not(filters[0]);
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * 创建性能监控中间件
   */
  static createPerformanceMiddleware(options?: {
    slowThreshold?: number;
    enableMetrics?: boolean;
  }): RouterMiddleware {
    return RouterMiddlewares.performance(options);
  }

  /**
   * 创建日志中间件
   */
  static createLoggingMiddleware(options?: {
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    includeContent?: boolean;
  }): RouterMiddleware {
    return RouterMiddlewares.logging(options);
  }

  /**
   * 分析消息路由性能
   */
  static analyzeRouterPerformance(router: MessageRouter): {
    metrics: RouterMetrics;
    recommendations: string[];
  } {
    const metrics = router.getMetrics();
    const recommendations: string[] = [];

    // 分析平均处理时间
    if (metrics.averageProcessingTime > 1000) {
      recommendations.push('Consider optimizing message handlers - average processing time is high');
    }

    // 分析失败率
    const failureRate = metrics.totalMessages > 0 
      ? metrics.failedMessages / metrics.totalMessages 
      : 0;
    
    if (failureRate > 0.1) {
      recommendations.push('High failure rate detected - review error handling and message validation');
    }

    // 分析过滤率
    const filterRate = metrics.totalMessages > 0 
      ? metrics.filteredMessages / metrics.totalMessages 
      : 0;
    
    if (filterRate > 0.5) {
      recommendations.push('High filter rate - consider optimizing filter conditions');
    }

    // 分析规则数量
    if (metrics.activeRules > 100) {
      recommendations.push('Large number of active rules - consider rule consolidation');
    }

    return { metrics, recommendations };
  }
}
