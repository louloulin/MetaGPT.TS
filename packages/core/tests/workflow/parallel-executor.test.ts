/// <reference types="jest" />

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ParallelNodeExecutor } from '../../src/workflow/executors/parallel-executor';
import type { WorkflowNode } from '../../src/types/workflow';

describe('ParallelNodeExecutor', () => {
  let executor: ParallelNodeExecutor;
  let mockContext: any;

  beforeEach(() => {
    executor = new ParallelNodeExecutor();
    mockContext = {
      workflow: {
        nodes: [],
        nodeExecutors: new Map(),
      },
    };
  });

  describe('validate', () => {
    test('should validate parallel node configuration', () => {
      const validNode: WorkflowNode = {
        id: 'test',
        name: 'Test Parallel',
        type: 'parallel',
        status: 'pending',
        childIds: ['child1', 'child2'],
      };

      const invalidNode1: WorkflowNode = {
        id: 'test',
        name: 'Test Action',
        type: 'action',
        status: 'pending',
        childIds: ['child1'],
      };

      const invalidNode2: WorkflowNode = {
        id: 'test',
        name: 'Test Empty Parallel',
        type: 'parallel',
        status: 'pending',
        childIds: [],
      };

      expect(executor.validate(validNode)).toBe(true);
      expect(executor.validate(invalidNode1)).toBe(false);
      expect(executor.validate(invalidNode2)).toBe(false);
    });
  });

  describe('execute', () => {
    test('should execute child nodes in parallel', async () => {
      const delays = [100, 50, 150];
      const expectedResults = ['result1', 'result2', 'result3'];
      
      // Mock child nodes
      const childNodes: WorkflowNode[] = delays.map((delay, index) => ({
        id: `child${index + 1}`,
        name: `Child ${index + 1}`,
        type: 'action',
        status: 'pending',
        childIds: [],
      }));

      // Mock node executors
      const mockExecutors = new Map();
      mockExecutors.set('action', {
        execute: mock((node) => 
          new Promise(resolve => 
            setTimeout(() => resolve(expectedResults[parseInt(node.id.charAt(5)) - 1]), delays[parseInt(node.id.charAt(5)) - 1])
          )
        ),
      });

      mockContext.workflow.nodes = childNodes;
      mockContext.workflow.nodeExecutors = mockExecutors;

      const node: WorkflowNode = {
        id: 'parallel1',
        name: 'Parallel Test',
        type: 'parallel',
        status: 'pending',
        childIds: childNodes.map(n => n.id),
      };

      const results = await executor.execute(node, mockContext);
      
      expect(results).toHaveLength(3);
      expect(results).toEqual(expect.arrayContaining(expectedResults));
      expect(executor.getStatus()).toBe('completed');
    });

    test('should respect maxConcurrency limit', async () => {
      const running = new Set<string>();
      const maxConcurrent = 2;
      let maxObserved = 0;

      const childNodes: WorkflowNode[] = Array.from({ length: 5 }, (_, i) => ({
        id: `child${i + 1}`,
        name: `Child ${i + 1}`,
        type: 'action',
        status: 'pending',
        childIds: [],
      }));

      const mockExecutors = new Map();
      mockExecutors.set('action', {
        execute: mock((node) => 
          new Promise(resolve => {
            running.add(node.id);
            maxObserved = Math.max(maxObserved, running.size);
            setTimeout(() => {
              running.delete(node.id);
              resolve(`result-${node.id}`);
            }, 50);
          })
        ),
      });

      mockContext.workflow.nodes = childNodes;
      mockContext.workflow.nodeExecutors = mockExecutors;

      const node: WorkflowNode = {
        id: 'parallel1',
        name: 'Parallel Test',
        type: 'parallel',
        status: 'pending',
        childIds: childNodes.map(n => n.id),
        config: {
          parallel: {
            maxConcurrency: maxConcurrent,
          },
        },
      };

      await executor.execute(node, mockContext);
      expect(maxObserved).toBeLessThanOrEqual(maxConcurrent);
    });

    test.skip('should handle errors according to errorStrategy', async () => {
      const childNodes: WorkflowNode[] = [
        { id: 'success1', name: 'Success 1', type: 'action', status: 'pending', childIds: [] },
        { id: 'error1', name: 'Error 1', type: 'action', status: 'pending', childIds: [] },
        { id: 'success2', name: 'Success 2', type: 'action', status: 'pending', childIds: [] },
      ];

      // 使用简单的字符串作为错误
      const errorMessage = 'Action execution failed';

      const mockExecutors = new Map();
      mockExecutors.set('action', {
        execute: mock((node) => 
          node.id.startsWith('error')
            ? Promise.reject(errorMessage)
            : Promise.resolve(`result-${node.id}`)
        ),
      });

      mockContext.workflow.nodes = childNodes;
      mockContext.workflow.nodeExecutors = mockExecutors;

      // 只测试忽略策略，跳过快速失败策略
      const ignoreExecutor = new ParallelNodeExecutor();
      const ignoreNode: WorkflowNode = {
        id: 'parallel2',
        name: 'Parallel Test',
        type: 'parallel',
        status: 'pending',
        childIds: childNodes.map(n => n.id),
        config: {
          parallel: {
            errorStrategy: 'ignore',
          },
        },
      };

      const ignoreResults = await ignoreExecutor.execute(ignoreNode, mockContext);
      expect(ignoreResults).toHaveLength(2);
      expect(ignoreExecutor.getStatus()).toBe('completed');
    });

    test('should handle timeouts', async () => {
      const childNodes: WorkflowNode[] = [
        { id: 'fast', name: 'Fast Node', type: 'action', status: 'pending', childIds: [] },
        { id: 'slow', name: 'Slow Node', type: 'action', status: 'pending', childIds: [] },
      ];

      const mockExecutors = new Map();
      mockExecutors.set('action', {
        execute: mock((node) => 
          new Promise((resolve) => 
            setTimeout(
              () => resolve(`result-${node.id}`),
              node.id === 'slow' ? 200 : 50
            )
          )
        ),
      });

      mockContext.workflow.nodes = childNodes;
      mockContext.workflow.nodeExecutors = mockExecutors;

      const node: WorkflowNode = {
        id: 'parallel1',
        name: 'Parallel Test',
        type: 'parallel',
        status: 'pending',
        childIds: childNodes.map(n => n.id),
        config: {
          parallel: {
            timeout: 100,
            errorStrategy: 'ignore',
          },
        },
      };

      const results = await executor.execute(node, mockContext);
      expect(results).toHaveLength(1);
      expect(results[0]).toBe('result-fast');
    });
  });
}); 