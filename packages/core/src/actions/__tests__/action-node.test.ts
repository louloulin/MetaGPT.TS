/**
 * ActionNode Tests
 * 
 * Comprehensive test suite for the ActionNode system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionNode, ActionNodeStatus, FillMode, ActionNodeExecutionContext } from '../action-node';
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

describe('ActionNode', () => {
  let node: ActionNode;
  let context: ActionNodeExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    node = new ActionNode({
      key: 'test-node',
      expectedType: 'string',
      instruction: 'Generate a test response',
      example: 'This is an example response',
      enableCache: false
    });

    context = {
      llm: mockLLM,
      context: 'Test execution context',
      fillMode: FillMode.JSON
    };
  });

  describe('Configuration Validation', () => {
    it('should create a valid ActionNode with required config', () => {
      expect(node.key).toBe('test-node');
      expect(node.nodeStatus).toBe(ActionNodeStatus.PENDING);
    });

    it('should throw error for invalid configuration', () => {
      expect(() => {
        new ActionNode({
          key: '',
          expectedType: 'string',
          instruction: 'test',
          example: 'test'
        });
      }).toThrow('Invalid ActionNode configuration');
    });

    it('should throw error for missing instruction', () => {
      expect(() => {
        new ActionNode({
          key: 'test',
          expectedType: 'string',
          instruction: '',
          example: 'test'
        });
      }).toThrow('Invalid ActionNode configuration');
    });
  });

  describe('Dependency Management', () => {
    let dependencyNode: ActionNode;

    beforeEach(() => {
      dependencyNode = new ActionNode({
        key: 'dependency-node',
        expectedType: 'string',
        instruction: 'Dependency instruction',
        example: 'Dependency example'
      });
    });

    it('should add and manage dependencies correctly', () => {
      node.addDependency(dependencyNode);
      
      expect(node.getDependencies()).toContain(dependencyNode);
      expect(dependencyNode.getDependents()).toContain(node);
      expect(node.areDependenciesSatisfied()).toBe(false);
    });

    it('should remove dependencies correctly', () => {
      node.addDependency(dependencyNode);
      node.removeDependency(dependencyNode);
      
      expect(node.getDependencies()).not.toContain(dependencyNode);
      expect(dependencyNode.getDependents()).not.toContain(node);
    });

    it('should check dependency satisfaction correctly', () => {
      node.addDependency(dependencyNode);
      expect(node.areDependenciesSatisfied()).toBe(false);
      
      // Simulate dependency completion
      dependencyNode['status'] = ActionNodeStatus.COMPLETED;
      expect(node.areDependenciesSatisfied()).toBe(true);
    });
  });

  describe('Child Node Management', () => {
    let childNode: ActionNode;

    beforeEach(() => {
      childNode = new ActionNode({
        key: 'child-node',
        expectedType: 'string',
        instruction: 'Child instruction',
        example: 'Child example'
      });
    });

    it('should add and retrieve child nodes', () => {
      node.addChild(childNode);
      
      expect(node.getChild('child-node')).toBe(childNode);
      expect(Object.keys(node.getChildren())).toContain('child-node');
    });

    it('should return undefined for non-existent child', () => {
      expect(node.getChild('non-existent')).toBeUndefined();
    });
  });

  describe('Metadata Management', () => {
    it('should set and get metadata correctly', () => {
      node.setMetadata('testKey', 'testValue');
      expect(node.getMetadata('testKey')).toBe('testValue');
    });

    it('should return undefined for non-existent metadata', () => {
      expect(node.getMetadata('nonExistent')).toBeUndefined();
    });

    it('should return copy of metadata object', () => {
      node.setMetadata('key1', 'value1');
      const metadata = node.nodeMetadata;
      metadata.key2 = 'value2';
      
      expect(node.getMetadata('key2')).toBeUndefined();
    });
  });

  describe('Execution', () => {
    beforeEach(() => {
      (mockLLM.chat as any).mockResolvedValue('{"result": "test response"}');
    });

    it('should execute successfully with JSON fill mode', async () => {
      const result = await node.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.nodeId).toBe('test-node');
      expect(result.result).toEqual({ result: 'test response' });
      expect(node.nodeStatus).toBe(ActionNodeStatus.COMPLETED);
    });

    it('should execute successfully with RAW fill mode', async () => {
      (mockLLM.chat as any).mockResolvedValue('Raw text response');
      context.fillMode = FillMode.RAW;
      
      const result = await node.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('Raw text response');
    });

    it('should execute successfully with MARKDOWN fill mode', async () => {
      (mockLLM.chat as any).mockResolvedValue('# Markdown Response');
      context.fillMode = FillMode.MARKDOWN;
      
      const result = await node.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('# Markdown Response');
    });

    it('should handle execution failure', async () => {
      (mockLLM.chat as any).mockRejectedValue(new Error('LLM Error'));
      
      const result = await node.execute(context);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('LLM Error');
      expect(node.nodeStatus).toBe(ActionNodeStatus.FAILED);
    });

    it('should fail when dependencies are not satisfied', async () => {
      const dependencyNode = new ActionNode({
        key: 'dependency',
        expectedType: 'string',
        instruction: 'Dependency',
        example: 'example'
      });
      
      node.addDependency(dependencyNode);
      
      const result = await node.execute(context);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Dependencies not satisfied');
    });

    it('should use cached result when caching is enabled', async () => {
      const cachedNode = new ActionNode({
        key: 'cached-node',
        expectedType: 'string',
        instruction: 'Test instruction',
        example: 'example',
        enableCache: true
      });

      // First execution
      (mockLLM.chat as any).mockResolvedValue('{"result": "first response"}');
      const firstResult = await cachedNode.execute(context);
      expect(firstResult.success).toBe(true);

      // Second execution should use cache
      (mockLLM.chat as any).mockResolvedValue('{"result": "second response"}');
      const secondResult = await cachedNode.execute(context);
      
      expect(secondResult.success).toBe(true);
      expect(secondResult.result).toEqual({ result: 'first response' });
      expect(mockLLM.chat).toHaveBeenCalledTimes(1); // Only called once due to caching
    });
  });

  describe('Validation', () => {
    it('should validate result with custom validator', async () => {
      const validatorNode = new ActionNode({
        key: 'validator-node',
        expectedType: 'string',
        instruction: 'Test instruction',
        example: 'example',
        validator: (result) => result && result.valid === true
      });

      (mockLLM.chat as any).mockResolvedValue('{"valid": false}');
      
      const result = await validatorNode.execute(context);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Result validation failed');
    });

    it('should pass validation with valid result', async () => {
      const validatorNode = new ActionNode({
        key: 'validator-node',
        expectedType: 'string',
        instruction: 'Test instruction',
        example: 'example',
        validator: (result) => result && result.valid === true
      });

      (mockLLM.chat as any).mockResolvedValue('{"valid": true}');
      
      const result = await validatorNode.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ valid: true });
    });
  });

  describe('Rollback', () => {
    it('should execute rollback function when available', async () => {
      const rollbackFn = vi.fn();
      const rollbackNode = new ActionNode({
        key: 'rollback-node',
        expectedType: 'string',
        instruction: 'Test instruction',
        example: 'example',
        rollback: rollbackFn
      });

      // Execute first
      (mockLLM.chat as any).mockResolvedValue('{"result": "test"}');
      await rollbackNode.execute(context);
      
      // Then rollback
      await rollbackNode.rollback();
      
      expect(rollbackFn).toHaveBeenCalledWith({ result: 'test' });
      expect(rollbackNode.nodeStatus).toBe(ActionNodeStatus.ROLLED_BACK);
    });

    it('should not rollback if not completed', async () => {
      const rollbackFn = vi.fn();
      const rollbackNode = new ActionNode({
        key: 'rollback-node',
        expectedType: 'string',
        instruction: 'Test instruction',
        example: 'example',
        rollback: rollbackFn
      });

      await rollbackNode.rollback();
      
      expect(rollbackFn).not.toHaveBeenCalled();
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize correctly', () => {
      node.setMetadata('testKey', 'testValue');
      
      const json = node.toJSON();
      const deserializedNode = ActionNode.fromJSON(json);
      
      expect(deserializedNode.key).toBe(node.key);
      expect(deserializedNode.nodeStatus).toBe(node.nodeStatus);
      expect(deserializedNode.getMetadata('testKey')).toBe('testValue');
    });
  });

  describe('Utility Methods', () => {
    it('should reset node correctly', () => {
      node.setMetadata('testKey', 'testValue');
      node['status'] = ActionNodeStatus.COMPLETED;
      node['result'] = 'test result';
      
      node.reset();
      
      expect(node.nodeStatus).toBe(ActionNodeStatus.PENDING);
      expect(node.executionResult).toBeNull();
      expect(Object.keys(node.nodeMetadata)).toHaveLength(0);
    });

    it('should clone node correctly', () => {
      node.setMetadata('testKey', 'testValue');
      
      const clonedNode = node.clone();
      
      expect(clonedNode.key).toBe(node.key);
      expect(clonedNode.getMetadata('testKey')).toBe('testValue');
      expect(clonedNode).not.toBe(node);
    });

    it('should provide correct summary', () => {
      const summary = node.getSummary();
      
      expect(summary.key).toBe('test-node');
      expect(summary.status).toBe(ActionNodeStatus.PENDING);
      expect(summary.hasResult).toBe(false);
      expect(summary.hasError).toBe(false);
      expect(summary.dependencyCount).toBe(0);
      expect(summary.dependentCount).toBe(0);
      expect(summary.childrenCount).toBe(0);
    });
  });
});
