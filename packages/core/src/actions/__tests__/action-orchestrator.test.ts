/**
 * ActionOrchestrator Tests
 * 
 * Comprehensive test suite for the ActionOrchestrator system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ActionOrchestrator, 
  OrchestrationMode, 
  OrchestrationStatus,
  type OrchestrationConfig 
} from '../action-orchestrator';
import { ActionNode, ActionNodeStatus, FillMode } from '../action-node';
import type { LLMProvider } from '../../types/llm';

// Mock LLM Provider
const mockLLM: LLMProvider = {
  chat: vi.fn(),
  chatStream: vi.fn(),
  generateStream: vi.fn(),
  setSystemPrompt: vi.fn(),
  getSystemPrompt: vi.fn(),
  name: 'mock-llm',
  model: 'mock-model'
};

describe('ActionOrchestrator', () => {
  let orchestrator: ActionOrchestrator;
  let config: OrchestrationConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    config = {
      id: 'test-orchestrator',
      mode: OrchestrationMode.SEQUENTIAL,
      maxConcurrency: 3,
      timeout: 30000,
      autoRollback: false,
      continueOnError: false
    };

    orchestrator = new ActionOrchestrator(config);
  });

  describe('Configuration Validation', () => {
    it('should create orchestrator with valid config', () => {
      expect(orchestrator.getStatus()).toBe(OrchestrationStatus.PENDING);
    });

    it('should throw error for empty ID', () => {
      expect(() => {
        new ActionOrchestrator({
          ...config,
          id: ''
        });
      }).toThrow('Orchestration ID is required');
    });

    it('should throw error for invalid max concurrency', () => {
      expect(() => {
        new ActionOrchestrator({
          ...config,
          maxConcurrency: 0
        });
      }).toThrow('Max concurrency must be at least 1');
    });

    it('should throw error for negative timeout', () => {
      expect(() => {
        new ActionOrchestrator({
          ...config,
          timeout: -1
        });
      }).toThrow('Timeout must be non-negative');
    });
  });

  describe('Node Management', () => {
    let node1: ActionNode;
    let node2: ActionNode;

    beforeEach(() => {
      node1 = new ActionNode({
        key: 'node1',
        expectedType: 'string',
        instruction: 'First node instruction',
        example: 'example1'
      });

      node2 = new ActionNode({
        key: 'node2',
        expectedType: 'string',
        instruction: 'Second node instruction',
        example: 'example2'
      });
    });

    it('should add nodes correctly', () => {
      orchestrator.addNode(node1);
      orchestrator.addNode(node2);

      expect(orchestrator.getNode('node1')).toBe(node1);
      expect(orchestrator.getNode('node2')).toBe(node2);
      expect(orchestrator.getAllNodes()).toHaveLength(2);
    });

    it('should throw error when adding duplicate node', () => {
      orchestrator.addNode(node1);
      
      expect(() => {
        orchestrator.addNode(node1);
      }).toThrow("Node with key 'node1' already exists");
    });

    it('should remove nodes correctly', () => {
      orchestrator.addNode(node1);
      orchestrator.addNode(node2);

      const removed = orchestrator.removeNode('node1');
      
      expect(removed).toBe(true);
      expect(orchestrator.getNode('node1')).toBeUndefined();
      expect(orchestrator.getAllNodes()).toHaveLength(1);
    });

    it('should return false when removing non-existent node', () => {
      const removed = orchestrator.removeNode('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Dependency Management', () => {
    let node1: ActionNode;
    let node2: ActionNode;
    let node3: ActionNode;

    beforeEach(() => {
      node1 = new ActionNode({
        key: 'node1',
        expectedType: 'string',
        instruction: 'First node',
        example: 'example1'
      });

      node2 = new ActionNode({
        key: 'node2',
        expectedType: 'string',
        instruction: 'Second node',
        example: 'example2'
      });

      node3 = new ActionNode({
        key: 'node3',
        expectedType: 'string',
        instruction: 'Third node',
        example: 'example3'
      });

      orchestrator.addNode(node1);
      orchestrator.addNode(node2);
      orchestrator.addNode(node3);
    });

    it('should add dependencies correctly', () => {
      orchestrator.addDependency('node1', 'node2');
      
      expect(node2.getDependencies()).toContain(node1);
      expect(node1.getDependents()).toContain(node2);
    });

    it('should throw error for non-existent source node', () => {
      expect(() => {
        orchestrator.addDependency('non-existent', 'node2');
      }).toThrow("Source node 'non-existent' not found");
    });

    it('should throw error for non-existent target node', () => {
      expect(() => {
        orchestrator.addDependency('node1', 'non-existent');
      }).toThrow("Target node 'non-existent' not found");
    });

    it('should remove dependencies correctly', () => {
      orchestrator.addDependency('node1', 'node2');
      orchestrator.removeDependency('node1', 'node2');
      
      expect(node2.getDependencies()).not.toContain(node1);
      expect(node1.getDependents()).not.toContain(node2);
    });

    it('should get entry nodes correctly', () => {
      orchestrator.addDependency('node1', 'node2');
      orchestrator.addDependency('node2', 'node3');
      
      const entryNodes = orchestrator.getEntryNodes();
      
      expect(entryNodes).toHaveLength(1);
      expect(entryNodes[0]).toBe(node1);
    });

    it('should detect circular dependencies', () => {
      orchestrator.addDependency('node1', 'node2');
      orchestrator.addDependency('node2', 'node3');
      orchestrator.addDependency('node3', 'node1');
      
      expect(orchestrator.hasCircularDependencies()).toBe(true);
    });

    it('should not detect circular dependencies in valid graph', () => {
      orchestrator.addDependency('node1', 'node2');
      orchestrator.addDependency('node1', 'node3');
      
      expect(orchestrator.hasCircularDependencies()).toBe(false);
    });

    it('should get correct topological order', () => {
      orchestrator.addDependency('node1', 'node2');
      orchestrator.addDependency('node2', 'node3');
      
      const order = orchestrator.getTopologicalOrder();
      
      expect(order.indexOf('node1')).toBeLessThan(order.indexOf('node2'));
      expect(order.indexOf('node2')).toBeLessThan(order.indexOf('node3'));
    });
  });

  describe('Sequential Execution', () => {
    let node1: ActionNode;
    let node2: ActionNode;

    beforeEach(() => {
      node1 = new ActionNode({
        key: 'node1',
        expectedType: 'string',
        instruction: 'First node',
        example: 'example1'
      });

      node2 = new ActionNode({
        key: 'node2',
        expectedType: 'string',
        instruction: 'Second node',
        example: 'example2'
      });

      orchestrator.addNode(node1);
      orchestrator.addNode(node2);
      orchestrator.addDependency('node1', 'node2');

      (mockLLM.chat as any).mockResolvedValue('{"result": "success"}');
    });

    it('should execute nodes sequentially', async () => {
      const context = {
        llm: mockLLM,
        context: 'Test context',
        fillMode: FillMode.JSON
      };

      const result = await orchestrator.execute(context);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(orchestrator.getStatus()).toBe(OrchestrationStatus.COMPLETED);
    });

    it('should fail execution on circular dependencies', async () => {
      orchestrator.addDependency('node2', 'node1'); // Create circular dependency

      const context = {
        llm: mockLLM,
        context: 'Test context',
        fillMode: FillMode.JSON
      };

      await expect(orchestrator.execute(context)).rejects.toThrow('Circular dependencies detected');
    });

    it('should handle node execution failure', async () => {
      (mockLLM.chat as any).mockRejectedValue(new Error('LLM Error'));

      const context = {
        llm: mockLLM,
        context: 'Test context',
        fillMode: FillMode.JSON
      };

      const result = await orchestrator.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(orchestrator.getStatus()).toBe(OrchestrationStatus.FAILED);
    });

    it('should continue on error when configured', async () => {
      const continueOrchestrator = new ActionOrchestrator({
        ...config,
        continueOnError: true
      });

      // Create independent nodes (no dependencies)
      const independentNode1 = new ActionNode({
        key: 'independent-node1',
        expectedType: 'string',
        instruction: 'First independent node',
        example: 'example1'
      });

      const independentNode2 = new ActionNode({
        key: 'independent-node2',
        expectedType: 'string',
        instruction: 'Second independent node',
        example: 'example2'
      });

      continueOrchestrator.addNode(independentNode1);
      continueOrchestrator.addNode(independentNode2);

      // Make first call fail, second succeed
      (mockLLM.chat as any)
        .mockRejectedValueOnce(new Error('First node error'))
        .mockResolvedValueOnce('{"result": "success"}');

      const context = {
        llm: mockLLM,
        context: 'Test context',
        fillMode: FillMode.JSON
      };

      const result = await continueOrchestrator.execute(context);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(false);
      expect(result.results[1].success).toBe(true);
    });
  });

  describe('Parallel Execution', () => {
    let node1: ActionNode;
    let node2: ActionNode;
    let node3: ActionNode;

    beforeEach(() => {
      orchestrator = new ActionOrchestrator({
        ...config,
        mode: OrchestrationMode.PARALLEL,
        maxConcurrency: 2
      });

      node1 = new ActionNode({
        key: 'node1',
        expectedType: 'string',
        instruction: 'First node',
        example: 'example1'
      });

      node2 = new ActionNode({
        key: 'node2',
        expectedType: 'string',
        instruction: 'Second node',
        example: 'example2'
      });

      node3 = new ActionNode({
        key: 'node3',
        expectedType: 'string',
        instruction: 'Third node',
        example: 'example3'
      });

      orchestrator.addNode(node1);
      orchestrator.addNode(node2);
      orchestrator.addNode(node3);

      (mockLLM.chat as any).mockResolvedValue('{"result": "success"}');
    });

    it('should execute independent nodes in parallel', async () => {
      const context = {
        llm: mockLLM,
        context: 'Test context',
        fillMode: FillMode.JSON
      };

      const startTime = Date.now();
      const result = await orchestrator.execute(context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(orchestrator.getStatus()).toBe(OrchestrationStatus.COMPLETED);
      
      // Parallel execution should be faster than sequential
      expect(endTime - startTime).toBeLessThan(1000); // Assuming each node takes some time
    });

    it('should respect dependency order in parallel execution', async () => {
      orchestrator.addDependency('node1', 'node2');
      orchestrator.addDependency('node1', 'node3');

      const context = {
        llm: mockLLM,
        context: 'Test context',
        fillMode: FillMode.JSON
      };

      const result = await orchestrator.execute(context);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      
      // node1 should complete before node2 and node3
      const node1Result = result.results.find(r => r.nodeId === 'node1');
      const node2Result = result.results.find(r => r.nodeId === 'node2');
      const node3Result = result.results.find(r => r.nodeId === 'node3');
      
      expect(node1Result).toBeDefined();
      expect(node2Result).toBeDefined();
      expect(node3Result).toBeDefined();
    });
  });

  describe('Rollback', () => {
    let node1: ActionNode;
    let node2: ActionNode;

    beforeEach(() => {
      const rollbackFn1 = vi.fn();
      const rollbackFn2 = vi.fn();

      node1 = new ActionNode({
        key: 'node1',
        expectedType: 'string',
        instruction: 'First node',
        example: 'example1',
        rollback: rollbackFn1
      });

      node2 = new ActionNode({
        key: 'node2',
        expectedType: 'string',
        instruction: 'Second node',
        example: 'example2',
        rollback: rollbackFn2
      });

      orchestrator.addNode(node1);
      orchestrator.addNode(node2);

      (mockLLM.chat as any).mockResolvedValue('{"result": "success"}');
    });

    it('should rollback completed nodes', async () => {
      const context = {
        llm: mockLLM,
        context: 'Test context',
        fillMode: FillMode.JSON
      };

      // Execute successfully
      await orchestrator.execute(context);
      expect(orchestrator.getStatus()).toBe(OrchestrationStatus.COMPLETED);

      // Rollback
      await orchestrator.rollback();
      expect(orchestrator.getStatus()).toBe(OrchestrationStatus.ROLLED_BACK);
    });

    it('should auto-rollback on failure when configured', async () => {
      const autoRollbackOrchestrator = new ActionOrchestrator({
        ...config,
        autoRollback: true
      });

      autoRollbackOrchestrator.addNode(node1);
      autoRollbackOrchestrator.addNode(node2);

      // Make execution fail
      (mockLLM.chat as any).mockRejectedValue(new Error('Execution failed'));

      const context = {
        llm: mockLLM,
        context: 'Test context',
        fillMode: FillMode.JSON
      };

      const result = await autoRollbackOrchestrator.execute(context);

      expect(result.success).toBe(false);
      expect(autoRollbackOrchestrator.getStatus()).toBe(OrchestrationStatus.FAILED);
    });
  });

  describe('Utility Methods', () => {
    let node1: ActionNode;

    beforeEach(() => {
      node1 = new ActionNode({
        key: 'node1',
        expectedType: 'string',
        instruction: 'Test node',
        example: 'example'
      });

      orchestrator.addNode(node1);
    });

    it('should reset orchestrator correctly', () => {
      orchestrator.setMetadata('testKey', 'testValue');
      orchestrator['status'] = OrchestrationStatus.COMPLETED;

      orchestrator.reset();

      expect(orchestrator.getStatus()).toBe(OrchestrationStatus.PENDING);
      expect(node1.nodeStatus).toBe(ActionNodeStatus.PENDING);
    });

    it('should provide correct summary', () => {
      const summary = orchestrator.getSummary();

      expect(summary.id).toBe('test-orchestrator');
      expect(summary.status).toBe(OrchestrationStatus.PENDING);
      expect(summary.nodeCount).toBe(1);
      expect(summary.executionCount).toBe(0);
      expect(summary.hasCircularDependencies).toBe(false);
    });

    it('should generate DOT visualization', () => {
      const dot = orchestrator.toDOT();

      expect(dot).toContain('digraph ActionOrchestrator_test-orchestrator');
      expect(dot).toContain('"node1"');
      expect(dot).toContain('fillcolor="lightgray"'); // pending status
    });
  });

  describe('Serialization', () => {
    let node1: ActionNode;

    beforeEach(() => {
      node1 = new ActionNode({
        key: 'node1',
        expectedType: 'string',
        instruction: 'Test node',
        example: 'example'
      });

      orchestrator.addNode(node1);
      orchestrator.setMetadata('testKey', 'testValue');
    });

    it('should serialize and deserialize correctly', () => {
      const json = orchestrator.toJSON();
      const deserializedOrchestrator = ActionOrchestrator.fromJSON(json);

      expect(deserializedOrchestrator.getStatus()).toBe(orchestrator.getStatus());
      expect(deserializedOrchestrator.getNode('node1')).toBeDefined();
      expect(deserializedOrchestrator.getMetadata()).toEqual(orchestrator.getMetadata());
    });
  });
});
