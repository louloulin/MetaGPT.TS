import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { BaseWorkflowExecutor } from '../src/workflow/executor';
import { ActionNodeExecutor } from '../src/workflow/executors/action-executor';
import { RoleNodeExecutor } from '../src/workflow/executors/role-executor';
import type { 
  WorkflowNode, 
  NodeExecutor, 
  WorkflowConfig,
  WorkflowEvent
} from '../src/types/workflow';
import type { Action, ActionOutput } from '../src/types/action';
import type { Role } from '../src/types/role';
import type { Message } from '../src/types/message';
import { generateId } from '../src/utils/common';

describe('Workflow System', () => {
  // 模拟动作
  const mockAction: Action = {
    name: 'test_action',
    context: {} as any,
    llm: {} as any,
    run: mock(() => Promise.resolve({
      content: 'Action completed',
      status: 'completed' as const,
    })),
    handleException: mock(() => Promise.resolve()),
  };

  // 模拟角色
  const mockRole: Role = {
    name: 'test_role',
    profile: 'Test profile',
    goal: 'Test goal',
    constraints: '',
    actions: [],
    state: 0,
    context: {} as any,
    observe: mock(() => Promise.resolve(0)),
    think: mock(() => Promise.resolve(true)),
    act: mock(() => Promise.resolve({
      id: '1',
      content: 'Role action completed',
      role: 'test_role',
      causedBy: 'test_action',
      sentFrom: 'test_role',
      sendTo: new Set(['*']),
    })),
    react: mock(() => Promise.resolve({} as Message)),
  };

  describe('Node Executors', () => {
    test('should execute action node', async () => {
      const executor = new ActionNodeExecutor();
      const node: WorkflowNode = {
        id: 'action1',
        name: 'Test Action',
        type: 'action',
        status: 'pending',
        config: { action: mockAction },
        childIds: [],
      };

      const result = await executor.execute(node, {});
      expect(result.content).toBe('Action completed');
      expect(executor.getStatus()).toBe('completed');
      expect(mockAction.run).toHaveBeenCalled();
    });

    test('should execute role node', async () => {
      const executor = new RoleNodeExecutor();
      const node: WorkflowNode = {
        id: 'role1',
        name: 'Test Role',
        type: 'role',
        status: 'pending',
        config: { role: mockRole },
        childIds: [],
      };

      const result = await executor.execute(node, {});
      expect(result.content).toBe('Role action completed');
      expect(executor.getStatus()).toBe('completed');
      expect(mockRole.observe).toHaveBeenCalled();
      expect(mockRole.think).toHaveBeenCalled();
      expect(mockRole.act).toHaveBeenCalled();
    });

    test('should validate node configurations', () => {
      const actionExecutor = new ActionNodeExecutor();
      const roleExecutor = new RoleNodeExecutor();

      const validActionNode: WorkflowNode = {
        id: 'test',
        name: 'test',
        type: 'action',
        status: 'pending',
        config: { action: mockAction },
        childIds: [],
      };

      const validRoleNode: WorkflowNode = {
        id: 'test',
        name: 'test',
        type: 'role',
        status: 'pending',
        config: { role: mockRole },
        childIds: [],
      };

      const invalidActionNode: WorkflowNode = {
        id: 'test',
        name: 'test',
        type: 'action',
        status: 'pending',
        config: {},
        childIds: [],
      };

      expect(actionExecutor.validate(validActionNode)).toBe(true);
      expect(roleExecutor.validate(validRoleNode)).toBe(true);
      expect(actionExecutor.validate(invalidActionNode)).toBe(false);
    });
  });

  describe('Workflow Execution', () => {
    let executor: BaseWorkflowExecutor;
    let config: WorkflowConfig;
    let events: WorkflowEvent[] = [];

    beforeEach(() => {
      executor = new BaseWorkflowExecutor();
      events = [];

      // 注册事件监听器
      ['workflow:start', 'workflow:complete', 'workflow:fail', 
       'node:start', 'node:complete', 'node:fail'].forEach(event => {
        executor.on(event, (e: WorkflowEvent) => events.push(e));
      });

      // 创建测试工作流配置
      config = {
        id: generateId(),
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'action1',
            name: 'Action Node',
            type: 'action',
            status: 'pending',
            config: { action: mockAction },
            childIds: ['role1'],
          },
          {
            id: 'role1',
            name: 'Role Node',
            type: 'role',
            status: 'pending',
            config: { role: mockRole },
            childIds: [],
            parentId: 'action1',
          },
        ],
      };

      // 注册执行器
      executor.registerNodeExecutor('action', new ActionNodeExecutor());
      executor.registerNodeExecutor('role', new RoleNodeExecutor());
    });

    test('should execute workflow with mixed nodes', async () => {
      await executor.execute(config);
      
      const state = executor.getState();
      expect(state.status).toBe('completed');
      expect(state.completedNodeIds).toContain('action1');
      expect(state.completedNodeIds).toContain('role1');
      expect(state.failedNodeIds).toHaveLength(0);

      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('workflow:start');
      expect(eventTypes).toContain('node:start');
      expect(eventTypes).toContain('node:complete');
      expect(eventTypes).toContain('workflow:complete');
    });

    test('should execute workflow successfully', async () => {
      await executor.execute(config);
      
      const state = executor.getState();
      expect(state.status).toBe('completed');
      expect(state.completedNodeIds).toContain('action1');
      expect(state.completedNodeIds).toContain('role1');
      expect(state.failedNodeIds).toHaveLength(0);
    });

    test('should emit workflow events', async () => {
      await executor.execute(config);
      
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('workflow:start');
      expect(eventTypes).toContain('node:start');
      expect(eventTypes).toContain('node:complete');
      expect(eventTypes).toContain('workflow:complete');
    });

    test('should handle node execution failure', async () => {
      const failingExecutor: NodeExecutor = {
        async execute() { throw new Error('Test error'); },
        validate() { return true; },
        getStatus() { return 'failed'; },
        getResult() { return null; },
      };

      executor.registerNodeExecutor('action', failingExecutor);
      
      await expect(executor.execute(config)).rejects.toThrow('Test error');
      
      const state = executor.getState();
      expect(state.status).toBe('failed');
      expect(state.failedNodeIds).toContain('action1');
    });

    test('should pause and resume workflow', async () => {
      const slowExecutor: NodeExecutor = {
        async execute(node: WorkflowNode) {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { nodeId: node.id, executed: true };
        },
        validate() { return true; },
        getStatus() { return 'running'; },
        getResult() { return null; },
      };

      executor.registerNodeExecutor('action', slowExecutor);
      
      // 启动工作流
      const execution = executor.execute(config);
      
      // 暂停工作流
      await executor.pause();
      const pausedState = executor.getState();
      expect(pausedState.status).toBe('running');
      
      // 恢复工作流
      await executor.resume();
      await execution;
      
      const finalState = executor.getState();
      expect(finalState.status).toBe('completed');
    });

    test('should stop workflow', async () => {
      const execution = executor.execute(config);
      await executor.stop();
      await execution;
      
      const state = executor.getState();
      expect(state.status).toBe('running');
      expect(state.completedNodeIds.length).toBeLessThan(config.nodes.length);
    });

    test('should validate node configuration', async () => {
      const validatingExecutor: NodeExecutor = {
        async execute() { return null; },
        validate(node: WorkflowNode) { 
          return !!node.name && !!node.type;
        },
        getStatus() { return 'pending'; },
        getResult() { return null; },
      };

      executor.registerNodeExecutor('action', validatingExecutor);
      
      // 测试无效节点配置
      const invalidConfig: WorkflowConfig = {
        ...config,
        nodes: [{
          id: 'invalid',
          name: '',  // 无效的名称
          type: 'action',
          status: 'pending',
          childIds: [],
        }],
      };

      await expect(executor.execute(invalidConfig)).rejects.toThrow('Invalid node configuration');
    });
  });
}); 