/**
 * TypeScript原生消息过滤器和中间件实现
 * 
 * 提供丰富的预定义过滤器和中间件：
 * - 内容过滤器
 * - 优先级过滤器
 * - 时间过滤器
 * - 自定义过滤器
 * - 性能监控中间件
 */

import { logger } from '../utils/logger';
import type { 
  RoutableMessage, 
  MessageFilter, 
  MessageTransformer,
  RouterMiddleware,
  RouteResult,
  MessagePriorityLevel,
} from './types';
import { MessagePriority } from './types';

/**
 * 内容过滤器
 */
export class ContentFilters {
  /**
   * 内容长度过滤器
   */
  static minLength(minLength: number): MessageFilter {
    return (message: RoutableMessage) => {
      return message.content.length >= minLength;
    };
  }

  static maxLength(maxLength: number): MessageFilter {
    return (message: RoutableMessage) => {
      return message.content.length <= maxLength;
    };
  }

  /**
   * 关键词过滤器
   */
  static containsKeywords(keywords: string[], options: {
    caseSensitive?: boolean;
    matchAll?: boolean;
  } = {}): MessageFilter {
    const { caseSensitive = false, matchAll = false } = options;
    
    return (message: RoutableMessage) => {
      const content = caseSensitive ? message.content : message.content.toLowerCase();
      const normalizedKeywords = caseSensitive ? keywords : keywords.map(k => k.toLowerCase());
      
      if (matchAll) {
        return normalizedKeywords.every(keyword => content.includes(keyword));
      } else {
        return normalizedKeywords.some(keyword => content.includes(keyword));
      }
    };
  }

  /**
   * 正则表达式过滤器
   */
  static matchesRegex(pattern: RegExp): MessageFilter {
    return (message: RoutableMessage) => {
      return pattern.test(message.content);
    };
  }

  /**
   * 禁用词过滤器
   */
  static excludeWords(bannedWords: string[], options: {
    caseSensitive?: boolean;
  } = {}): MessageFilter {
    const { caseSensitive = false } = options;
    
    return (message: RoutableMessage) => {
      const content = caseSensitive ? message.content : message.content.toLowerCase();
      const normalizedBannedWords = caseSensitive ? bannedWords : bannedWords.map(w => w.toLowerCase());
      
      return !normalizedBannedWords.some(word => content.includes(word));
    };
  }

  /**
   * 语言检测过滤器
   */
  static isLanguage(expectedLanguages: string[]): MessageFilter {
    return (message: RoutableMessage) => {
      // 简单的语言检测逻辑（可以集成更复杂的语言检测库）
      const content = message.content.toLowerCase();
      
      // 基于常见词汇的简单检测
      const languagePatterns = {
        en: /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/g,
        zh: /[\u4e00-\u9fff]/g,
        ja: /[\u3040-\u309f\u30a0-\u30ff]/g,
        ko: /[\uac00-\ud7af]/g,
      };
      
      for (const lang of expectedLanguages) {
        const pattern = languagePatterns[lang as keyof typeof languagePatterns];
        if (pattern && pattern.test(content)) {
          return true;
        }
      }
      
      return false;
    };
  }
}

/**
 * 优先级过滤器
 */
export class PriorityFilters {
  /**
   * 最小优先级过滤器
   */
  static minPriority(minPriority: MessagePriorityLevel): MessageFilter {
    return (message: RoutableMessage) => {
      return message.priority >= minPriority;
    };
  }

  /**
   * 最大优先级过滤器
   */
  static maxPriority(maxPriority: MessagePriorityLevel): MessageFilter {
    return (message: RoutableMessage) => {
      return message.priority <= maxPriority;
    };
  }

  /**
   * 优先级范围过滤器
   */
  static priorityRange(minPriority: MessagePriorityLevel, maxPriority: MessagePriorityLevel): MessageFilter {
    return (message: RoutableMessage) => {
      return message.priority >= minPriority && message.priority <= maxPriority;
    };
  }

  /**
   * 仅关键消息过滤器
   */
  static criticalOnly(): MessageFilter {
    return PriorityFilters.minPriority(MessagePriority.CRITICAL);
  }

  /**
   * 排除低优先级消息过滤器
   */
  static excludeLowPriority(): MessageFilter {
    return (message: RoutableMessage) => {
      return message.priority > MessagePriority.LOW;
    };
  }
}

/**
 * 时间过滤器
 */
export class TimeFilters {
  /**
   * 消息年龄过滤器
   */
  static maxAge(maxAgeMs: number): MessageFilter {
    return (message: RoutableMessage) => {
      const messageTime = new Date(message.timestamp).getTime();
      const now = Date.now();
      return (now - messageTime) <= maxAgeMs;
    };
  }

  /**
   * 工作时间过滤器
   */
  static workingHours(startHour: number = 9, endHour: number = 17): MessageFilter {
    return (message: RoutableMessage) => {
      const messageTime = new Date(message.timestamp);
      const hour = messageTime.getHours();
      return hour >= startHour && hour <= endHour;
    };
  }

  /**
   * 工作日过滤器
   */
  static weekdaysOnly(): MessageFilter {
    return (message: RoutableMessage) => {
      const messageTime = new Date(message.timestamp);
      const dayOfWeek = messageTime.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    };
  }

  /**
   * 时间范围过滤器
   */
  static timeRange(startTime: Date, endTime: Date): MessageFilter {
    return (message: RoutableMessage) => {
      const messageTime = new Date(message.timestamp);
      return messageTime >= startTime && messageTime <= endTime;
    };
  }

  /**
   * 过期消息过滤器
   */
  static notExpired(): MessageFilter {
    return (message: RoutableMessage) => {
      if (!message.expiresAt) {
        return true; // 没有过期时间的消息不会过期
      }
      return new Date() < message.expiresAt;
    };
  }
}

/**
 * 角色和路由过滤器
 */
export class RoleFilters {
  /**
   * 特定角色过滤器
   */
  static fromRole(roles: string | string[]): MessageFilter {
    const roleSet = new Set(Array.isArray(roles) ? roles : [roles]);
    
    return (message: RoutableMessage) => {
      return roleSet.has(message.role);
    };
  }

  /**
   * 排除角色过滤器
   */
  static excludeRoles(roles: string | string[]): MessageFilter {
    const roleSet = new Set(Array.isArray(roles) ? roles : [roles]);
    
    return (message: RoutableMessage) => {
      return !roleSet.has(message.role);
    };
  }

  /**
   * 标签过滤器
   */
  static hasTag(tag: string): MessageFilter {
    return (message: RoutableMessage) => {
      return message.routingTags.has(tag);
    };
  }

  /**
   * 多标签过滤器
   */
  static hasTags(tags: string[], options: {
    matchAll?: boolean;
  } = {}): MessageFilter {
    const { matchAll = false } = options;
    
    return (message: RoutableMessage) => {
      if (matchAll) {
        return tags.every(tag => message.routingTags.has(tag));
      } else {
        return tags.some(tag => message.routingTags.has(tag));
      }
    };
  }

  /**
   * 消息类型过滤器
   */
  static messageType(types: string | string[]): MessageFilter {
    const typeSet = new Set(Array.isArray(types) ? types : [types]);
    
    return (message: RoutableMessage) => {
      return typeSet.has(message.messageType);
    };
  }
}

/**
 * 复合过滤器
 */
export class CompositeFilters {
  /**
   * AND过滤器
   */
  static and(...filters: MessageFilter[]): MessageFilter {
    return async (message: RoutableMessage) => {
      for (const filter of filters) {
        const result = await filter(message);
        if (!result) {
          return false;
        }
      }
      return true;
    };
  }

  /**
   * OR过滤器
   */
  static or(...filters: MessageFilter[]): MessageFilter {
    return async (message: RoutableMessage) => {
      for (const filter of filters) {
        const result = await filter(message);
        if (result) {
          return true;
        }
      }
      return false;
    };
  }

  /**
   * NOT过滤器
   */
  static not(filter: MessageFilter): MessageFilter {
    return async (message: RoutableMessage) => {
      const result = await filter(message);
      return !result;
    };
  }

  /**
   * 条件过滤器
   */
  static conditional(
    condition: MessageFilter,
    trueFilter: MessageFilter,
    falseFilter?: MessageFilter
  ): MessageFilter {
    return async (message: RoutableMessage) => {
      const conditionResult = await condition(message);
      if (conditionResult) {
        return await trueFilter(message);
      } else if (falseFilter) {
        return await falseFilter(message);
      }
      return true;
    };
  }
}

/**
 * 消息转换器
 */
export class MessageTransformers {
  /**
   * 添加标签转换器
   */
  static addTag(tag: string): MessageTransformer {
    return (message: RoutableMessage) => {
      const transformed = { ...message };
      transformed.routingTags = new Set(message.routingTags);
      transformed.routingTags.add(tag);
      return transformed;
    };
  }

  /**
   * 移除标签转换器
   */
  static removeTag(tag: string): MessageTransformer {
    return (message: RoutableMessage) => {
      const transformed = { ...message };
      transformed.routingTags = new Set(message.routingTags);
      transformed.routingTags.delete(tag);
      return transformed;
    };
  }

  /**
   * 设置优先级转换器
   */
  static setPriority(priority: MessagePriorityLevel): MessageTransformer {
    return (message: RoutableMessage) => {
      return { ...message, priority };
    };
  }

  /**
   * 内容转换器
   */
  static transformContent(transformer: (content: string) => string): MessageTransformer {
    return (message: RoutableMessage) => {
      return { ...message, content: transformer(message.content) };
    };
  }

  /**
   * 元数据转换器
   */
  static addMetadata(metadata: Record<string, any>): MessageTransformer {
    return (message: RoutableMessage) => {
      return {
        ...message,
        metadata: { ...message.metadata, ...metadata },
      };
    };
  }
}

/**
 * 路由中间件
 */
export class RouterMiddlewares {
  /**
   * 日志中间件
   */
  static logging(options: {
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    includeContent?: boolean;
  } = {}): RouterMiddleware {
    const { logLevel = 'info', includeContent = false } = options;
    
    return async (message, next) => {
      const startTime = Date.now();
      
      logger[logLevel](`[Router] Processing message ${message.id}`, {
        messageType: message.messageType,
        role: message.role,
        priority: message.priority,
        content: includeContent ? message.content : '[hidden]',
      });
      
      try {
        const result = await next(message);
        const duration = Date.now() - startTime;
        
        logger[logLevel](`[Router] Completed message ${message.id} in ${duration}ms`, {
          success: result.success,
          handlerCount: result.handlerCount,
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`[Router] Failed to process message ${message.id} after ${duration}ms:`, error);
        throw error;
      }
    };
  }

  /**
   * 性能监控中间件
   */
  static performance(options: {
    slowThreshold?: number;
    enableMetrics?: boolean;
  } = {}): RouterMiddleware {
    const { slowThreshold = 1000, enableMetrics = true } = options;
    const metrics = new Map<string, { count: number; totalTime: number; maxTime: number }>();
    
    return async (message, next) => {
      const startTime = Date.now();
      
      try {
        const result = await next(message);
        const duration = Date.now() - startTime;
        
        // 记录性能指标
        if (enableMetrics) {
          const key = `${message.messageType}:${message.role}`;
          const existing = metrics.get(key) || { count: 0, totalTime: 0, maxTime: 0 };
          metrics.set(key, {
            count: existing.count + 1,
            totalTime: existing.totalTime + duration,
            maxTime: Math.max(existing.maxTime, duration),
          });
        }
        
        // 警告慢处理
        if (duration > slowThreshold) {
          logger.warn(`[Router] Slow message processing detected: ${message.id} took ${duration}ms`);
        }
        
        return { ...result, duration };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`[Router] Performance middleware error after ${duration}ms:`, error);
        throw error;
      }
    };
  }

  /**
   * 重试中间件
   */
  static retry(options: {
    maxRetries?: number;
    retryDelay?: number;
    retryCondition?: (error: Error) => boolean;
  } = {}): RouterMiddleware {
    const { maxRetries = 3, retryDelay = 1000, retryCondition = () => true } = options;
    
    return async (message, next) => {
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await next(message);
        } catch (error) {
          lastError = error as Error;
          
          if (attempt === maxRetries || !retryCondition(lastError)) {
            break;
          }
          
          logger.warn(`[Router] Retry attempt ${attempt + 1}/${maxRetries} for message ${message.id}:`, error);
          
          // 等待重试延迟
          if (retryDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }
      
      throw lastError;
    };
  }

  /**
   * 限流中间件
   */
  static rateLimit(options: {
    maxRequests: number;
    windowMs: number;
    keyGenerator?: (message: RoutableMessage) => string;
  }): RouterMiddleware {
    const { maxRequests, windowMs, keyGenerator = (msg) => msg.role } = options;
    const requests = new Map<string, number[]>();
    
    return async (message, next) => {
      const key = keyGenerator(message);
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // 获取当前窗口内的请求
      const currentRequests = requests.get(key) || [];
      const validRequests = currentRequests.filter(time => time > windowStart);
      
      // 检查是否超过限制
      if (validRequests.length >= maxRequests) {
        throw new Error(`Rate limit exceeded for key: ${key}`);
      }
      
      // 记录当前请求
      validRequests.push(now);
      requests.set(key, validRequests);
      
      return await next(message);
    };
  }
}
