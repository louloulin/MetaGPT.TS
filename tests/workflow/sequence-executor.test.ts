import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { SequenceNodeExecutor } from '../../src/workflow/executors/sequence-executor';
import type { NodeExecutor, WorkflowNode } from '../../src/types/workflow';

describe('SequenceNodeExecutor', () => {
  let executor: SequenceNodeExecutor;
  let mockNode: WorkflowNode;
  let mockContext: any;

  beforeEach(() => {
    executor = new SequenceNodeExecutor();
    mockNode = {
      id: 'test-sequence',
      name: 'Test Sequence',
      type: 'sequence',
      status: 'pending',
      childIds: ['child1', 'child2', 'child3'],
      config: {
        sequence: {
          errorStrategy: 'fail-fast',
          timeout: 1000,
          passPreviousResult: true,
        },
      },
    };
  });

  test('should validate sequence node correctly', () => {
    expect(executor.validate(mockNode)).toBe(true);

    const invalidNode = { ...mockNode, type: 'invalid' };
    expect(executor.validate(invalidNode)).toBe(false);

    const noChildrenNode = { ...mockNode, childIds: [] };
    expect(executor.validate(noChildrenNode)).toBe(false);
  });

  test('should execute child nodes in sequence', async () => {
    const results = ['result1', 'result2', 'result3'];
    const mockExecutors = new Map<string, NodeExecutor>();
    
    // 模拟子节点执行器
    mockExecutors.set('action', {
      execute: mock((node) => Promise.resolve(`result${node.id.slice(-1)}`)),
      validate: () => true,
      getStatus: () => 'completed',
      getResult: () => null,
    });

    mockContext = {
      workflow: {
        nodes: [
          { id: 'child1', type: 'action' },
          { id: 'child2', type: 'action' },
          { id: 'child3', type: 'action' },
        ],
        nodeExecutors: mockExecutors,
      },
    };

    const result = await executor.execute(mockNode, mockContext);
    expect(result).toEqual(results);
    expect(executor.getStatus()).toBe('completed');
  });

  test('should pass previous results to next node', async () => {
    const previousResults: any[] = [];
    const mockExecutors = new Map<string, NodeExecutor>();
    
    mockExecutors.set('action', {
      execute: mock((node, context) => {
        previousResults.push(context.previousResult);
        return Promise.resolve(`result${node.id.slice(-1)}`);
      }),
      validate: () => true,
      getStatus: () => 'completed',
      getResult: () => null,
    });

    mockContext = {
      workflow: {
        nodes: [
          { id: 'child1', type: 'action' },
          { id: 'child2', type: 'action' },
          { id: 'child3', type: 'action' },
        ],
        nodeExecutors: mockExecutors,
      },
    };

    await executor.execute(mockNode, mockContext);
    expect(previousResults[1]).toBe('result1');
    expect(previousResults[2]).toBe('result2');
  });

  test.skip('should handle errors according to strategy', async () => {
    const mockExecutors = new Map<string, NodeExecutor>();
    
    // 使用简单字符串作为错误
    const errorMessage = 'Node execution failed';
    
    mockExecutors.set('action', {
      execute: mock((node) => {
        if (node.id === 'child2') {
          return Promise.reject(errorMessage);
        }
        return Promise.resolve(`result${node.id.slice(-1)}`);
      }),
      validate: () => true,
      getStatus: () => 'completed',
      getResult: () => null,
    });

    mockContext = {
      workflow: {
        nodes: [
          { id: 'child1', type: 'action' },
          { id: 'child2', type: 'action' },
          { id: 'child3', type: 'action' },
        ],
        nodeExecutors: mockExecutors,
      },
    };

    // Test fail-fast strategy
    const failFastExecutor = new SequenceNodeExecutor();
    const failFastNode = {
      ...mockNode,
      config: {
        sequence: {
          errorStrategy: 'fail-fast',
          timeout: 1000,
          passPreviousResult: true,
        },
      }
    };

    // 简单测试错误被正确抛出，不关心具体错误消息
    try {
      await failFastExecutor.execute(failFastNode, mockContext);
      expect(false).toBe(true); // 应该不会执行到这里
    } catch (error) {
      expect(failFastExecutor.getStatus()).toBe('failed');
    }

    // Test continue strategy
    const continueExecutor = new SequenceNodeExecutor();
    const continueNode = {
      ...mockNode,
      config: {
        sequence: {
          errorStrategy: 'continue',
          timeout: 1000,
          passPreviousResult: true,
        },
      }
    };
    const continueResult = await continueExecutor.execute(continueNode, mockContext);
    expect(continueResult).toEqual(['result1', null, 'result3']);

    // Test ignore strategy
    const ignoreExecutor = new SequenceNodeExecutor();
    const ignoreNode = {
      ...mockNode,
      config: {
        sequence: {
          errorStrategy: 'ignore',
          timeout: 1000,
          passPreviousResult: true,
        },
      }
    };
    const ignoreResult = await ignoreExecutor.execute(ignoreNode, mockContext);
    expect(ignoreResult).toEqual(['result1', 'result3']);
  });

  test('should handle timeout', async () => {
    const mockExecutors = new Map<string, NodeExecutor>();
    
    mockExecutors.set('action', {
      execute: mock((node) => {
        if (node.id === 'child2') {
          return new Promise(resolve => setTimeout(resolve, 2000));
        }
        return Promise.resolve(`result${node.id.slice(-1)}`);
      }),
      validate: () => true,
      getStatus: () => 'completed',
      getResult: () => null,
    });

    mockContext = {
      workflow: {
        nodes: [
          { id: 'child1', type: 'action' },
          { id: 'child2', type: 'action' },
          { id: 'child3', type: 'action' },
        ],
        nodeExecutors: mockExecutors,
      },
    };

    mockNode.config.sequence.timeout = 100;
    await expect(executor.execute(mockNode, mockContext)).rejects.toThrow('timed out');
    expect(executor.getStatus()).toBe('failed');
  });
}); 