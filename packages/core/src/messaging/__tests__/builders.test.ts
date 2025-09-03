/**
 * 消息构建器测试
 */

import { describe, it, expect } from 'bun:test';
import {
  RoutableMessageBuilder,
  RouteRuleBuilder,
  MessageFactory,
  RouteRuleFactory,
  MessagePriority,
  type RoutableMessage,
} from '../index';

describe('消息构建器测试', () => {
  describe('RoutableMessageBuilder', () => {
    it('应该能够构建基本消息', () => {
      const message = new RoutableMessageBuilder()
        .content('Test message')
        .role('user')
        .messageType('test')
        .build();

      expect(message.content).toBe('Test message');
      expect(message.role).toBe('user');
      expect(message.messageType).toBe('test');
      expect(message.id).toBeDefined();
      expect(message.routingTags).toBeInstanceOf(Set);
      expect(message.routingHistory).toBeInstanceOf(Array);
    });

    it('应该能够设置优先级和标签', () => {
      const message = new RoutableMessageBuilder()
        .content('Priority message')
        .priority(MessagePriority.HIGH)
        .addTag('urgent')
        .addTag('important')
        .build();

      expect(message.priority).toBe(MessagePriority.HIGH);
      expect(message.routingTags.has('urgent')).toBe(true);
      expect(message.routingTags.has('important')).toBe(true);
      expect(message.routingTags.size).toBe(2);
    });

    it('应该能够设置发送者和接收者', () => {
      const message = new RoutableMessageBuilder()
        .content('Directed message')
        .from('sender-123')
        .to(['recipient-1', 'recipient-2'])
        .causedBy('TestAction')
        .build();

      expect(message.sentFrom).toBe('sender-123');
      expect(message.sendTo.has('recipient-1')).toBe(true);
      expect(message.sendTo.has('recipient-2')).toBe(true);
      expect(message.causedBy).toBe('TestAction');
    });

    it('应该能够设置过期时间和重试配置', () => {
      const expiryDate = new Date(Date.now() + 3600000); // 1 hour from now
      
      const message = new RoutableMessageBuilder()
        .content('Expiring message')
        .expiresAt(expiryDate)
        .maxRetries(5)
        .build();

      expect(message.expiresAt).toEqual(expiryDate);
      expect(message.maxRetries).toBe(5);
      expect(message.retryCount).toBe(0);
    });

    it('应该能够设置元数据和指令内容', () => {
      const metadata = { source: 'test', version: '1.0' };
      const instructContent = { action: 'process', params: { id: 123 } };

      const message = new RoutableMessageBuilder()
        .content('Message with metadata')
        .metadata(metadata)
        .instructContent(instructContent)
        .build();

      expect(message.metadata).toEqual(metadata);
      expect(message.instructContent).toEqual(instructContent);
    });

    it('应该在缺少必需字段时抛出错误', () => {
      expect(() => {
        new RoutableMessageBuilder().build();
      }).toThrow('Message content is required');
    });

    it('应该能够重置和克隆构建器', () => {
      const builder = new RoutableMessageBuilder()
        .content('Original message')
        .priority(MessagePriority.HIGH)
        .addTag('test');

      // 克隆构建器
      const clonedBuilder = builder.clone();
      const clonedMessage = clonedBuilder
        .content('Cloned message')
        .build();

      // 重置原构建器
      const resetMessage = builder
        .reset()
        .content('Reset message')
        .build();

      expect(clonedMessage.content).toBe('Cloned message');
      expect(clonedMessage.priority).toBe(MessagePriority.HIGH);
      expect(clonedMessage.routingTags.has('test')).toBe(true);

      expect(resetMessage.content).toBe('Reset message');
      expect(resetMessage.priority).toBe(MessagePriority.NORMAL);
      expect(resetMessage.routingTags.has('test')).toBe(false);
    });
  });

  describe('RouteRuleBuilder', () => {
    it('应该能够构建基本路由规则', () => {
      const handler = () => {};
      
      const rule = new RouteRuleBuilder()
        .id('test-rule')
        .pattern('role:user')
        .handle(handler)
        .priority(100)
        .description('Test rule')
        .build();

      expect(rule.id).toBe('test-rule');
      expect(rule.pattern).toBe('role:user');
      expect(rule.handlers).toContain(handler);
      expect(rule.priority).toBe(100);
      expect(rule.description).toBe('Test rule');
      expect(rule.enabled).toBe(true);
    });

    it('应该能够添加过滤器和转换器', () => {
      const filter = () => true;
      const transformer = (msg: RoutableMessage) => msg;
      const handler = () => {};

      const rule = new RouteRuleBuilder()
        .id('complex-rule')
        .pattern('*')
        .filter(filter)
        .transform(transformer)
        .handle(handler)
        .build();

      expect(rule.filters).toContain(filter);
      expect(rule.transformers).toContain(transformer);
      expect(rule.handlers).toContain(handler);
    });

    it('应该能够设置元数据和启用状态', () => {
      const metadata = { category: 'test', version: 1 };

      const rule = new RouteRuleBuilder()
        .id('metadata-rule')
        .pattern('*')
        .handle(() => {})
        .enabled(false)
        .metadata(metadata)
        .build();

      expect(rule.enabled).toBe(false);
      expect(rule.metadata).toEqual(metadata);
    });

    it('应该在缺少必需字段时抛出错误', () => {
      expect(() => {
        new RouteRuleBuilder().build();
      }).toThrow('Rule ID is required');

      expect(() => {
        new RouteRuleBuilder()
          .id('test-rule')
          .build();
      }).toThrow('Route pattern is required');
    });
  });

  describe('MessageFactory', () => {
    it('应该能够创建用户消息', () => {
      const message = MessageFactory.createUserMessage('Hello, world!', {
        priority: MessagePriority.HIGH,
        tags: ['greeting', 'test'],
        metadata: { source: 'test' },
      });

      expect(message.content).toBe('Hello, world!');
      expect(message.role).toBe('user');
      expect(message.messageType).toBe('user_input');
      expect(message.priority).toBe(MessagePriority.HIGH);
      expect(message.routingTags.has('greeting')).toBe(true);
      expect(message.routingTags.has('test')).toBe(true);
      expect(message.metadata).toEqual({ source: 'test' });
    });

    it('应该能够创建系统消息', () => {
      const message = MessageFactory.createSystemMessage('System notification', {
        tags: ['notification'],
      });

      expect(message.content).toBe('System notification');
      expect(message.role).toBe('system');
      expect(message.messageType).toBe('system_notification');
      expect(message.priority).toBe(MessagePriority.HIGH);
      expect(message.routingTags.has('notification')).toBe(true);
    });

    it('应该能够创建AI助手消息', () => {
      const message = MessageFactory.createAssistantMessage('AI response', {
        priority: MessagePriority.NORMAL,
      });

      expect(message.content).toBe('AI response');
      expect(message.role).toBe('assistant');
      expect(message.messageType).toBe('ai_response');
      expect(message.priority).toBe(MessagePriority.NORMAL);
    });

    it('应该能够创建任务消息', () => {
      const deadline = new Date(Date.now() + 86400000); // 24 hours from now
      
      const message = MessageFactory.createTaskMessage(
        'Complete the project',
        'development',
        {
          priority: MessagePriority.HIGH,
          assignee: 'developer-123',
          deadline,
          metadata: { projectId: 'proj-456' },
        }
      );

      expect(message.content).toBe('Complete the project');
      expect(message.messageType).toBe('task_assignment');
      expect(message.priority).toBe(MessagePriority.HIGH);
      expect(message.sendTo.has('developer-123')).toBe(true);
      expect(message.expiresAt).toEqual(deadline);
      expect(message.routingTags.has('task')).toBe(true);
      expect(message.routingTags.has('development')).toBe(true);
      expect(message.routingTags.has('assignee:developer-123')).toBe(true);
      expect(message.metadata?.taskType).toBe('development');
      expect(message.metadata?.assignee).toBe('developer-123');
      expect(message.metadata?.projectId).toBe('proj-456');
    });

    it('应该能够创建通知消息', () => {
      const message = MessageFactory.createNotificationMessage(
        'Urgent system alert',
        'security',
        {
          urgent: true,
          recipients: ['admin-1', 'admin-2'],
          metadata: { alertLevel: 'critical' },
        }
      );

      expect(message.content).toBe('Urgent system alert');
      expect(message.messageType).toBe('notification');
      expect(message.priority).toBe(MessagePriority.CRITICAL);
      expect(message.sendTo.has('admin-1')).toBe(true);
      expect(message.sendTo.has('admin-2')).toBe(true);
      expect(message.routingTags.has('notification')).toBe(true);
      expect(message.routingTags.has('security')).toBe(true);
      expect(message.routingTags.has('urgent')).toBe(true);
      expect(message.metadata?.notificationType).toBe('security');
      expect(message.metadata?.urgent).toBe(true);
      expect(message.metadata?.alertLevel).toBe('critical');
    });

    it('应该能够从基础消息创建可路由消息', () => {
      const baseMessage = {
        id: 'base-123',
        content: 'Base message content',
        role: 'user',
        causedBy: 'UserAction',
        sentFrom: 'user-456',
        sendTo: new Set(['recipient-789']),
        timestamp: '2023-01-01T00:00:00.000Z',
        instructContent: { action: 'test' },
        metadata: { originalSource: 'legacy' },
      };

      const routableMessage = MessageFactory.fromBaseMessage(baseMessage, {
        priority: MessagePriority.HIGH,
        messageType: 'converted_message',
        tags: ['converted', 'legacy'],
        metadata: { conversionTime: Date.now() },
      });

      expect(routableMessage.content).toBe('Base message content');
      expect(routableMessage.role).toBe('user');
      expect(routableMessage.causedBy).toBe('UserAction');
      expect(routableMessage.sentFrom).toBe('user-456');
      expect(routableMessage.sendTo.has('recipient-789')).toBe(true);
      expect(routableMessage.instructContent).toEqual({ action: 'test' });
      expect(routableMessage.priority).toBe(MessagePriority.HIGH);
      expect(routableMessage.messageType).toBe('converted_message');
      expect(routableMessage.routingTags.has('converted')).toBe(true);
      expect(routableMessage.routingTags.has('legacy')).toBe(true);
      expect(routableMessage.metadata?.originalId).toBe('base-123');
      expect(routableMessage.metadata?.originalTimestamp).toBe('2023-01-01T00:00:00.000Z');
      expect(routableMessage.metadata?.originalSource).toBe('legacy');
      expect(routableMessage.metadata?.conversionTime).toBeDefined();
    });
  });

  describe('RouteRuleFactory', () => {
    it('应该能够创建角色路由规则', () => {
      const handler = () => {};
      
      const rule = RouteRuleFactory.createRoleRule('admin', handler, {
        priority: 200,
        description: 'Admin role handler',
      });

      expect(rule.pattern).toBe('role:admin');
      expect(rule.handlers).toContain(handler);
      expect(rule.priority).toBe(200);
      expect(rule.description).toBe('Admin role handler');
      expect(rule.id).toMatch(/^role-admin-\d+$/);
    });

    it('应该能够创建优先级路由规则', () => {
      const handler = () => {};
      
      const rule = RouteRuleFactory.createPriorityRule(
        MessagePriority.HIGH,
        handler,
        {
          operator: '>=',
          priority: 150,
          description: 'High priority handler',
        }
      );

      expect(rule.pattern).toBe(`priority:>=${MessagePriority.HIGH}`);
      expect(rule.handlers).toContain(handler);
      expect(rule.priority).toBe(150);
      expect(rule.description).toBe('High priority handler');
      expect(rule.id).toMatch(/^priority->=\d+-\d+$/);
    });

    it('应该能够创建主题路由规则', () => {
      const handler = () => {};
      
      const rule = RouteRuleFactory.createTopicRule('security', handler, {
        priority: 300,
        description: 'Security topic handler',
      });

      expect(rule.pattern).toBe('topic:security');
      expect(rule.handlers).toContain(handler);
      expect(rule.priority).toBe(300);
      expect(rule.description).toBe('Security topic handler');
      expect(rule.id).toMatch(/^topic-security-\d+$/);
    });
  });
});
