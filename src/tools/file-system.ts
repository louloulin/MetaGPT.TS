import { BaseTool } from './base-tool';
import type { ToolConfig, ToolResult } from '../types/tool';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

/**
 * 文件系统工具
 * 提供基本的文件操作功能
 */
export class FileSystemTool extends BaseTool {
  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'file_system',
      description: 'Basic file system operations',
      version: '1.0.0',
      category: 'system',
      ...config,
    });
  }

  /**
   * 执行文件系统操作
   * @param args 执行参数
   * @returns 执行结果
   */
  async execute(args?: Record<string, any>): Promise<ToolResult> {
    try {
      // 验证操作类型
      const operation = args?.operation;
      if (!operation) {
        return this.createResult(false, 'No operation specified');
      }

      // 执行相应的操作
      switch (operation) {
        case 'read':
          return await this.readFile(args);
        case 'write':
          return await this.writeFile(args);
        case 'delete':
          return await this.deleteFile(args);
        case 'list':
          return await this.listDirectory(args);
        default:
          return this.createResult(false, `Unknown operation: ${operation}`);
      }
    } catch (error) {
      await this.handleError(error as Error);
      return this.createResult(
        false,
        `File system operation failed: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * 读取文件
   * @param args 参数
   * @returns 执行结果
   */
  private async readFile(args: Record<string, any>): Promise<ToolResult> {
    const path = args.path;
    if (!path) {
      return this.createResult(false, 'No file path provided');
    }

    try {
      const content = await fs.readFile(path, 'utf-8');
      return this.createResult(true, 'File read successfully', { content });
    } catch (error) {
      return this.createResult(
        false,
        `Failed to read file: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * 写入文件
   * @param args 参数
   * @returns 执行结果
   */
  private async writeFile(args: Record<string, any>): Promise<ToolResult> {
    const { path, content } = args;
    if (!path || content === undefined) {
      return this.createResult(false, 'Path and content are required');
    }

    try {
      // 确保目录存在
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, content);
      return this.createResult(true, 'File written successfully');
    } catch (error) {
      return this.createResult(
        false,
        `Failed to write file: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * 删除文件
   * @param args 参数
   * @returns 执行结果
   */
  private async deleteFile(args: Record<string, any>): Promise<ToolResult> {
    const path = args.path;
    if (!path) {
      return this.createResult(false, 'No file path provided');
    }

    try {
      await fs.unlink(path);
      return this.createResult(true, 'File deleted successfully');
    } catch (error) {
      return this.createResult(
        false,
        `Failed to delete file: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * 列出目录内容
   * @param args 参数
   * @returns 执行结果
   */
  private async listDirectory(args: Record<string, any>): Promise<ToolResult> {
    const path = args.path || '.';

    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      const files = entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: join(path, entry.name),
      }));

      return this.createResult(true, 'Directory listed successfully', { files });
    } catch (error) {
      return this.createResult(
        false,
        `Failed to list directory: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * 自定义错误处理
   */
  async handleError(error: Error): Promise<void> {
    await super.handleError(error);
    this.setState('lastError', error.message);
    this.setState('errorTimestamp', new Date().toISOString());
  }

  /**
   * 获取帮助信息
   */
  getHelp(): string {
    return `
Tool: ${this.name} (v${this.version})
Category: ${this.category}
Description: ${this.description}

Operations:
- read: Read file content
  Args: path (string)

- write: Write content to file
  Args: path (string), content (string)

- delete: Delete a file
  Args: path (string)

- list: List directory contents
  Args: path (string, optional)

Examples:
1. Read file:
   { operation: 'read', path: '/path/to/file.txt' }

2. Write file:
   { operation: 'write', path: '/path/to/file.txt', content: 'Hello World' }

3. Delete file:
   { operation: 'delete', path: '/path/to/file.txt' }

4. List directory:
   { operation: 'list', path: '/path/to/dir' }
    `.trim();
  }
} 