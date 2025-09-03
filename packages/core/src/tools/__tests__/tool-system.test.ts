/**
 * 工具系统测试
 * 测试增强的工具基类、管理器和执行器
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BaseTool } from '../base-tool';
import { ToolManager } from '../tool-registry';
import { EnhancedFileSystemTool } from '../enhanced-file-system';
import type { ToolConfig, ToolResult, ToolExecutionOptions } from '../../types/tool';
import { ToolState } from '../../types/tool';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// 测试工具实现
class TestTool extends BaseTool {
  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'test_tool',
      description: 'A test tool for unit testing',
      version: '1.0.0',
      category: 'test',
      type: 'custom',
      tags: ['test', 'unit'],
      ...config,
    });
  }

  protected async executeInternal(
    args?: Record<string, any>,
    options?: ToolExecutionOptions
  ): Promise<ToolResult> {
    const startTime = new Date();
    const operation = args?.operation || 'default';
    
    // 模拟不同的操作
    switch (operation) {
      case 'success':
        await this.delay(100);
        return this.createResult(true, 'Operation completed successfully', { result: 'success' }, {}, startTime);
      
      case 'error':
        throw new Error('Simulated error');
      
      case 'slow':
        await this.delay(2000);
        return this.createResult(true, 'Slow operation completed', { result: 'slow' }, {}, startTime);
      
      case 'progress':
        for (let i = 0; i <= 100; i += 20) {
          await this.delay(50);
          options?.onProgress?.(i);
        }
        return this.createResult(true, 'Progress operation completed', { result: 'progress' }, {}, startTime);
      
      default:
        return this.createResult(true, 'Default operation', { operation }, {}, startTime);
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

describe('工具系统测试', () => {
  let toolManager: ToolManager;
  let testTool: TestTool;
  let fileSystemTool: EnhancedFileSystemTool;
  let tempDir: string;

  beforeEach(async () => {
    // 创建新的工具管理器实例
    toolManager = new ToolManager();
    
    // 创建测试工具
    testTool = new TestTool();
    fileSystemTool = new EnhancedFileSystemTool();
    
    // 创建临时目录
    tempDir = join(tmpdir(), `tool-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理工具管理器
    await toolManager.reset();
    
    // 清理临时目录
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('BaseTool 基础功能', () => {
    it('应该正确初始化工具', () => {
      expect(testTool.name).toBe('test_tool');
      expect(testTool.description).toBe('A test tool for unit testing');
      expect(testTool.version).toBe('1.0.0');
      expect(testTool.category).toBe('test');
      expect(testTool.type).toBe('custom');
      expect(testTool.enabled).toBe(true);
      expect(testTool.getState()).toBe(ToolState.IDLE);
    });

    it('应该正确获取工具信息', () => {
      const info = testTool.getInfo();
      expect(info.id).toBeDefined();
      expect(info.name).toBe('test_tool');
      expect(info.type).toBe('custom');
      expect(info.state).toBe(ToolState.IDLE);
      expect(info.tags.has('test')).toBe(true);
      expect(info.tags.has('unit')).toBe(true);
    });

    it('应该正确执行成功操作', async () => {
      const result = await testTool.execute({ operation: 'success' });
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Operation completed successfully');
      expect(result.data?.result).toBe('success');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(testTool.getState()).toBe(ToolState.IDLE);
    });

    it('应该正确处理错误', async () => {
      await expect(testTool.execute({ operation: 'error' })).rejects.toThrow('Simulated error');
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

    it('应该支持进度回调', async () => {
      const progressValues: number[] = [];
      
      await testTool.execute(
        { operation: 'progress' },
        {
          onProgress: (progress) => {
            progressValues.push(progress);
          }
        }
      );
      
      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues).toContain(100);
    });

    it('应该支持序列化和反序列化', async () => {
      // 执行一些操作以生成状态
      await testTool.execute({ operation: 'success' });
      
      const serialized = testTool.serialize();
      expect(serialized.id).toBeDefined();
      expect(serialized.name).toBe('test_tool');
      expect(serialized.metrics).toBeDefined();
      
      const newTool = new TestTool();
      await newTool.deserialize(serialized);
      
      expect(newTool.getMetrics().executionCount).toBe(1);
    });

    it('应该支持工具重置', async () => {
      await testTool.execute({ operation: 'success' });
      expect(testTool.getMetrics().executionCount).toBe(1);
      
      await testTool.reset();
      expect(testTool.getState()).toBe(ToolState.IDLE);
    });

    it('应该支持工具验证', async () => {
      const isValid = await testTool.validate();
      expect(isValid).toBe(true);
      
      testTool.enabled = false;
      const isValidDisabled = await testTool.validate();
      expect(isValidDisabled).toBe(false);
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

    it('应该支持批量注册', async () => {
      const tools = [testTool, fileSystemTool];
      await toolManager.registerMany(tools);
      
      expect(toolManager.getAllTools()).toHaveLength(2);
      expect(toolManager.hasTool(testTool.id)).toBe(true);
      expect(toolManager.hasTool(fileSystemTool.id)).toBe(true);
    });

    it('应该正确注销工具', async () => {
      await toolManager.register(testTool);
      expect(toolManager.hasTool(testTool.id)).toBe(true);
      
      await toolManager.unregister(testTool.id);
      expect(toolManager.hasTool(testTool.id)).toBe(false);
    });

    it('应该按类型获取工具', async () => {
      await toolManager.register(testTool);
      await toolManager.register(fileSystemTool);
      
      const customTools = toolManager.getToolsByType('custom');
      const systemTools = toolManager.getToolsByType('system');
      
      expect(customTools).toHaveLength(1);
      expect(systemTools).toHaveLength(1);
      expect(customTools[0]).toBe(testTool);
      expect(systemTools[0]).toBe(fileSystemTool);
    });

    it('应该按类别获取工具', async () => {
      await toolManager.register(testTool);
      await toolManager.register(fileSystemTool);
      
      const testTools = toolManager.getToolsByCategory('test');
      const systemTools = toolManager.getToolsByCategory('system');
      
      expect(testTools).toHaveLength(1);
      expect(systemTools).toHaveLength(1);
    });

    it('应该支持工具搜索', async () => {
      await toolManager.register(testTool);
      await toolManager.register(fileSystemTool);
      
      const searchResults = toolManager.searchTools('test');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0]).toBe(testTool);
      
      const fileResults = toolManager.searchTools('file');
      expect(fileResults).toHaveLength(1);
      expect(fileResults[0]).toBe(fileSystemTool);
    });

    it('应该通过管理器执行工具', async () => {
      await toolManager.register(testTool);
      
      const result = await toolManager.executeTool(testTool.id, { operation: 'success' });
      expect(result.success).toBe(true);
      expect(result.data?.result).toBe('success');
    });

    it('应该支持批量执行工具', async () => {
      await toolManager.register(testTool);
      
      const executions = [
        { toolId: testTool.id, args: { operation: 'success' } },
        { toolId: testTool.id, args: { operation: 'default' } },
      ];
      
      const results = await toolManager.executeTools(executions);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('应该提供统计信息', async () => {
      await toolManager.register(testTool);
      await toolManager.register(fileSystemTool);
      
      // 执行一些操作
      await toolManager.executeTool(testTool.id, { operation: 'success' });
      
      const stats = toolManager.getStatistics();
      expect(stats.totalTools).toBe(2);
      expect(stats.enabledTools).toBe(2);
      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(0);
    });
  });

  describe('EnhancedFileSystemTool 文件系统工具', () => {
    it('应该正确读取文件', async () => {
      const testFile = join(tempDir, 'test.txt');
      const content = 'Hello, World!';
      await fs.writeFile(testFile, content);
      
      const result = await fileSystemTool.execute({
        operation: 'read',
        path: testFile,
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.content).toBe(content);
      expect(result.data?.size).toBe(content.length);
    });

    it('应该正确写入文件', async () => {
      const testFile = join(tempDir, 'write-test.txt');
      const content = 'Test content';
      
      const result = await fileSystemTool.execute({
        operation: 'write',
        path: testFile,
        content,
      });
      
      expect(result.success).toBe(true);
      
      const writtenContent = await fs.readFile(testFile, 'utf-8');
      expect(writtenContent).toBe(content);
    });

    it('应该正确列出目录', async () => {
      // 创建测试文件
      await fs.writeFile(join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(join(tempDir, 'file2.txt'), 'content2');
      await fs.mkdir(join(tempDir, 'subdir'));
      
      const result = await fileSystemTool.execute({
        operation: 'list',
        path: tempDir,
        detailed: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.files).toHaveLength(3);
      expect(result.data?.count).toBe(3);
    });

    it('应该正确检查文件存在性', async () => {
      const testFile = join(tempDir, 'exists-test.txt');
      await fs.writeFile(testFile, 'content');
      
      const existsResult = await fileSystemTool.execute({
        operation: 'exists',
        path: testFile,
      });
      
      expect(existsResult.success).toBe(true);
      expect(existsResult.data?.exists).toBe(true);
      
      const notExistsResult = await fileSystemTool.execute({
        operation: 'exists',
        path: join(tempDir, 'nonexistent.txt'),
      });
      
      expect(notExistsResult.success).toBe(true);
      expect(notExistsResult.data?.exists).toBe(false);
    });

    it('应该正确搜索文件', async () => {
      // 创建测试文件
      await fs.writeFile(join(tempDir, 'test1.ts'), 'typescript');
      await fs.writeFile(join(tempDir, 'test2.js'), 'javascript');
      await fs.writeFile(join(tempDir, 'readme.md'), 'markdown');
      
      const result = await fileSystemTool.execute({
        operation: 'search',
        path: tempDir,
        pattern: '*.ts',
        recursive: false,
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(1);
      expect(result.data?.results[0].name).toBe('test1.ts');
    });
  });
});
