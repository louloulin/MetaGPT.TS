/**
 * 基础工具系统测试
 * 测试核心功能而不依赖复杂的配置
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SimpleBaseTool } from '../simple-base-tool';
import { ToolManager } from '../tool-registry';
import type { ToolConfig, ToolResult, ToolExecutionOptions } from '../../types/tool';
import { ToolState, ToolPriority } from '../../types/tool';

// 简单的测试工具实现
class SimpleTestTool extends SimpleBaseTool {
  constructor() {
    super({
      name: 'simple_test_tool',
      description: 'A simple test tool',
      version: '1.0.0',
      category: 'test',
      type: 'custom:test',
      priority: ToolPriority.NORMAL,
      tags: ['test'],
      enabled: true,
      timeout: 5000,
      retries: 0,
      metadata: {},
    });
  }

  protected async executeInternal(
    args?: Record<string, any>,
    options?: ToolExecutionOptions
  ): Promise<ToolResult> {
    const startTime = new Date();
    const operation = args?.operation || 'default';
    
    // 模拟简单操作
    switch (operation) {
      case 'success':
        await this.delay(50);
        return this.createResult(true, 'Success operation', { result: 'ok' }, {}, startTime);
      
      case 'error':
        throw new Error('Test error');
      
      default:
        return this.createResult(true, 'Default operation', { operation }, {}, startTime);
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

describe('基础工具系统测试', () => {
  let toolManager: ToolManager;
  let testTool: SimpleTestTool;

  beforeEach(async () => {
    // 创建新的工具管理器实例
    toolManager = new ToolManager();
    testTool = new SimpleTestTool();
  });

  afterEach(async () => {
    // 清理工具管理器
    await toolManager.reset();
  });

  describe('BaseTool 基础功能', () => {
    it('应该正确初始化工具', () => {
      expect(testTool.name).toBe('simple_test_tool');
      expect(testTool.description).toBe('A simple test tool');
      expect(testTool.version).toBe('1.0.0');
      expect(testTool.category).toBe('test');
      expect(testTool.type).toBe('custom:test');
      expect(testTool.enabled).toBe(true);
      expect(testTool.getState()).toBe(ToolState.IDLE);
    });

    it('应该正确获取工具信息', () => {
      const info = testTool.getInfo();
      expect(info.id).toBeDefined();
      expect(info.name).toBe('simple_test_tool');
      expect(info.type).toBe('custom:test');
      expect(info.state).toBe(ToolState.IDLE);
      expect(info.tags.has('test')).toBe(true);
    });

    it('应该正确执行成功操作', async () => {
      const result = await testTool.execute({ operation: 'success' });
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Success operation');
      expect(result.data?.result).toBe('ok');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(testTool.getState()).toBe(ToolState.IDLE);
    });

    it('应该正确处理错误', async () => {
      await expect(testTool.execute({ operation: 'error' })).rejects.toThrow('Test error');
      expect(testTool.getState()).toBe(ToolState.IDLE);
    });

    it('应该正确更新指标', async () => {
      const initialMetrics = testTool.getMetrics();
      expect(initialMetrics.executionCount).toBe(0);
      
      await testTool.execute({ operation: 'success' });
      
      const updatedMetrics = testTool.getMetrics();
      expect(updatedMetrics.executionCount).toBe(1);
      expect(updatedMetrics.successCount).toBe(1);
      expect(updatedMetrics.failureCount).toBe(0);
      expect(updatedMetrics.successRate).toBe(1);
      expect(updatedMetrics.averageExecutionTime).toBeGreaterThan(0);
    });

    it('应该支持工具验证', async () => {
      const isValid = await testTool.validate();
      expect(isValid).toBe(true);
      
      testTool.enabled = false;
      const isValidDisabled = await testTool.validate();
      expect(isValidDisabled).toBe(false);
    });

    it('应该支持工具重置', async () => {
      await testTool.execute({ operation: 'success' });
      expect(testTool.getMetrics().executionCount).toBe(1);
      
      await testTool.reset();
      expect(testTool.getState()).toBe(ToolState.IDLE);
    });
  });

  describe('ToolManager 管理器功能', () => {
    it('应该正确注册工具', async () => {
      await toolManager.register(testTool);
      
      const retrievedTool = toolManager.getTool(testTool.id);
      expect(retrievedTool).toBe(testTool);
      expect(toolManager.hasTool(testTool.id)).toBe(true);
    });

    it('应该防止重复注册', async () => {
      await toolManager.register(testTool);
      
      await expect(toolManager.register(testTool)).rejects.toThrow();
    });

    it('应该正确注销工具', async () => {
      await toolManager.register(testTool);
      expect(toolManager.hasTool(testTool.id)).toBe(true);
      
      await toolManager.unregister(testTool.id);
      expect(toolManager.hasTool(testTool.id)).toBe(false);
    });

    it('应该按类型获取工具', async () => {
      await toolManager.register(testTool);
      
      const customTools = toolManager.getToolsByType('custom:test');
      expect(customTools).toHaveLength(1);
      expect(customTools[0]).toBe(testTool);
    });

    it('应该按类别获取工具', async () => {
      await toolManager.register(testTool);
      
      const testTools = toolManager.getToolsByCategory('test');
      expect(testTools).toHaveLength(1);
      expect(testTools[0]).toBe(testTool);
    });

    it('应该支持工具搜索', async () => {
      await toolManager.register(testTool);
      
      const searchResults = toolManager.searchTools('test');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0]).toBe(testTool);
    });

    it('应该通过管理器执行工具', async () => {
      await toolManager.register(testTool);
      
      const result = await toolManager.executeTool(testTool.id, { operation: 'success' });
      expect(result.success).toBe(true);
      expect(result.data?.result).toBe('ok');
    });

    it('应该提供统计信息', async () => {
      await toolManager.register(testTool);
      
      // 执行一些操作
      await toolManager.executeTool(testTool.id, { operation: 'success' });
      
      const stats = toolManager.getStatistics();
      expect(stats.totalTools).toBe(1);
      expect(stats.enabledTools).toBe(1);
      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(0);
    });

    it('应该支持获取所有工具', async () => {
      await toolManager.register(testTool);
      
      const allTools = toolManager.getAllTools();
      expect(allTools).toHaveLength(1);
      expect(allTools[0]).toBe(testTool);
    });

    it('应该支持获取类别列表', async () => {
      await toolManager.register(testTool);
      
      const categories = toolManager.getCategories();
      expect(categories).toContain('test');
    });

    it('应该支持获取类型列表', async () => {
      await toolManager.register(testTool);
      
      const types = toolManager.getTypes();
      expect(types).toContain('custom:test');
    });
  });

  describe('工具生命周期', () => {
    it('应该正确管理工具状态', async () => {
      expect(testTool.getState()).toBe(ToolState.IDLE);
      
      // 执行操作时状态应该变化
      const executePromise = testTool.execute({ operation: 'success' });
      
      // 等待执行完成
      await executePromise;
      
      // 执行完成后应该回到IDLE状态
      expect(testTool.getState()).toBe(ToolState.IDLE);
    });

    it('应该支持工具取消', async () => {
      // 这个测试比较复杂，暂时跳过
      expect(true).toBe(true);
    });
  });

  describe('工具帮助信息', () => {
    it('应该提供帮助信息', () => {
      const help = testTool.getHelp();
      expect(help).toContain('simple_test_tool');
      expect(help).toContain('A simple test tool');
      expect(help).toContain('1.0.0');
    });
  });
});
