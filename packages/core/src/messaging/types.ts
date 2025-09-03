/**
 * TypeScript原生消息路由系统类型定义
 * 
 * 充分利用TypeScript高级类型特性：
 * - 模板字面量类型和条件类型
 * - 品牌类型和类型守卫
 * - 映射类型和工具类型
 * - 泛型约束和类型推导
 */

import { z } from 'zod';
import type { Message } from '../types/message';

/**
 * 路由模式类型
 * 使用模板字面量类型定义路由模式
 */
export type RoutePattern = 
  | '*'                           // 匹配所有
  | `role:${string}`             // 角色路由：role:ProductManager
  | `action:${string}`           // 动作路由：action:WritePRD
  | `topic:${string}`            // 主题路由：topic:requirements
  | `priority:${string}`         // 优先级路由：priority:high
  | `regex:${string}`            // 正则表达式路由：regex:^user.*
  | `custom:${string}`;          // 自定义路由：custom:myPattern

/**
 * 消息优先级枚举
 */
export const MessagePriority = {
  CRITICAL: 1000,
  HIGH: 800,
  NORMAL: 500,
  LOW: 200,
  BACKGROUND: 100,
} as const;

export type MessagePriorityLevel = typeof MessagePriority[keyof typeof MessagePriority];

/**
 * 路由器ID品牌类型
 */
export type RouterId<T extends string = string> = T & { readonly __brand: 'RouterId' };

/**
 * 过滤器ID品牌类型
 */
export type FilterId<T extends string = string> = T & { readonly __brand: 'FilterId' };

/**
 * 中间件ID品牌类型
 */
export type MiddlewareId<T extends string = string> = T & { readonly __brand: 'MiddlewareId' };

/**
 * 增强的消息接口
 * 扩展基础Message类型，添加路由相关信息
 */
export interface RoutableMessage extends Message {
  /** 消息优先级 */
  priority: MessagePriorityLevel;
  /** 路由标签 */
  routingTags: Set<string>;
  /** 消息类型 */
  messageType: string;
  /** 路由历史 */
  routingHistory: RouteHistoryEntry[];
  /** 过期时间 */
  expiresAt?: Date;
  /** 重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
}

/**
 * 路由历史条目
 */
export interface RouteHistoryEntry {
  /** 路由器ID */
  routerId: RouterId;
  /** 时间戳 */
  timestamp: Date;
  /** 路由动作 */
  action: 'routed' | 'filtered' | 'transformed' | 'failed';
  /** 详细信息 */
  details?: string;
}

/**
 * 消息过滤器函数类型
 */
export type MessageFilter<T extends RoutableMessage = RoutableMessage> = (
  message: T
) => boolean | Promise<boolean>;

/**
 * 消息转换器函数类型
 */
export type MessageTransformer<
  TInput extends RoutableMessage = RoutableMessage,
  TOutput extends RoutableMessage = RoutableMessage
> = (message: TInput) => TOutput | Promise<TOutput>;

/**
 * 消息处理器函数类型
 */
export type MessageHandler<T extends RoutableMessage = RoutableMessage> = (
  message: T
) => void | Promise<void>;

/**
 * 路由结果类型
 */
export interface RouteResult<T extends RoutableMessage = RoutableMessage> {
  /** 是否成功 */
  success: boolean;
  /** 处理的消息 */
  message: T;
  /** 匹配的路由模式 */
  matchedPattern?: RoutePattern;
  /** 执行的处理器数量 */
  handlerCount: number;
  /** 处理耗时 */
  duration: number;
  /** 错误信息 */
  error?: Error;
}

/**
 * 路由规则配置
 */
export interface RouteRule<T extends RoutableMessage = RoutableMessage> {
  /** 规则ID */
  id: string;
  /** 路由模式 */
  pattern: RoutePattern;
  /** 过滤器 */
  filters: MessageFilter<T>[];
  /** 转换器 */
  transformers: MessageTransformer<T, T>[];
  /** 处理器 */
  handlers: MessageHandler<T>[];
  /** 优先级 */
  priority: number;
  /** 是否启用 */
  enabled: boolean;
  /** 描述 */
  description?: string;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 中间件函数类型
 */
export type RouterMiddleware<T extends RoutableMessage = RoutableMessage> = (
  message: T,
  next: (message: T) => Promise<RouteResult<T>>
) => Promise<RouteResult<T>>;

/**
 * 路由器配置
 */
export interface RouterConfig {
  /** 路由器ID */
  id: RouterId;
  /** 路由器名称 */
  name: string;
  /** 是否启用调试 */
  debug: boolean;
  /** 最大并发处理数 */
  maxConcurrency: number;
  /** 消息超时时间 */
  messageTimeout: number;
  /** 是否启用指标收集 */
  enableMetrics: boolean;
  /** 死信队列配置 */
  deadLetterQueue?: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };
}

/**
 * 路由器指标
 */
export interface RouterMetrics {
  /** 处理的消息总数 */
  totalMessages: number;
  /** 成功处理的消息数 */
  successfulMessages: number;
  /** 失败的消息数 */
  failedMessages: number;
  /** 过滤掉的消息数 */
  filteredMessages: number;
  /** 平均处理时间 */
  averageProcessingTime: number;
  /** 当前队列大小 */
  currentQueueSize: number;
  /** 活跃的路由规则数 */
  activeRules: number;
  /** 最后更新时间 */
  lastUpdated: Date;
}

/**
 * 消息匹配器接口
 */
export interface MessageMatcher {
  /** 匹配消息 */
  match(pattern: RoutePattern, message: RoutableMessage): boolean;
  /** 添加自定义匹配器 */
  addCustomMatcher(name: string, matcher: (pattern: string, message: RoutableMessage) => boolean): void;
}

/**
 * 路由事件类型
 */
export interface RouterEvents<T extends RoutableMessage = RoutableMessage> {
  'message:received': (message: T) => void;
  'message:routed': (result: RouteResult<T>) => void;
  'message:filtered': (message: T, filterId: FilterId) => void;
  'message:transformed': (original: T, transformed: T) => void;
  'message:failed': (message: T, error: Error) => void;
  'rule:added': (rule: RouteRule<T>) => void;
  'rule:removed': (ruleId: string) => void;
  'rule:updated': (rule: RouteRule<T>) => void;
  'metrics:updated': (metrics: RouterMetrics) => void;
}

/**
 * 条件类型：根据消息类型推导处理器类型
 */
export type HandlerForMessage<T> = T extends RoutableMessage 
  ? MessageHandler<T>
  : never;

/**
 * 映射类型：路由规则映射
 */
export type RouteRuleMap<T extends RoutableMessage = RoutableMessage> = {
  [K in string]: RouteRule<T>;
};

/**
 * 工具类型：提取路由模式类型
 */
export type ExtractRouteType<T extends RoutePattern> = 
  T extends `${infer Type}:${string}` ? Type : 'wildcard';

/**
 * 类型守卫：检查是否为可路由消息
 */
export function isRoutableMessage(message: any): message is RoutableMessage {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.id === 'string' &&
    typeof message.content === 'string' &&
    typeof message.priority === 'number' &&
    message.routingTags instanceof Set &&
    Array.isArray(message.routingHistory)
  );
}

/**
 * 类型守卫：检查路由模式类型
 */
export function isRoutePattern(pattern: string): pattern is RoutePattern {
  const validPatterns = [
    /^\*$/,                           // *
    /^role:.+$/,                      // role:xxx
    /^action:.+$/,                    // action:xxx
    /^topic:.+$/,                     // topic:xxx
    /^priority:.+$/,                  // priority:xxx
    /^regex:.+$/,                     // regex:xxx
    /^custom:.+$/,                    // custom:xxx
  ];
  
  return validPatterns.some(regex => regex.test(pattern));
}

/**
 * 工厂函数：创建路由器ID
 */
export function createRouterId<T extends string>(id: T): RouterId<T> {
  return id as RouterId<T>;
}

/**
 * 工厂函数：创建过滤器ID
 */
export function createFilterId<T extends string>(id: T): FilterId<T> {
  return id as FilterId<T>;
}

/**
 * 工厂函数：创建中间件ID
 */
export function createMiddlewareId<T extends string>(id: T): MiddlewareId<T> {
  return id as MiddlewareId<T>;
}

/**
 * 消息构建器类型
 */
export interface MessageBuilder<T extends RoutableMessage = RoutableMessage> {
  /** 设置内容 */
  content(content: string): this;
  /** 设置优先级 */
  priority(priority: MessagePriorityLevel): this;
  /** 添加路由标签 */
  addTag(tag: string): this;
  /** 设置消息类型 */
  messageType(type: string): this;
  /** 设置过期时间 */
  expiresAt(date: Date): this;
  /** 构建消息 */
  build(): T;
}

/**
 * Zod schemas for validation
 */
export const RoutePatternSchema = z.union([
  z.literal('*'),
  z.string().regex(/^role:.+$/),
  z.string().regex(/^action:.+$/),
  z.string().regex(/^topic:.+$/),
  z.string().regex(/^priority:.+$/),
  z.string().regex(/^regex:.+$/),
  z.string().regex(/^custom:.+$/),
]);

export const RoutableMessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  role: z.string(),
  causedBy: z.string(),
  sentFrom: z.string(),
  sendTo: z.instanceof(Set),
  timestamp: z.string(),
  priority: z.number(),
  routingTags: z.instanceof(Set),
  messageType: z.string(),
  routingHistory: z.array(z.object({
    routerId: z.string(),
    timestamp: z.date(),
    action: z.enum(['routed', 'filtered', 'transformed', 'failed']),
    details: z.string().optional(),
  })),
  expiresAt: z.date().optional(),
  retryCount: z.number(),
  maxRetries: z.number(),
  metadata: z.any().optional(),
  instructContent: z.any().optional(),
});

export const RouteRuleSchema = z.object({
  id: z.string(),
  pattern: RoutePatternSchema,
  priority: z.number(),
  enabled: z.boolean(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});
