/**
 * 消息过滤器和匹配器测试
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ContentFilters,
  PriorityFilters,
  TimeFilters,
  RoleFilters,
  CompositeFilters,
  MessageTransformers,
  AdvancedMessageMatcher,
  MessageFactory,
  MessagePriority,
  type RoutableMessage,
} from '../index';

describe('消息过滤器测试', () => {
  let testMessage: RoutableMessage;

  beforeEach(() => {
    testMessage = MessageFactory.createUserMessage('Test message content', {
      priority: MessagePriority.NORMAL,
      tags: ['test', 'example'],
    });
  });

  describe('ContentFilters', () => {
    it('应该能够按最小长度过滤', () => {
      const filter = ContentFilters.minLength(10);
      
      expect(filter(testMessage)).toBe(true); // "Test message content" > 10
      
      const shortMessage = MessageFactory.createUserMessage('Hi');
      expect(filter(shortMessage)).toBe(false); // "Hi" < 10
    });

    it('应该能够按最大长度过滤', () => {
      const filter = ContentFilters.maxLength(20);
      
      expect(filter(testMessage)).toBe(true); // "Test message content" < 20
      
      const longMessage = MessageFactory.createUserMessage('This is a very long message that exceeds the limit');
      expect(filter(longMessage)).toBe(false);
    });

    it('应该能够按关键词过滤', () => {
      const filter = ContentFilters.containsKeywords(['test', 'message']);
      
      expect(filter(testMessage)).toBe(true); // 包含 "test" 和 "message"
      
      const noKeywordMessage = MessageFactory.createUserMessage('Hello world');
      expect(filter(noKeywordMessage)).toBe(false);
    });

    it('应该能够按关键词过滤（匹配所有）', () => {
      const filter = ContentFilters.containsKeywords(['test', 'message'], { matchAll: true });
      
      expect(filter(testMessage)).toBe(true); // 包含 "test" 和 "message"
      
      const partialMessage = MessageFactory.createUserMessage('Test only');
      expect(filter(partialMessage)).toBe(false); // 只包含 "test"
    });

    it('应该能够按正则表达式过滤', () => {
      const filter = ContentFilters.matchesRegex(/^Test/);
      
      expect(filter(testMessage)).toBe(true); // 以 "Test" 开头
      
      const noMatchMessage = MessageFactory.createUserMessage('Hello world');
      expect(filter(noMatchMessage)).toBe(false);
    });

    it('应该能够排除禁用词', () => {
      const filter = ContentFilters.excludeWords(['spam', 'bad']);
      
      expect(filter(testMessage)).toBe(true); // 不包含禁用词
      
      const spamMessage = MessageFactory.createUserMessage('This is spam content');
      expect(filter(spamMessage)).toBe(false); // 包含 "spam"
    });
  });

  describe('PriorityFilters', () => {
    it('应该能够按最小优先级过滤', () => {
      const filter = PriorityFilters.minPriority(MessagePriority.NORMAL);
      
      expect(filter(testMessage)).toBe(true); // NORMAL >= NORMAL
      
      const lowMessage = MessageFactory.createUserMessage('Low priority', {
        priority: MessagePriority.LOW,
      });
      expect(filter(lowMessage)).toBe(false); // LOW < NORMAL
    });

    it('应该能够按最大优先级过滤', () => {
      const filter = PriorityFilters.maxPriority(MessagePriority.HIGH);
      
      expect(filter(testMessage)).toBe(true); // NORMAL <= HIGH
      
      const criticalMessage = MessageFactory.createUserMessage('Critical message', {
        priority: MessagePriority.CRITICAL,
      });
      expect(filter(criticalMessage)).toBe(false); // CRITICAL > HIGH
    });

    it('应该能够按优先级范围过滤', () => {
      const filter = PriorityFilters.priorityRange(MessagePriority.LOW, MessagePriority.HIGH);
      
      expect(filter(testMessage)).toBe(true); // NORMAL 在范围内
      
      const criticalMessage = MessageFactory.createUserMessage('Critical message', {
        priority: MessagePriority.CRITICAL,
      });
      expect(filter(criticalMessage)).toBe(false); // CRITICAL 超出范围
    });

    it('应该能够过滤仅关键消息', () => {
      const filter = PriorityFilters.criticalOnly();
      
      expect(filter(testMessage)).toBe(false); // NORMAL < CRITICAL
      
      const criticalMessage = MessageFactory.createUserMessage('Critical message', {
        priority: MessagePriority.CRITICAL,
      });
      expect(filter(criticalMessage)).toBe(true); // CRITICAL >= CRITICAL
    });
  });

  describe('TimeFilters', () => {
    it('应该能够按消息年龄过滤', () => {
      const filter = TimeFilters.maxAge(60000); // 1 minute
      
      expect(filter(testMessage)).toBe(true); // 新消息
      
      // 创建旧消息
      const oldMessage = { ...testMessage };
      oldMessage.timestamp = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
      expect(filter(oldMessage)).toBe(false);
    });

    it('应该能够按工作时间过滤', () => {
      const filter = TimeFilters.workingHours(9, 17);
      
      // 创建工作时间内的消息
      const workingHourMessage = { ...testMessage };
      const workingTime = new Date();
      workingTime.setHours(12, 0, 0, 0); // 12:00 PM
      workingHourMessage.timestamp = workingTime.toISOString();
      expect(filter(workingHourMessage)).toBe(true);
      
      // 创建工作时间外的消息
      const afterHourMessage = { ...testMessage };
      const afterTime = new Date();
      afterTime.setHours(20, 0, 0, 0); // 8:00 PM
      afterHourMessage.timestamp = afterTime.toISOString();
      expect(filter(afterHourMessage)).toBe(false);
    });

    it('应该能够过滤未过期消息', () => {
      const filter = TimeFilters.notExpired();
      
      expect(filter(testMessage)).toBe(true); // 没有过期时间
      
      // 创建未过期消息
      const futureMessage = { ...testMessage };
      futureMessage.expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
      expect(filter(futureMessage)).toBe(true);
      
      // 创建已过期消息
      const expiredMessage = { ...testMessage };
      expiredMessage.expiresAt = new Date(Date.now() - 3600000); // 1 hour ago
      expect(filter(expiredMessage)).toBe(false);
    });
  });

  describe('RoleFilters', () => {
    it('应该能够按角色过滤', () => {
      const filter = RoleFilters.fromRole('user');
      
      expect(filter(testMessage)).toBe(true); // 用户消息
      
      const systemMessage = MessageFactory.createSystemMessage('System message');
      expect(filter(systemMessage)).toBe(false); // 系统消息
    });

    it('应该能够排除特定角色', () => {
      const filter = RoleFilters.excludeRoles(['system', 'admin']);
      
      expect(filter(testMessage)).toBe(true); // 用户消息不被排除
      
      const systemMessage = MessageFactory.createSystemMessage('System message');
      expect(filter(systemMessage)).toBe(false); // 系统消息被排除
    });

    it('应该能够按标签过滤', () => {
      const filter = RoleFilters.hasTag('test');
      
      expect(filter(testMessage)).toBe(true); // 包含 "test" 标签
      
      const noTagMessage = MessageFactory.createUserMessage('No tags');
      expect(filter(noTagMessage)).toBe(false);
    });

    it('应该能够按多个标签过滤', () => {
      const filterAny = RoleFilters.hasTags(['test', 'missing'], { matchAll: false });
      const filterAll = RoleFilters.hasTags(['test', 'example'], { matchAll: true });
      
      expect(filterAny(testMessage)).toBe(true); // 包含 "test"
      expect(filterAll(testMessage)).toBe(true); // 包含 "test" 和 "example"
      
      const partialMessage = MessageFactory.createUserMessage('Partial', { tags: ['test'] });
      expect(filterAny(partialMessage)).toBe(true); // 包含 "test"
      expect(filterAll(partialMessage)).toBe(false); // 不包含 "example"
    });

    it('应该能够按消息类型过滤', () => {
      const filter = RoleFilters.messageType('user_input');
      
      expect(filter(testMessage)).toBe(true); // 用户输入类型
      
      const systemMessage = MessageFactory.createSystemMessage('System message');
      expect(filter(systemMessage)).toBe(false); // 系统通知类型
    });
  });

  describe('CompositeFilters', () => {
    it('应该能够组合AND过滤器', async () => {
      const filter = CompositeFilters.and(
        ContentFilters.minLength(5),
        PriorityFilters.minPriority(MessagePriority.LOW)
      );
      
      expect(await filter(testMessage)).toBe(true); // 满足两个条件
      
      const shortMessage = MessageFactory.createUserMessage('Hi');
      expect(await filter(shortMessage)).toBe(false); // 不满足长度条件
    });

    it('应该能够组合OR过滤器', async () => {
      const filter = CompositeFilters.or(
        ContentFilters.containsKeywords(['urgent']),
        PriorityFilters.minPriority(MessagePriority.HIGH)
      );
      
      expect(await filter(testMessage)).toBe(false); // 不满足任何条件
      
      const urgentMessage = MessageFactory.createUserMessage('This is urgent');
      expect(await filter(urgentMessage)).toBe(true); // 满足关键词条件
      
      const highPriorityMessage = MessageFactory.createUserMessage('High priority', {
        priority: MessagePriority.HIGH,
      });
      expect(await filter(highPriorityMessage)).toBe(true); // 满足优先级条件
    });

    it('应该能够使用NOT过滤器', async () => {
      const filter = CompositeFilters.not(
        ContentFilters.containsKeywords(['spam'])
      );
      
      expect(await filter(testMessage)).toBe(true); // 不包含 "spam"
      
      const spamMessage = MessageFactory.createUserMessage('This is spam');
      expect(await filter(spamMessage)).toBe(false); // 包含 "spam"
    });

    it('应该能够使用条件过滤器', async () => {
      const filter = CompositeFilters.conditional(
        RoleFilters.fromRole('user'),
        ContentFilters.minLength(10),
        ContentFilters.minLength(5)
      );
      
      expect(await filter(testMessage)).toBe(true); // 用户消息且长度 > 10
      
      const systemMessage = MessageFactory.createSystemMessage('Hi');
      expect(await filter(systemMessage)).toBe(false); // 系统消息但长度 < 5
    });
  });

  describe('MessageTransformers', () => {
    it('应该能够添加标签', () => {
      const transformer = MessageTransformers.addTag('processed');
      const transformed = transformer(testMessage);
      
      expect(transformed.routingTags.has('processed')).toBe(true);
      expect(transformed.routingTags.has('test')).toBe(true); // 保留原有标签
    });

    it('应该能够移除标签', () => {
      const transformer = MessageTransformers.removeTag('test');
      const transformed = transformer(testMessage);
      
      expect(transformed.routingTags.has('test')).toBe(false);
      expect(transformed.routingTags.has('example')).toBe(true); // 保留其他标签
    });

    it('应该能够设置优先级', () => {
      const transformer = MessageTransformers.setPriority(MessagePriority.CRITICAL);
      const transformed = transformer(testMessage);
      
      expect(transformed.priority).toBe(MessagePriority.CRITICAL);
    });

    it('应该能够转换内容', () => {
      const transformer = MessageTransformers.transformContent(content => content.toUpperCase());
      const transformed = transformer(testMessage);
      
      expect(transformed.content).toBe('TEST MESSAGE CONTENT');
    });

    it('应该能够添加元数据', () => {
      const transformer = MessageTransformers.addMetadata({ processed: true, version: 2 });
      const transformed = transformer(testMessage);
      
      expect(transformed.metadata?.processed).toBe(true);
      expect(transformed.metadata?.version).toBe(2);
    });
  });
});

describe('消息匹配器测试', () => {
  let matcher: AdvancedMessageMatcher;
  let testMessage: RoutableMessage;

  beforeEach(() => {
    matcher = new AdvancedMessageMatcher();
    testMessage = MessageFactory.createUserMessage('Test message', {
      priority: MessagePriority.NORMAL,
      tags: ['test', 'example'],
    });
  });

  describe('基础模式匹配', () => {
    it('应该能够匹配通配符', () => {
      expect(matcher.match('*', testMessage)).toBe(true);
    });

    it('应该能够匹配角色模式', () => {
      expect(matcher.match('role:user', testMessage)).toBe(true);
      expect(matcher.match('role:admin', testMessage)).toBe(false);
    });

    it('应该能够匹配动作模式', () => {
      const actionMessage = { ...testMessage, causedBy: 'WriteCode' };
      expect(matcher.match('action:WriteCode', actionMessage)).toBe(true);
      expect(matcher.match('action:Write*', actionMessage)).toBe(true);
      expect(matcher.match('action:ReadFile', actionMessage)).toBe(false);
    });

    it('应该能够匹配主题模式', () => {
      expect(matcher.match('topic:test', testMessage)).toBe(true);
      expect(matcher.match('topic:example', testMessage)).toBe(true);
      expect(matcher.match('topic:missing', testMessage)).toBe(false);
    });

    it('应该能够匹配优先级模式', () => {
      expect(matcher.match(`priority:=${MessagePriority.NORMAL}`, testMessage)).toBe(true);
      expect(matcher.match(`priority:>=${MessagePriority.LOW}`, testMessage)).toBe(true);
      expect(matcher.match(`priority:<${MessagePriority.HIGH}`, testMessage)).toBe(true);
      expect(matcher.match(`priority:>${MessagePriority.NORMAL}`, testMessage)).toBe(false);
    });

    it('应该能够匹配正则表达式模式', () => {
      expect(matcher.match('regex:^Test', testMessage)).toBe(true);
      expect(matcher.match('regex:message', testMessage)).toBe(true);
      expect(matcher.match('regex:^Hello', testMessage)).toBe(false);
    });
  });

  describe('自定义匹配器', () => {
    it('应该能够添加和使用自定义匹配器', () => {
      // 添加自定义匹配器
      matcher.addCustomMatcher('contentLength', (pattern, message) => {
        const [operator, value] = pattern.split(':');
        const length = message.content.length;
        const targetLength = parseInt(value);
        
        switch (operator) {
          case '>': return length > targetLength;
          case '<': return length < targetLength;
          default: return false;
        }
      });

      expect(matcher.match('custom:contentLength:>:5', testMessage)).toBe(true);
      expect(matcher.match('custom:contentLength:<:5', testMessage)).toBe(false);
    });

    it('应该能够移除自定义匹配器', () => {
      matcher.addCustomMatcher('test', () => true);
      expect(matcher.removeCustomMatcher('test')).toBe(true);
      expect(matcher.removeCustomMatcher('nonexistent')).toBe(false);
    });
  });

  describe('性能和缓存', () => {
    it('应该能够缓存匹配结果', () => {
      // 第一次匹配
      const result1 = matcher.match('role:user', testMessage);
      
      // 第二次匹配（应该使用缓存）
      const result2 = matcher.match('role:user', testMessage);
      
      expect(result1).toBe(result2);
      
      const stats = matcher.getStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
    });

    it('应该能够清空缓存', () => {
      matcher.match('role:user', testMessage);
      matcher.clearCache();
      
      const stats = matcher.getStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });

    it('应该能够获取统计信息', () => {
      matcher.match('role:user', testMessage);
      matcher.match('role:admin', testMessage);
      
      const stats = matcher.getStats();
      expect(stats.cacheMisses).toBe(2);
      expect(stats.cacheSize).toBe(2);
      expect(typeof stats.cacheHitRate).toBe('number');
    });
  });
});
