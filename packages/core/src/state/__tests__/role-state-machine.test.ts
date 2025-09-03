/**
 * 角色状态机测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { RoleStateMachine, RoleStateMachineFactory } from '../role-state-machine';
import { 
  RoleStates, 
  RoleEvents,
  type RoleContext,
  type RoleEvent,
} from '../types';

// 创建测试用的角色上下文
function createTestRoleContext(name: string = 'TestRole'): RoleContext {
  return {
    name,
    messageQueue: [],
    retryCount: 0,
    maxRetries: 3,
    stats: {
      observeCount: 0,
      thinkCount: 0,
      actCount: 0,
      reactCount: 0,
      errorCount: 0,
    },
    data: {},
  };
}

describe('RoleStateMachine 测试', () => {
  let roleStateMachine: RoleStateMachine;
  let context: RoleContext;

  beforeEach(() => {
    context = createTestRoleContext('TestRole');
    roleStateMachine = RoleStateMachineFactory.createStandard('test-role', context, {
      debug: true,
      maxRetries: 3,
      autoRecover: false, // 禁用自动恢复以便测试
    });
  });

  afterEach(async () => {
    if (roleStateMachine) {
      await roleStateMachine.dispose();
    }
  });

  describe('基础功能', () => {
    it('应该正确初始化角色状态机', () => {
      expect(roleStateMachine.getId()).toBe('role-test-role');
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.IDLE);
      
      const ctx = roleStateMachine.getContext();
      expect(ctx.name).toBe('TestRole');
      expect(ctx.messageQueue).toHaveLength(0);
      expect(ctx.retryCount).toBe(0);
    });

    it('应该能够启动角色状态机', async () => {
      await roleStateMachine.start();
      
      const snapshot = roleStateMachine.getSnapshot();
      expect(snapshot.value).toBe(RoleStates.IDLE);
    });
  });

  describe('状态转换', () => {
    beforeEach(async () => {
      await roleStateMachine.start();
    });

    it('应该能够从空闲状态转换到观察状态', async () => {
      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.OBSERVE,
      });

      expect(success).toBe(true);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.OBSERVING);
      
      const stats = roleStateMachine.getStats();
      expect(stats.observeCount).toBe(1);
    });

    it('应该能够从观察状态转换到思考状态', async () => {
      // 添加消息到队列以满足守卫条件
      roleStateMachine.addMessage({
        id: 'test-msg-1',
        content: 'Test message',
        role: 'user',
        timestamp: new Date(),
      } as any);

      await roleStateMachine.sendRoleEvent({ type: RoleEvents.OBSERVE });
      
      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.THINK,
      });

      expect(success).toBe(true);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.THINKING);
      
      const stats = roleStateMachine.getStats();
      expect(stats.thinkCount).toBe(1);
    });

    it('应该能够从思考状态转换到行动状态', async () => {
      // 添加消息到队列以满足守卫条件
      roleStateMachine.addMessage({
        id: 'test-msg-2',
        content: 'Test message for action',
        role: 'user',
        timestamp: new Date(),
      } as any);

      // 设置当前动作
      const mockAction = { id: 'test-action', name: 'TestAction' } as any;
      roleStateMachine.setCurrentAction(mockAction);

      await roleStateMachine.sendRoleEvent({ type: RoleEvents.OBSERVE });
      await roleStateMachine.sendRoleEvent({ type: RoleEvents.THINK });

      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.ACT,
        action: mockAction,
      });

      expect(success).toBe(true);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.ACTING);

      const stats = roleStateMachine.getStats();
      expect(stats.actCount).toBe(1);
    });

    it('应该能够处理直接响应', async () => {
      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.REACT,
        message: {
          id: 'react-msg',
          content: 'React to this',
          role: 'user',
          timestamp: new Date(),
        } as any,
      });

      expect(success).toBe(true);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.REACTING);
      
      const stats = roleStateMachine.getStats();
      expect(stats.reactCount).toBe(1);
    });
  });

  describe('守卫条件', () => {
    beforeEach(async () => {
      await roleStateMachine.start();
    });

    it('应该在没有消息时阻止思考转换', async () => {
      await roleStateMachine.sendRoleEvent({ type: RoleEvents.OBSERVE });
      
      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.THINK,
      });

      // 应该失败，因为消息队列为空
      expect(success).toBe(false);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.OBSERVING);
    });

    it('应该在没有动作时阻止行动转换', async () => {
      // 添加消息但不设置动作
      roleStateMachine.addMessage({
        id: 'test-msg',
        content: 'Test',
        role: 'user',
        timestamp: new Date(),
      } as any);

      await roleStateMachine.sendRoleEvent({ type: RoleEvents.OBSERVE });
      await roleStateMachine.sendRoleEvent({ type: RoleEvents.THINK });
      
      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.ACT,
      });

      // 应该失败，因为没有设置当前动作
      expect(success).toBe(false);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.THINKING);
    });
  });

  describe('错误处理', () => {
    beforeEach(async () => {
      await roleStateMachine.start();
    });

    it('应该能够处理错误状态', async () => {
      const testError = new Error('Test error');
      
      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.ERROR,
        error: testError,
      });

      expect(success).toBe(true);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.ERROR);
      
      const context = roleStateMachine.getContext();
      expect(context.error).toBe(testError);
      
      const stats = roleStateMachine.getStats();
      expect(stats.errorCount).toBe(1);
      expect(stats.hasError).toBe(true);
    });

    it('应该能够从错误状态恢复', async () => {
      const testError = new Error('Test error');
      
      await roleStateMachine.sendRoleEvent({
        type: RoleEvents.ERROR,
        error: testError,
      });

      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.RESUME,
      });

      expect(success).toBe(true);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.OBSERVING);
      
      const context = roleStateMachine.getContext();
      expect(context.error).toBeUndefined();
      expect(context.retryCount).toBe(1);
    });

    it('应该在达到最大重试次数时阻止恢复', async () => {
      const testError = new Error('Test error');
      
      // 设置重试次数到最大值
      roleStateMachine.updateContext(ctx => ({
        ...ctx,
        retryCount: ctx.maxRetries,
      }));

      await roleStateMachine.sendRoleEvent({
        type: RoleEvents.ERROR,
        error: testError,
      });

      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.RESUME,
      });

      // 应该失败，因为已达到最大重试次数
      expect(success).toBe(false);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.ERROR);
    });

    it('应该能够重置状态', async () => {
      const testError = new Error('Test error');
      
      await roleStateMachine.sendRoleEvent({
        type: RoleEvents.ERROR,
        error: testError,
      });

      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.RESET,
      });

      expect(success).toBe(true);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.IDLE);
      
      const context = roleStateMachine.getContext();
      expect(context.error).toBeUndefined();
      expect(context.retryCount).toBe(0);
    });
  });

  describe('暂停和恢复', () => {
    beforeEach(async () => {
      await roleStateMachine.start();
    });

    it('应该能够暂停角色', async () => {
      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.SUSPEND,
        reason: 'Test suspension',
      });

      expect(success).toBe(true);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.SUSPENDED);
    });

    it('应该能够从暂停状态恢复', async () => {
      await roleStateMachine.sendRoleEvent({
        type: RoleEvents.SUSPEND,
      });

      const success = await roleStateMachine.sendRoleEvent({
        type: RoleEvents.RESUME,
      });

      expect(success).toBe(true);
      expect(roleStateMachine.getCurrentState()).toBe(RoleStates.IDLE);
    });
  });

  describe('统计信息', () => {
    beforeEach(async () => {
      await roleStateMachine.start();
    });

    it('应该正确跟踪统计信息', async () => {
      // 执行一系列操作
      await roleStateMachine.sendRoleEvent({ type: RoleEvents.OBSERVE });

      // 回到idle状态再次observe
      await roleStateMachine.sendRoleEvent({ type: RoleEvents.COMPLETE });
      await roleStateMachine.sendRoleEvent({ type: RoleEvents.OBSERVE });

      roleStateMachine.addMessage({
        id: 'msg1',
        content: 'Test',
        role: 'user',
        timestamp: new Date(),
      } as any);

      await roleStateMachine.sendRoleEvent({ type: RoleEvents.THINK });
      await roleStateMachine.sendRoleEvent({ type: RoleEvents.COMPLETE });
      await roleStateMachine.sendRoleEvent({ type: RoleEvents.REACT, message: {} as any });

      const stats = roleStateMachine.getStats();

      expect(stats.observeCount).toBe(2);
      expect(stats.thinkCount).toBe(1);
      expect(stats.reactCount).toBe(1);
      expect(stats.messageQueueSize).toBe(1);
      expect(stats.currentState).toBe(RoleStates.REACTING);
    });

    it('应该能够重置统计信息', async () => {
      // 执行一些操作
      await roleStateMachine.sendRoleEvent({ type: RoleEvents.OBSERVE });
      await roleStateMachine.sendRoleEvent({ type: RoleEvents.REACT, message: {} as any });

      roleStateMachine.resetStats();

      const stats = roleStateMachine.getStats();
      expect(stats.observeCount).toBe(0);
      expect(stats.thinkCount).toBe(0);
      expect(stats.actCount).toBe(0);
      expect(stats.reactCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.retryCount).toBe(0);
    });
  });

  describe('消息管理', () => {
    beforeEach(async () => {
      await roleStateMachine.start();
    });

    it('应该能够添加消息到队列', () => {
      const message1 = { id: 'msg1', content: 'Message 1' } as any;
      const message2 = { id: 'msg2', content: 'Message 2' } as any;

      roleStateMachine.addMessage(message1);
      roleStateMachine.addMessage(message2);

      const context = roleStateMachine.getContext();
      expect(context.messageQueue).toHaveLength(2);
      expect(context.messageQueue[0]).toBe(message1);
      expect(context.messageQueue[1]).toBe(message2);
    });

    it('应该能够设置当前动作', () => {
      const action = { id: 'action1', name: 'TestAction' } as any;

      roleStateMachine.setCurrentAction(action);

      const context = roleStateMachine.getContext();
      expect(context.currentAction).toBe(action);
    });
  });
});

describe('RoleStateMachineFactory 测试', () => {
  let context: RoleContext;

  beforeEach(() => {
    context = createTestRoleContext('FactoryTestRole');
  });

  it('应该能够创建标准角色状态机', () => {
    const stateMachine = RoleStateMachineFactory.createStandard('standard-role', context);
    
    expect(stateMachine).toBeInstanceOf(RoleStateMachine);
    expect(stateMachine.getId()).toBe('role-standard-role');
    expect(stateMachine.getCurrentState()).toBe(RoleStates.IDLE);
  });

  it('应该能够创建学习型角色状态机', () => {
    const stateMachine = RoleStateMachineFactory.createLearning('learning-role', context);
    
    expect(stateMachine).toBeInstanceOf(RoleStateMachine);
    expect(stateMachine.getId()).toBe('role-learning-role');
    
    // 学习型状态机应该有学习状态的转换
    expect(stateMachine.canTransition(RoleEvents.LEARN)).toBe(false); // 在idle状态下不能学习
  });

  it('应该能够创建协作型角色状态机', () => {
    const stateMachine = RoleStateMachineFactory.createCollaborative('collaborative-role', context);
    
    expect(stateMachine).toBeInstanceOf(RoleStateMachine);
    expect(stateMachine.getId()).toBe('role-collaborative-role');
  });
});
