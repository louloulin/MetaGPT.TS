import { BaseTool } from './base-tool';
import type { ToolConfig, ToolResult, ToolExecutionOptions } from '../types/tool';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { logger } from '../utils/logger';

/**
 * 增强的文件系统工具
 * 提供类型安全的文件操作功能
 * 集成第一阶段完成的核心系统
 */
export class EnhancedFileSystemTool extends BaseTool {
  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'enhanced_file_system',
      description: 'Enhanced file system operations with type safety and advanced features',
      version: '2.0.0',
      category: 'system',
      type: 'system',
      tags: ['filesystem', 'io', 'files', 'enhanced'],
      ...config,
    });
  }

  /**
   * 实现具体的文件系统操作执行逻辑
   */
  protected async executeInternal(
    args?: Record<string, any>, 
    options?: ToolExecutionOptions
  ): Promise<ToolResult> {
    const startTime = new Date();
    
    // 验证操作类型
    const operation = args?.operation;
    if (!operation) {
      return this.createResult(false, 'No operation specified', undefined, {}, startTime);
    }

    logger.debug(`EnhancedFileSystemTool executing operation: ${operation}`, args);

    // 执行相应的操作
    switch (operation) {
      case 'read':
        return await this.readFile(args, startTime);
      case 'write':
        return await this.writeFile(args, startTime);
      case 'delete':
        return await this.deleteFile(args, startTime);
      case 'list':
        return await this.listDirectory(args, startTime);
      case 'exists':
        return await this.checkExists(args, startTime);
      case 'mkdir':
        return await this.createDirectory(args, startTime);
      case 'copy':
        return await this.copyFile(args, startTime);
      case 'move':
        return await this.moveFile(args, startTime);
      case 'stat':
        return await this.getFileStats(args, startTime);
      case 'search':
        return await this.searchFiles(args, startTime);
      default:
        return this.createResult(
          false, 
          `Unknown operation: ${operation}`, 
          undefined, 
          { 
            availableOperations: [
              'read', 'write', 'delete', 'list', 'exists', 
              'mkdir', 'copy', 'move', 'stat', 'search'
            ] 
          },
          startTime
        );
    }
  }

  /**
   * 读取文件
   */
  private async readFile(args: Record<string, any>, startTime: Date): Promise<ToolResult> {
    const { path, encoding = 'utf-8', maxSize = 10 * 1024 * 1024 } = args; // 10MB limit
    
    if (!path) {
      return this.createResult(false, 'File path is required', undefined, {}, startTime);
    }

    try {
      const stats = await fs.stat(path);
      
      if (stats.size > maxSize) {
        return this.createResult(
          false,
          `File too large: ${stats.size} bytes (max: ${maxSize} bytes)`,
          undefined,
          { operation: 'read', fileSize: stats.size, maxSize },
          startTime
        );
      }
      
      const content = await fs.readFile(path, encoding);
      
      return this.createResult(
        true, 
        'File read successfully', 
        { 
          content, 
          path,
          size: stats.size,
          encoding,
          lines: content.split('\n').length,
        },
        {
          operation: 'read',
          fileSize: stats.size,
          encoding,
        },
        startTime
      );
    } catch (error) {
      const err = error as Error;
      return this.createResult(
        false, 
        `Failed to read file: ${err.message}`, 
        undefined,
        { operation: 'read', error: err.name },
        startTime
      );
    }
  }

  /**
   * 写入文件
   */
  private async writeFile(args: Record<string, any>, startTime: Date): Promise<ToolResult> {
    const { path, content, encoding = 'utf-8', createDir = true, backup = false } = args;
    
    if (!path || content === undefined) {
      return this.createResult(false, 'Path and content are required', undefined, {}, startTime);
    }

    try {
      // 创建备份
      if (backup) {
        try {
          await fs.access(path);
          const backupPath = `${path}.backup.${Date.now()}`;
          await fs.copyFile(path, backupPath);
        } catch {
          // 文件不存在，无需备份
        }
      }

      // 确保目录存在
      if (createDir) {
        await fs.mkdir(dirname(path), { recursive: true });
      }
      
      await fs.writeFile(path, content, encoding);
      const stats = await fs.stat(path);
      
      return this.createResult(
        true, 
        'File written successfully', 
        { 
          path,
          size: stats.size,
          encoding,
          lines: content.split('\n').length,
        },
        {
          operation: 'write',
          fileSize: stats.size,
          encoding,
          backup,
        },
        startTime
      );
    } catch (error) {
      const err = error as Error;
      return this.createResult(
        false,
        `Failed to write file: ${err.message}`,
        undefined,
        { operation: 'write', error: err.name },
        startTime
      );
    }
  }

  /**
   * 删除文件或目录
   */
  private async deleteFile(args: Record<string, any>, startTime: Date): Promise<ToolResult> {
    const { path, recursive = false, force = false } = args;
    
    if (!path) {
      return this.createResult(false, 'Path is required', undefined, {}, startTime);
    }

    try {
      const stats = await fs.stat(path);
      
      if (stats.isDirectory()) {
        if (recursive) {
          await fs.rmdir(path, { recursive: true });
        } else {
          await fs.rmdir(path);
        }
      } else {
        await fs.unlink(path);
      }
      
      return this.createResult(
        true, 
        `${stats.isDirectory() ? 'Directory' : 'File'} deleted successfully`, 
        { path, type: stats.isDirectory() ? 'directory' : 'file' },
        { operation: 'delete', recursive, force },
        startTime
      );
    } catch (error) {
      const err = error as Error;
      if (!force) {
        return this.createResult(
          false,
          `Failed to delete: ${err.message}`,
          undefined,
          { operation: 'delete', error: err.name },
          startTime
        );
      }
      
      // 强制删除模式，忽略错误
      return this.createResult(
        true,
        'Delete operation completed (forced)',
        { path, forced: true },
        { operation: 'delete', force: true },
        startTime
      );
    }
  }

  /**
   * 列出目录内容
   */
  private async listDirectory(args: Record<string, any>, startTime: Date): Promise<ToolResult> {
    const { path = '.', detailed = false, recursive = false, filter } = args;

    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      let files = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = join(path, entry.name);
          const result: any = {
            name: entry.name,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            path: fullPath,
          };

          if (detailed) {
            try {
              const stats = await fs.stat(fullPath);
              result.size = stats.size;
              result.modified = stats.mtime;
              result.created = stats.birthtime;
              result.permissions = stats.mode;
            } catch (error) {
              // 忽略无法访问的文件
            }
          }

          if (recursive && entry.isDirectory()) {
            try {
              const subResult = await this.listDirectory({ path: fullPath, detailed, recursive }, startTime);
              if (subResult.success) {
                result.children = subResult.data?.files || [];
              }
            } catch (error) {
              // 忽略无法访问的子目录
            }
          }

          return result;
        })
      );

      // 应用过滤器
      if (filter) {
        const regex = new RegExp(filter, 'i');
        files = files.filter(file => regex.test(file.name));
      }

      return this.createResult(
        true, 
        'Directory listed successfully', 
        { files, path, count: files.length },
        { operation: 'list', detailed, recursive, filter },
        startTime
      );
    } catch (error) {
      const err = error as Error;
      return this.createResult(
        false,
        `Failed to list directory: ${err.message}`,
        undefined,
        { operation: 'list', error: err.name },
        startTime
      );
    }
  }

  /**
   * 检查文件/目录是否存在
   */
  private async checkExists(args: Record<string, any>, startTime: Date): Promise<ToolResult> {
    const { path } = args;
    
    if (!path) {
      return this.createResult(false, 'Path is required', undefined, {}, startTime);
    }

    try {
      await fs.access(path);
      const stats = await fs.stat(path);
      
      return this.createResult(
        true,
        'Path exists',
        {
          path,
          exists: true,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          size: stats.size,
          modified: stats.mtime,
        },
        { operation: 'exists' },
        startTime
      );
    } catch (error) {
      return this.createResult(
        true,
        'Path does not exist',
        { path, exists: false },
        { operation: 'exists' },
        startTime
      );
    }
  }

  /**
   * 创建目录
   */
  private async createDirectory(args: Record<string, any>, startTime: Date): Promise<ToolResult> {
    const { path, recursive = true } = args;

    if (!path) {
      return this.createResult(false, 'Path is required', undefined, {}, startTime);
    }

    try {
      await fs.mkdir(path, { recursive });

      return this.createResult(
        true,
        'Directory created successfully',
        { path, recursive },
        { operation: 'mkdir' },
        startTime
      );
    } catch (error) {
      const err = error as Error;
      return this.createResult(
        false,
        `Failed to create directory: ${err.message}`,
        undefined,
        { operation: 'mkdir', error: err.name },
        startTime
      );
    }
  }

  /**
   * 复制文件
   */
  private async copyFile(args: Record<string, any>, startTime: Date): Promise<ToolResult> {
    const { source, destination, overwrite = false } = args;

    if (!source || !destination) {
      return this.createResult(false, 'Source and destination paths are required', undefined, {}, startTime);
    }

    try {
      // 检查目标是否存在
      if (!overwrite) {
        try {
          await fs.access(destination);
          return this.createResult(
            false,
            'Destination already exists',
            undefined,
            { operation: 'copy', error: 'EEXIST' },
            startTime
          );
        } catch {
          // 目标不存在，可以继续
        }
      }

      // 确保目标目录存在
      await fs.mkdir(dirname(destination), { recursive: true });

      // 复制文件
      await fs.copyFile(source, destination);

      const stats = await fs.stat(destination);

      return this.createResult(
        true,
        'File copied successfully',
        { source, destination, size: stats.size },
        { operation: 'copy', overwrite },
        startTime
      );
    } catch (error) {
      const err = error as Error;
      return this.createResult(
        false,
        `Failed to copy file: ${err.message}`,
        undefined,
        { operation: 'copy', error: err.name },
        startTime
      );
    }
  }

  /**
   * 移动文件
   */
  private async moveFile(args: Record<string, any>, startTime: Date): Promise<ToolResult> {
    const { source, destination, overwrite = false } = args;

    if (!source || !destination) {
      return this.createResult(false, 'Source and destination paths are required', undefined, {}, startTime);
    }

    try {
      // 检查目标是否存在
      if (!overwrite) {
        try {
          await fs.access(destination);
          return this.createResult(
            false,
            'Destination already exists',
            undefined,
            { operation: 'move', error: 'EEXIST' },
            startTime
          );
        } catch {
          // 目标不存在，可以继续
        }
      }

      // 确保目标目录存在
      await fs.mkdir(dirname(destination), { recursive: true });

      // 移动文件
      await fs.rename(source, destination);

      const stats = await fs.stat(destination);

      return this.createResult(
        true,
        'File moved successfully',
        { source, destination, size: stats.size },
        { operation: 'move', overwrite },
        startTime
      );
    } catch (error) {
      const err = error as Error;
      return this.createResult(
        false,
        `Failed to move file: ${err.message}`,
        undefined,
        { operation: 'move', error: err.name },
        startTime
      );
    }
  }

  /**
   * 获取文件统计信息
   */
  private async getFileStats(args: Record<string, any>, startTime: Date): Promise<ToolResult> {
    const { path } = args;

    if (!path) {
      return this.createResult(false, 'Path is required', undefined, {}, startTime);
    }

    try {
      const stats = await fs.stat(path);

      return this.createResult(
        true,
        'File stats retrieved successfully',
        {
          path,
          size: stats.size,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          isSymbolicLink: stats.isSymbolicLink(),
          permissions: stats.mode,
          uid: stats.uid,
          gid: stats.gid,
          accessed: stats.atime,
          modified: stats.mtime,
          changed: stats.ctime,
          created: stats.birthtime,
        },
        { operation: 'stat' },
        startTime
      );
    } catch (error) {
      const err = error as Error;
      return this.createResult(
        false,
        `Failed to get file stats: ${err.message}`,
        undefined,
        { operation: 'stat', error: err.name },
        startTime
      );
    }
  }

  /**
   * 搜索文件
   */
  private async searchFiles(args: Record<string, any>, startTime: Date): Promise<ToolResult> {
    const { path = '.', pattern, recursive = true, maxResults = 100 } = args;

    if (!pattern) {
      return this.createResult(false, 'Search pattern is required', undefined, {}, startTime);
    }

    try {
      const results: any[] = [];
      const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');

      const searchDir = async (dirPath: string, depth = 0): Promise<void> => {
        if (results.length >= maxResults) return;

        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            if (results.length >= maxResults) break;

            const fullPath = join(dirPath, entry.name);

            if (regex.test(entry.name)) {
              const stats = await fs.stat(fullPath);
              results.push({
                name: entry.name,
                path: fullPath,
                isDirectory: entry.isDirectory(),
                isFile: entry.isFile(),
                size: stats.size,
                modified: stats.mtime,
              });
            }

            if (recursive && entry.isDirectory() && depth < 10) {
              await searchDir(fullPath, depth + 1);
            }
          }
        } catch (error) {
          // 忽略无法访问的目录
        }
      };

      await searchDir(path);

      return this.createResult(
        true,
        `Search completed, found ${results.length} matches`,
        { results, pattern, searchPath: path, count: results.length },
        { operation: 'search', recursive, maxResults },
        startTime
      );
    } catch (error) {
      const err = error as Error;
      return this.createResult(
        false,
        `Search failed: ${err.message}`,
        undefined,
        { operation: 'search', error: err.name },
        startTime
      );
    }
  }

  /**
   * 自定义错误处理
   */
  protected async onError(error: Error): Promise<void> {
    // 记录文件系统特定的错误信息
    this.context.stateData.lastError = error.message;
    this.context.stateData.errorTimestamp = new Date().toISOString();
    this.context.stateData.errorType = error.name;
  }

  /**
   * 获取增强的帮助信息
   */
  getHelp(): string {
    return `
${super.getHelp()}

Enhanced Operations:
- read: Read file content with size limits and encoding options
  Args: path (string), encoding? (string), maxSize? (number)

- write: Write content to file with backup and directory creation
  Args: path (string), content (string), encoding? (string), createDir? (boolean), backup? (boolean)

- delete: Delete file or directory with recursive and force options
  Args: path (string), recursive? (boolean), force? (boolean)

- list: List directory contents with detailed info and filtering
  Args: path? (string), detailed? (boolean), recursive? (boolean), filter? (string)

- exists: Check if path exists with detailed information
  Args: path (string)

- mkdir: Create directory with recursive option
  Args: path (string), recursive? (boolean)

- copy: Copy file with overwrite protection
  Args: source (string), destination (string), overwrite? (boolean)

- move: Move/rename file with overwrite protection
  Args: source (string), destination (string), overwrite? (boolean)

- stat: Get detailed file statistics
  Args: path (string)

- search: Search for files by pattern
  Args: path (string), pattern (string), recursive? (boolean)

Examples:
1. Read file with size limit:
   { operation: 'read', path: '/path/to/file.txt', maxSize: 1048576 }

2. Write file with backup:
   { operation: 'write', path: '/path/to/file.txt', content: 'Hello', backup: true }

3. List directory with details:
   { operation: 'list', path: '/path/to/dir', detailed: true, recursive: true }

4. Search files:
   { operation: 'search', path: '/path/to/search', pattern: '*.ts', recursive: true }
    `.trim();
  }
}
