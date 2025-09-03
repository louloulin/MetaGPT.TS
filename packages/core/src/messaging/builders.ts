/**
 * TypeScript原生消息构建器和工厂实现
 * 
 * 提供流畅的API来构建和配置消息：
 * - 类型安全的消息构建
 * - 链式调用API
 * - 预定义的消息模板
 * - 验证和转换功能
 */

import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../types/message';
import type { 
  RoutableMessage, 
  MessageBuilder, 
  MessagePriorityLevel,
  RouteRule,
  MessageFilter,
  MessageTransformer,
  MessageHandler,
  RoutePattern,
} from './types';
import { MessagePriority, RoutableMessageSchema } from './types';

/**
 * 可路由消息构建器实现
 */
export class RoutableMessageBuilder implements MessageBuilder<RoutableMessage> {
  private message: Partial<RoutableMessage> = {
    id: uuidv4(),
    routingTags: new Set(),
    routingHistory: [],
    retryCount: 0,
    maxRetries: 3,
    priority: MessagePriority.NORMAL,
    timestamp: new Date().toISOString(),
    role: 'user',
    causedBy: 'UserRequirement',
    sentFrom: '',
    sendTo: new Set(['*']),
  };

  /**
   * 设置消息内容
   */
  content(content: string): this {
    this.message.content = content;
    return this;
  }

  /**
   * 设置消息优先级
   */
  priority(priority: MessagePriorityLevel): this {
    this.message.priority = priority;
    return this;
  }

  /**
   * 添加路由标签
   */
  addTag(tag: string): this {
    if (!this.message.routingTags) {
      this.message.routingTags = new Set();
    }
    this.message.routingTags.add(tag);
    return this;
  }

  /**
   * 添加多个路由标签
   */
  addTags(tags: string[]): this {
    tags.forEach(tag => this.addTag(tag));
    return this;
  }

  /**
   * 设置消息类型
   */
  messageType(type: string): this {
    this.message.messageType = type;
    return this;
  }

  /**
   * 设置过期时间
   */
  expiresAt(date: Date): this {
    this.message.expiresAt = date;
    return this;
  }

  /**
   * 设置角色
   */
  role(role: string): this {
    this.message.role = role;
    return this;
  }

  /**
   * 设置发送者
   */
  from(sender: string): this {
    this.message.sentFrom = sender;
    return this;
  }

  /**
   * 设置接收者
   */
  to(recipients: string | string[]): this {
    if (typeof recipients === 'string') {
      this.message.sendTo = new Set([recipients]);
    } else {
      this.message.sendTo = new Set(recipients);
    }
    return this;
  }

  /**
   * 设置触发原因
   */
  causedBy(cause: string): this {
    this.message.causedBy = cause;
    return this;
  }

  /**
   * 设置最大重试次数
   */
  maxRetries(count: number): this {
    this.message.maxRetries = count;
    return this;
  }

  /**
   * 设置指令内容
   */
  instructContent(content: any): this {
    this.message.instructContent = content;
    return this;
  }

  /**
   * 设置元数据
   */
  metadata(metadata: any): this {
    this.message.metadata = metadata;
    return this;
  }

  /**
   * 构建消息
   */
  build(): RoutableMessage {
    // 验证必需字段
    if (!this.message.content) {
      throw new Error('Message content is required');
    }

    if (!this.message.messageType) {
      this.message.messageType = 'general';
    }

    // 使用Zod验证
    const validated = RoutableMessageSchema.parse(this.message);
    
    return validated as RoutableMessage;
  }

  /**
   * 重置构建器
   */
  reset(): this {
    this.message = {
      id: uuidv4(),
      routingTags: new Set(),
      routingHistory: [],
      retryCount: 0,
      maxRetries: 3,
      priority: MessagePriority.NORMAL,
      timestamp: new Date().toISOString(),
      role: 'user',
      causedBy: 'UserRequirement',
      sentFrom: '',
      sendTo: new Set(['*']),
    };
    return this;
  }

  /**
   * 克隆构建器
   */
  clone(): RoutableMessageBuilder {
    const cloned = new RoutableMessageBuilder();
    cloned.message = {
      ...this.message,
      routingTags: new Set(this.message.routingTags),
      sendTo: new Set(this.message.sendTo),
      routingHistory: [...(this.message.routingHistory || [])],
    };
    return cloned;
  }
}

/**
 * 路由规则构建器
 */
export class RouteRuleBuilder<T extends RoutableMessage = RoutableMessage> {
  private rule: Partial<RouteRule<T>> = {
    filters: [],
    transformers: [],
    handlers: [],
    priority: 100,
    enabled: true,
  };

  /**
   * 设置规则ID
   */
  id(id: string): this {
    this.rule.id = id;
    return this;
  }

  /**
   * 设置路由模式
   */
  pattern(pattern: RoutePattern): this {
    this.rule.pattern = pattern;
    return this;
  }

  /**
   * 添加过滤器
   */
  filter(filter: MessageFilter<T>): this {
    if (!this.rule.filters) {
      this.rule.filters = [];
    }
    this.rule.filters.push(filter);
    return this;
  }

  /**
   * 添加转换器
   */
  transform(transformer: MessageTransformer<T, T>): this {
    if (!this.rule.transformers) {
      this.rule.transformers = [];
    }
    this.rule.transformers.push(transformer);
    return this;
  }

  /**
   * 添加处理器
   */
  handle(handler: MessageHandler<T>): this {
    if (!this.rule.handlers) {
      this.rule.handlers = [];
    }
    this.rule.handlers.push(handler);
    return this;
  }

  /**
   * 设置优先级
   */
  priority(priority: number): this {
    this.rule.priority = priority;
    return this;
  }

  /**
   * 设置是否启用
   */
  enabled(enabled: boolean): this {
    this.rule.enabled = enabled;
    return this;
  }

  /**
   * 设置描述
   */
  description(description: string): this {
    this.rule.description = description;
    return this;
  }

  /**
   * 设置元数据
   */
  metadata(metadata: Record<string, any>): this {
    this.rule.metadata = metadata;
    return this;
  }

  /**
   * 构建路由规则
   */
  build(): RouteRule<T> {
    if (!this.rule.id) {
      throw new Error('Rule ID is required');
    }

    if (!this.rule.pattern) {
      throw new Error('Route pattern is required');
    }

    return this.rule as RouteRule<T>;
  }
}

/**
 * 消息工厂类
 */
export class MessageFactory {
  /**
   * 创建用户消息
   */
  static createUserMessage(content: string, options: {
    priority?: MessagePriorityLevel;
    tags?: string[];
    metadata?: any;
  } = {}): RoutableMessage {
    return new RoutableMessageBuilder()
      .content(content)
      .role('user')
      .messageType('user_input')
      .priority(options.priority || MessagePriority.NORMAL)
      .addTags(options.tags || [])
      .metadata(options.metadata)
      .build();
  }

  /**
   * 创建系统消息
   */
  static createSystemMessage(content: string, options: {
    priority?: MessagePriorityLevel;
    tags?: string[];
    metadata?: any;
  } = {}): RoutableMessage {
    return new RoutableMessageBuilder()
      .content(content)
      .role('system')
      .messageType('system_notification')
      .priority(options.priority || MessagePriority.HIGH)
      .addTags(options.tags || [])
      .metadata(options.metadata)
      .build();
  }

  /**
   * 创建AI助手消息
   */
  static createAssistantMessage(content: string, options: {
    priority?: MessagePriorityLevel;
    tags?: string[];
    metadata?: any;
  } = {}): RoutableMessage {
    return new RoutableMessageBuilder()
      .content(content)
      .role('assistant')
      .messageType('ai_response')
      .priority(options.priority || MessagePriority.NORMAL)
      .addTags(options.tags || [])
      .metadata(options.metadata)
      .build();
  }

  /**
   * 创建任务消息
   */
  static createTaskMessage(content: string, taskType: string, options: {
    priority?: MessagePriorityLevel;
    assignee?: string;
    deadline?: Date;
    metadata?: any;
  } = {}): RoutableMessage {
    const tags = ['task', taskType];
    if (options.assignee) {
      tags.push(`assignee:${options.assignee}`);
    }

    const builder = new RoutableMessageBuilder()
      .content(content)
      .role('system')
      .messageType('task_assignment')
      .priority(options.priority || MessagePriority.HIGH)
      .addTags(tags)
      .metadata({
        taskType,
        assignee: options.assignee,
        deadline: options.deadline,
        ...options.metadata,
      });

    if (options.assignee) {
      builder.to(options.assignee);
    }

    if (options.deadline) {
      builder.expiresAt(options.deadline);
    }

    return builder.build();
  }

  /**
   * 创建通知消息
   */
  static createNotificationMessage(content: string, notificationType: string, options: {
    priority?: MessagePriorityLevel;
    recipients?: string[];
    urgent?: boolean;
    metadata?: any;
  } = {}): RoutableMessage {
    const tags = ['notification', notificationType];
    if (options.urgent) {
      tags.push('urgent');
    }

    const builder = new RoutableMessageBuilder()
      .content(content)
      .role('system')
      .messageType('notification')
      .priority(options.urgent ? MessagePriority.CRITICAL : (options.priority || MessagePriority.NORMAL))
      .addTags(tags)
      .metadata({
        notificationType,
        urgent: options.urgent,
        ...options.metadata,
      });

    if (options.recipients) {
      builder.to(options.recipients);
    }

    return builder.build();
  }

  /**
   * 从基础消息创建可路由消息
   */
  static fromBaseMessage(baseMessage: Message, options: {
    priority?: MessagePriorityLevel;
    messageType?: string;
    tags?: string[];
    metadata?: any;
  } = {}): RoutableMessage {
    return new RoutableMessageBuilder()
      .content(baseMessage.content)
      .role(baseMessage.role)
      .from(baseMessage.sentFrom)
      .to(Array.from(baseMessage.sendTo))
      .causedBy(baseMessage.causedBy)
      .instructContent(baseMessage.instructContent)
      .messageType(options.messageType || 'converted')
      .priority(options.priority || MessagePriority.NORMAL)
      .addTags(options.tags || [])
      .metadata({
        originalId: baseMessage.id,
        originalTimestamp: baseMessage.timestamp,
        ...baseMessage.metadata,
        ...options.metadata,
      })
      .build();
  }
}

/**
 * 路由规则工厂类
 */
export class RouteRuleFactory {
  /**
   * 创建角色路由规则
   */
  static createRoleRule<T extends RoutableMessage = RoutableMessage>(
    rolePattern: string,
    handler: MessageHandler<T>,
    options: {
      priority?: number;
      description?: string;
    } = {}
  ): RouteRule<T> {
    return new RouteRuleBuilder<T>()
      .id(`role-${rolePattern}-${Date.now()}`)
      .pattern(`role:${rolePattern}` as RoutePattern)
      .handle(handler)
      .priority(options.priority || 100)
      .description(options.description || `Handle messages for role: ${rolePattern}`)
      .build();
  }

  /**
   * 创建优先级路由规则
   */
  static createPriorityRule<T extends RoutableMessage = RoutableMessage>(
    priorityThreshold: number,
    handler: MessageHandler<T>,
    options: {
      operator?: '>=' | '>' | '<=' | '<' | '=';
      priority?: number;
      description?: string;
    } = {}
  ): RouteRule<T> {
    const operator = options.operator || '>=';
    return new RouteRuleBuilder<T>()
      .id(`priority-${operator}${priorityThreshold}-${Date.now()}`)
      .pattern(`priority:${operator}${priorityThreshold}` as RoutePattern)
      .handle(handler)
      .priority(options.priority || 200)
      .description(options.description || `Handle messages with priority ${operator} ${priorityThreshold}`)
      .build();
  }

  /**
   * 创建主题路由规则
   */
  static createTopicRule<T extends RoutableMessage = RoutableMessage>(
    topic: string,
    handler: MessageHandler<T>,
    options: {
      priority?: number;
      description?: string;
    } = {}
  ): RouteRule<T> {
    return new RouteRuleBuilder<T>()
      .id(`topic-${topic}-${Date.now()}`)
      .pattern(`topic:${topic}` as RoutePattern)
      .handle(handler)
      .priority(options.priority || 100)
      .description(options.description || `Handle messages for topic: ${topic}`)
      .build();
  }
}
