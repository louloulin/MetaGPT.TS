/**
 * 消息路由系统测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  MessageRouter,
  RouterFactory,
  MessageFactory,
  RouteRuleFactory,
  ContentFilters,
  PriorityFilters,
  MessageTransformers,
  RouterMiddlewares,
  MessagePriority,
  createRouterId,
  type RoutableMessage,
  type RouteRule,
} from '../index';

describe('消息路由系统测试', () => {
  let router: MessageRouter;

  beforeEach(() => {
    router = RouterFactory.createStandard({
      id: createRouterId('test-router'),
      name: 'TestRouter',
      debug: true,
    });
    router.start();
  });

  afterEach(() => {
    router.stop();
  });

  describe('基础路由功能', () => {
    it('应该能够创建和启动路由器', () => {
      expect(router.isRunning()).toBe(true);
      expect(router.getConfig().name).toBe('TestRouter');
    });

    it('应该能够路由简单消息', async () => {
      let handledMessage: RoutableMessage | null = null;

      // 添加路由规则
      const rule = RouteRuleFactory.createRoleRule(
        'user',
        (message) => {
          handledMessage = message;
        }
      );
      router.addRule(rule);

      // 创建并路由消息
      const message = MessageFactory.createUserMessage('Hello, world!');
      const result = await router.route(message);

      expect(result.success).toBe(true);
      expect(result.handlerCount).toBe(1);
      expect(handledMessage).not.toBeNull();
      if (handledMessage) {
        expect(handledMessage.content).toBe('Hello, world!');
      }
    });

    it('应该能够处理多个路由规则', async () => {
      const handledMessages: RoutableMessage[] = [];

      // 添加多个路由规则
      const userRule = RouteRuleFactory.createRoleRule(
        'user',
        (message) => {
          handledMessages.push(message);
        }
      );

      const priorityRule = RouteRuleFactory.createPriorityRule(
        MessagePriority.NORMAL,
        (message) => {
          handledMessages.push(message);
        },
        { operator: '>=' }
      );

      router.addRule(userRule);
      router.addRule(priorityRule);

      // 创建并路由消息
      const message = MessageFactory.createUserMessage('Test message');
      const result = await router.route(message);

      expect(result.success).toBe(true);
      expect(result.handlerCount).toBe(2);
      expect(handledMessages).toHaveLength(2);
    });

    it('应该能够处理无匹配规则的消息', async () => {
      // 添加一个不匹配的规则
      const rule = RouteRuleFactory.createRoleRule(
        'admin',
        () => {}
      );
      router.addRule(rule);

      // 创建用户消息（不匹配admin角色）
      const message = MessageFactory.createUserMessage('Test message');
      const result = await router.route(message);

      expect(result.success).toBe(true);
      expect(result.handlerCount).toBe(0);
    });
  });

  describe('消息过滤器', () => {
    it('应该能够使用内容长度过滤器', async () => {
      let handledMessage: RoutableMessage | null = null;

      // 创建带过滤器的规则
      const rule: RouteRule = {
        id: 'content-filter-rule',
        pattern: '*',
        filters: [ContentFilters.minLength(10)],
        transformers: [],
        handlers: [(message) => { handledMessage = message; }],
        priority: 100,
        enabled: true,
      };
      router.addRule(rule);

      // 测试短消息（应该被过滤）
      const shortMessage = MessageFactory.createUserMessage('Hi');
      const shortResult = await router.route(shortMessage);
      expect(shortResult.handlerCount).toBe(0);
      expect(handledMessage).toBeNull();

      // 测试长消息（应该通过）
      const longMessage = MessageFactory.createUserMessage('This is a long message');
      const longResult = await router.route(longMessage);
      expect(longResult.handlerCount).toBe(1);
      expect(handledMessage).not.toBeNull();
    });

    it('应该能够使用优先级过滤器', async () => {
      let handledMessages: RoutableMessage[] = [];

      // 创建高优先级过滤器规则
      const rule: RouteRule = {
        id: 'priority-filter-rule',
        pattern: '*',
        filters: [PriorityFilters.minPriority(MessagePriority.HIGH)],
        transformers: [],
        handlers: [(message) => {
          handledMessages.push(message);
        }],
        priority: 100,
        enabled: true,
      };
      router.addRule(rule);

      // 测试低优先级消息
      const lowPriorityMessage = MessageFactory.createUserMessage('Low priority', {
        priority: MessagePriority.LOW,
      });
      await router.route(lowPriorityMessage);
      expect(handledMessages).toHaveLength(0);

      // 测试高优先级消息
      const highPriorityMessage = MessageFactory.createUserMessage('High priority', {
        priority: MessagePriority.HIGH,
      });
      await router.route(highPriorityMessage);
      expect(handledMessages).toHaveLength(1);
    });

    it('应该能够使用关键词过滤器', async () => {
      let handledMessages: RoutableMessage[] = [];

      // 创建关键词过滤器规则
      const rule: RouteRule = {
        id: 'keyword-filter-rule',
        pattern: '*',
        filters: [ContentFilters.containsKeywords(['urgent', 'important'])],
        transformers: [],
        handlers: [(message) => {
          handledMessages.push(message);
        }],
        priority: 100,
        enabled: true,
      };
      router.addRule(rule);

      // 测试不包含关键词的消息
      const normalMessage = MessageFactory.createUserMessage('Just a normal message');
      await router.route(normalMessage);
      expect(handledMessages).toHaveLength(0);

      // 测试包含关键词的消息
      const urgentMessage = MessageFactory.createUserMessage('This is urgent!');
      await router.route(urgentMessage);
      expect(handledMessages).toHaveLength(1);
    });
  });

  describe('消息转换器', () => {
    it('应该能够添加标签转换器', async () => {
      let transformedMessage: RoutableMessage | null = null;

      // 创建带转换器的规则
      const rule: RouteRule = {
        id: 'tag-transformer-rule',
        pattern: '*',
        filters: [],
        transformers: [MessageTransformers.addTag('processed')],
        handlers: [(message) => { transformedMessage = message; }],
        priority: 100,
        enabled: true,
      };
      router.addRule(rule);

      // 路由消息
      const message = MessageFactory.createUserMessage('Test message');
      await router.route(message);

      expect(transformedMessage).not.toBeNull();
      expect(transformedMessage?.routingTags.has('processed')).toBe(true);
    });

    it('应该能够设置优先级转换器', async () => {
      let transformedMessage: RoutableMessage | null = null;

      // 创建优先级转换器规则
      const rule: RouteRule = {
        id: 'priority-transformer-rule',
        pattern: '*',
        filters: [],
        transformers: [MessageTransformers.setPriority(MessagePriority.CRITICAL)],
        handlers: [(message) => { transformedMessage = message; }],
        priority: 100,
        enabled: true,
      };
      router.addRule(rule);

      // 路由低优先级消息
      const message = MessageFactory.createUserMessage('Test message', {
        priority: MessagePriority.LOW,
      });
      await router.route(message);

      expect(transformedMessage).not.toBeNull();
      expect(transformedMessage?.priority).toBe(MessagePriority.CRITICAL);
    });
  });

  describe('中间件', () => {
    it('应该能够使用日志中间件', async () => {
      // 添加日志中间件
      router.use(RouterMiddlewares.logging({ logLevel: 'info' }));

      // 添加简单规则
      const rule = RouteRuleFactory.createRoleRule('user', () => {});
      router.addRule(rule);

      // 路由消息
      const message = MessageFactory.createUserMessage('Test message');
      const result = await router.route(message);

      // 验证路由成功（日志中间件不应该影响路由结果）
      expect(result.success).toBe(true);
      expect(result.handlerCount).toBe(1);
    });

    it('应该能够使用性能监控中间件', async () => {
      // 添加性能监控中间件
      router.use(RouterMiddlewares.performance({ slowThreshold: 100 }));

      // 添加慢处理规则
      const rule = RouteRuleFactory.createRoleRule('user', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      router.addRule(rule);

      // 路由消息
      const message = MessageFactory.createUserMessage('Test message');
      const result = await router.route(message);

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('路由器指标', () => {
    it('应该能够收集基本指标', async () => {
      // 添加规则
      const rule = RouteRuleFactory.createRoleRule('user', () => {});
      router.addRule(rule);

      // 路由多个消息
      for (let i = 0; i < 5; i++) {
        const message = MessageFactory.createUserMessage(`Message ${i}`);
        await router.route(message);
      }

      const metrics = router.getMetrics();
      expect(metrics.totalMessages).toBe(5);
      expect(metrics.successfulMessages).toBe(5);
      expect(metrics.failedMessages).toBe(0);
      expect(metrics.activeRules).toBe(1);
    });

    it('应该能够记录失败指标', async () => {
      // 添加会失败的规则
      const rule = RouteRuleFactory.createRoleRule('user', () => {
        throw new Error('Handler error');
      });
      router.addRule(rule);

      // 路由消息（应该失败）
      const message = MessageFactory.createUserMessage('Test message');
      const result = await router.route(message);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      const metrics = router.getMetrics();
      expect(metrics.totalMessages).toBe(1);
      expect(metrics.failedMessages).toBe(1);
    });
  });

  describe('规则管理', () => {
    it('应该能够添加和移除规则', () => {
      const rule = RouteRuleFactory.createRoleRule('user', () => {});
      
      // 添加规则
      router.addRule(rule);
      expect(router.getRule(rule.id)).toBeDefined();
      expect(router.getAllRules()).toHaveLength(1);

      // 移除规则
      const removed = router.removeRule(rule.id);
      expect(removed).toBe(true);
      expect(router.getRule(rule.id)).toBeUndefined();
      expect(router.getAllRules()).toHaveLength(0);
    });

    it('应该能够更新规则', () => {
      const rule = RouteRuleFactory.createRoleRule('user', () => {});
      router.addRule(rule);

      // 更新规则
      const updatedRule = { ...rule, description: 'Updated description' };
      router.updateRule(updatedRule);

      const retrieved = router.getRule(rule.id);
      expect(retrieved?.description).toBe('Updated description');
    });

    it('应该能够禁用规则', async () => {
      let handledMessage: RoutableMessage | null = null;

      const rule = RouteRuleFactory.createRoleRule('user', (message) => {
        handledMessage = message;
      });
      router.addRule(rule);

      // 禁用规则
      const disabledRule = { ...rule, enabled: false };
      router.updateRule(disabledRule);

      // 路由消息
      const message = MessageFactory.createUserMessage('Test message');
      const result = await router.route(message);

      expect(result.handlerCount).toBe(0);
      expect(handledMessage).toBeNull();
    });
  });
});
