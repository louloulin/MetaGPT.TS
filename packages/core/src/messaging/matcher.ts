/**
 * TypeScript原生消息匹配器实现
 * 
 * 提供高性能的消息模式匹配功能：
 * - 支持多种路由模式
 * - 可扩展的自定义匹配器
 * - 缓存优化的匹配算法
 * - 类型安全的模式解析
 */

import { logger } from '../utils/logger';
import type { 
  RoutePattern, 
  RoutableMessage, 
  MessageMatcher,
  ExtractRouteType 
} from './types';
import { isRoutePattern } from './types';

/**
 * 自定义匹配器函数类型
 */
type CustomMatcherFunction = (pattern: string, message: RoutableMessage) => boolean;

/**
 * 匹配结果缓存条目
 */
interface MatchCacheEntry {
  result: boolean;
  timestamp: number;
  hitCount: number;
}

/**
 * 高性能消息匹配器实现
 */
export class AdvancedMessageMatcher implements MessageMatcher {
  private customMatchers = new Map<string, CustomMatcherFunction>();
  private matchCache = new Map<string, MatchCacheEntry>();
  private readonly cacheMaxSize: number;
  private readonly cacheTTL: number;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(options: {
    cacheMaxSize?: number;
    cacheTTL?: number;
  } = {}) {
    this.cacheMaxSize = options.cacheMaxSize || 1000;
    this.cacheTTL = options.cacheTTL || 60000; // 1 minute

    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredCache(), this.cacheTTL);
  }

  /**
   * 匹配消息与路由模式
   */
  match(pattern: RoutePattern, message: RoutableMessage): boolean {
    if (!isRoutePattern(pattern)) {
      logger.warn(`Invalid route pattern: ${pattern}`);
      return false;
    }

    // 生成缓存键
    const cacheKey = this.generateCacheKey(pattern, message);
    
    // 检查缓存
    const cached = this.getCachedResult(cacheKey);
    if (cached !== null) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;

    // 执行匹配
    const result = this.performMatch(pattern, message);
    
    // 缓存结果
    this.setCachedResult(cacheKey, result);
    
    return result;
  }

  /**
   * 添加自定义匹配器
   */
  addCustomMatcher(name: string, matcher: CustomMatcherFunction): void {
    this.customMatchers.set(name, matcher);
    logger.debug(`Added custom matcher: ${name}`);
  }

  /**
   * 移除自定义匹配器
   */
  removeCustomMatcher(name: string): boolean {
    const removed = this.customMatchers.delete(name);
    if (removed) {
      logger.debug(`Removed custom matcher: ${name}`);
    }
    return removed;
  }

  /**
   * 获取匹配器统计信息
   */
  getStats(): {
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    cacheSize: number;
    customMatchersCount: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: total > 0 ? this.cacheHits / total : 0,
      cacheSize: this.matchCache.size,
      customMatchersCount: this.customMatchers.size,
    };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.matchCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.debug('Match cache cleared');
  }

  /**
   * 执行实际的模式匹配
   */
  private performMatch(pattern: RoutePattern, message: RoutableMessage): boolean {
    // 通配符匹配
    if (pattern === '*') {
      return true;
    }

    // 解析模式类型和值
    const [type, value] = this.parsePattern(pattern);

    switch (type) {
      case 'role':
        return this.matchRole(value, message);
      
      case 'action':
        return this.matchAction(value, message);
      
      case 'topic':
        return this.matchTopic(value, message);
      
      case 'priority':
        return this.matchPriority(value, message);
      
      case 'regex':
        return this.matchRegex(value, message);
      
      case 'custom':
        return this.matchCustom(value, message);
      
      default:
        logger.warn(`Unknown pattern type: ${type}`);
        return false;
    }
  }

  /**
   * 解析路由模式
   */
  private parsePattern(pattern: RoutePattern): [string, string] {
    if (pattern === '*') {
      return ['wildcard', '*'];
    }

    const colonIndex = pattern.indexOf(':');
    if (colonIndex === -1) {
      return ['unknown', pattern];
    }

    const type = pattern.substring(0, colonIndex);
    const value = pattern.substring(colonIndex + 1);
    
    return [type, value];
  }

  /**
   * 角色匹配
   */
  private matchRole(rolePattern: string, message: RoutableMessage): boolean {
    // 支持通配符和精确匹配
    if (rolePattern === '*') {
      return true;
    }

    // 支持多个角色匹配（用逗号分隔）
    const roles = rolePattern.split(',').map(r => r.trim());
    return roles.includes(message.role);
  }

  /**
   * 动作匹配
   */
  private matchAction(actionPattern: string, message: RoutableMessage): boolean {
    // 从causedBy字段匹配动作
    if (actionPattern === '*') {
      return true;
    }

    // 支持前缀匹配
    if (actionPattern.endsWith('*')) {
      const prefix = actionPattern.slice(0, -1);
      return message.causedBy.startsWith(prefix);
    }

    return message.causedBy === actionPattern;
  }

  /**
   * 主题匹配
   */
  private matchTopic(topicPattern: string, message: RoutableMessage): boolean {
    // 从路由标签中匹配主题
    if (topicPattern === '*') {
      return true;
    }

    // 支持多个主题匹配
    const topics = topicPattern.split(',').map(t => t.trim());
    return topics.some(topic => message.routingTags.has(topic));
  }

  /**
   * 优先级匹配
   */
  private matchPriority(priorityPattern: string, message: RoutableMessage): boolean {
    // 支持比较操作符
    const operators = ['>=', '<=', '>', '<', '='];
    
    for (const op of operators) {
      if (priorityPattern.startsWith(op)) {
        const value = parseInt(priorityPattern.substring(op.length));
        if (isNaN(value)) continue;

        switch (op) {
          case '>=':
            return message.priority >= value;
          case '<=':
            return message.priority <= value;
          case '>':
            return message.priority > value;
          case '<':
            return message.priority < value;
          case '=':
            return message.priority === value;
        }
      }
    }

    // 默认精确匹配
    const value = parseInt(priorityPattern);
    return !isNaN(value) && message.priority === value;
  }

  /**
   * 正则表达式匹配
   */
  private matchRegex(regexPattern: string, message: RoutableMessage): boolean {
    try {
      const regex = new RegExp(regexPattern);
      
      // 对消息内容、角色和causedBy进行匹配
      return (
        regex.test(message.content) ||
        regex.test(message.role) ||
        regex.test(message.causedBy) ||
        regex.test(message.messageType)
      );
    } catch (error) {
      logger.error(`Invalid regex pattern: ${regexPattern}`, error);
      return false;
    }
  }

  /**
   * 自定义匹配器匹配
   */
  private matchCustom(customPattern: string, message: RoutableMessage): boolean {
    // 解析自定义匹配器名称和参数
    const [matcherName, ...params] = customPattern.split(':');
    const matcher = this.customMatchers.get(matcherName);
    
    if (!matcher) {
      logger.warn(`Custom matcher not found: ${matcherName}`);
      return false;
    }

    try {
      return matcher(params.join(':'), message);
    } catch (error) {
      logger.error(`Custom matcher error: ${matcherName}`, error);
      return false;
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(pattern: RoutePattern, message: RoutableMessage): string {
    // 使用模式和消息的关键字段生成缓存键
    return `${pattern}:${message.role}:${message.causedBy}:${message.priority}:${message.messageType}`;
  }

  /**
   * 获取缓存结果
   */
  private getCachedResult(cacheKey: string): boolean | null {
    const entry = this.matchCache.get(cacheKey);
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.matchCache.delete(cacheKey);
      return null;
    }

    // 更新命中次数
    entry.hitCount++;
    return entry.result;
  }

  /**
   * 设置缓存结果
   */
  private setCachedResult(cacheKey: string, result: boolean): void {
    // 检查缓存大小限制
    if (this.matchCache.size >= this.cacheMaxSize) {
      this.evictLeastUsedCache();
    }

    this.matchCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.matchCache) {
      if (now - entry.timestamp > this.cacheTTL) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.matchCache.delete(key));
    
    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * 驱逐最少使用的缓存条目
   */
  private evictLeastUsedCache(): void {
    let leastUsedKey: string | null = null;
    let leastHitCount = Infinity;

    for (const [key, entry] of this.matchCache) {
      if (entry.hitCount < leastHitCount) {
        leastHitCount = entry.hitCount;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.matchCache.delete(leastUsedKey);
      logger.debug(`Evicted least used cache entry: ${leastUsedKey}`);
    }
  }
}

/**
 * 默认消息匹配器实例
 */
export const defaultMessageMatcher = new AdvancedMessageMatcher({
  cacheMaxSize: 1000,
  cacheTTL: 60000,
});

/**
 * 预定义的自定义匹配器
 */
export const builtInMatchers = {
  /**
   * 时间范围匹配器
   * 格式: timeRange:startHour-endHour (24小时制)
   * 例如: custom:timeRange:9-17 (工作时间)
   */
  timeRange: (pattern: string, message: RoutableMessage): boolean => {
    const [startHour, endHour] = pattern.split('-').map(h => parseInt(h));
    if (isNaN(startHour) || isNaN(endHour)) {
      return false;
    }

    const messageTime = new Date(message.timestamp);
    const hour = messageTime.getHours();
    
    return hour >= startHour && hour <= endHour;
  },

  /**
   * 消息长度匹配器
   * 格式: length:operator:value
   * 例如: custom:length:>:100 (内容长度大于100)
   */
  length: (pattern: string, message: RoutableMessage): boolean => {
    const [operator, value] = pattern.split(':');
    const length = message.content.length;
    const targetLength = parseInt(value);
    
    if (isNaN(targetLength)) {
      return false;
    }

    switch (operator) {
      case '>': return length > targetLength;
      case '<': return length < targetLength;
      case '>=': return length >= targetLength;
      case '<=': return length <= targetLength;
      case '=': return length === targetLength;
      default: return false;
    }
  },

  /**
   * 标签计数匹配器
   * 格式: tagCount:operator:value
   * 例如: custom:tagCount:>=:3 (标签数量大于等于3)
   */
  tagCount: (pattern: string, message: RoutableMessage): boolean => {
    const [operator, value] = pattern.split(':');
    const tagCount = message.routingTags.size;
    const targetCount = parseInt(value);
    
    if (isNaN(targetCount)) {
      return false;
    }

    switch (operator) {
      case '>': return tagCount > targetCount;
      case '<': return tagCount < targetCount;
      case '>=': return tagCount >= targetCount;
      case '<=': return tagCount <= targetCount;
      case '=': return tagCount === targetCount;
      default: return false;
    }
  },
};

// 注册内置匹配器
Object.entries(builtInMatchers).forEach(([name, matcher]) => {
  defaultMessageMatcher.addCustomMatcher(name, matcher);
});
