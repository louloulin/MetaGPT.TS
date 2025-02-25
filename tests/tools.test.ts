import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { BaseTool } from '../src/tools/base-tool';
import { FileSystemTool } from '../src/tools/file-system';
import type { ToolConfig, ToolResult } from '../src/types/tool';
import { promises as fs } from 'fs';
import { join } from 'path';

// 创建测试工具类
class TestTool extends BaseTool {
  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'test_tool',
      description: 'Test tool',
      version: '1.0.0',
      category: 'test',
      ...config,
    });
  }

  async execute(args?: Record<string, any>): Promise<ToolResult> {
    const input = args?.input || 'default';
    return this.createResult(true, `Processed: ${input}`);
  }
}

describe('Tool System', () => {
  describe('BaseTool', () => {
    test('should initialize correctly', () => {
      const tool = new TestTool({
        name: 'custom_tool',
        description: 'Custom tool',
        version: '2.0.0',
        category: 'custom',
      });

      expect(tool.name).toBe('custom_tool');
      expect(tool.description).toBe('Custom tool');
      expect(tool.version).toBe('2.0.0');
      expect(tool.category).toBe('custom');
    });

    test('should handle args correctly', async () => {
      const tool = new TestTool();
      const result = await tool.execute({ input: 'test input' });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Processed: test input');
    });

    test('should validate tool availability', async () => {
      const tool = new TestTool();
      const isValid = await tool.validate();
      expect(isValid).toBe(true);
    });

    test('should provide help information', () => {
      const tool = new TestTool();
      const help = tool.getHelp();
      expect(help).toContain('Test tool');
      expect(help).toContain('1.0.0');
      expect(help).toContain('test');
    });
  });

  describe('FileSystemTool', () => {
    const testDir = './test-files';
    const testFile = join(testDir, 'test.txt');
    const testContent = 'Hello, World!';

    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch (error) {
        console.error('Failed to cleanup:', error);
      }
    });

    test('should write and read file', async () => {
      const tool = new FileSystemTool();

      // Write file
      const writeResult = await tool.execute({
        operation: 'write',
        path: testFile,
        content: testContent,
      });
      expect(writeResult.success).toBe(true);

      // Read file
      const readResult = await tool.execute({
        operation: 'read',
        path: testFile,
      });
      expect(readResult.success).toBe(true);
      expect(readResult.data?.content).toBe(testContent);
    });

    test('should list directory', async () => {
      const tool = new FileSystemTool();

      // Create test files
      await fs.writeFile(join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(join(testDir, 'subdir'), { recursive: true });

      const result = await tool.execute({
        operation: 'list',
        path: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.files).toHaveLength(3);
      expect(result.data?.files.some((f: any) => f.name === 'file1.txt')).toBe(true);
      expect(result.data?.files.some((f: any) => f.name === 'subdir' && f.isDirectory)).toBe(true);
    });

    test('should delete file', async () => {
      const tool = new FileSystemTool();

      // Create and then delete file
      await fs.writeFile(testFile, testContent);
      const result = await tool.execute({
        operation: 'delete',
        path: testFile,
      });

      expect(result.success).toBe(true);
      await expect(fs.access(testFile)).rejects.toThrow();
    });

    test('should handle missing file', async () => {
      const tool = new FileSystemTool();

      const result = await tool.execute({
        operation: 'read',
        path: join(testDir, 'non-existent.txt'),
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to read file');
    });

    test('should handle invalid operations', async () => {
      const tool = new FileSystemTool();

      const result = await tool.execute({
        operation: 'invalid',
        path: testFile,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown operation');
    });

    test.skip('should track errors', async () => {
      const tool = new FileSystemTool();

      await tool.execute({
        operation: 'read',
        path: join(testDir, 'non-existent.txt'),
      });

      expect(tool.getState('lastError')).toBeDefined();
      expect(tool.getState('errorTimestamp')).toBeDefined();
    });
  });
}); 