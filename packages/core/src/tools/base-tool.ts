import { z } from 'zod';
import type { Tool, ToolConfig, ToolContext, ToolResult } from '../types/tool';
import { ToolContextSchema, ToolResultSchema } from '../types/tool';

/**
 * 工具基类
 * 提供工具系统的基础功能实现
 */
export abstract class BaseTool implements Tool {
  name: string;
  description: string;
  version: string;
  category: string;
  context: ToolContext;

  constructor(config: ToolConfig) {
    // 验证配置
    const validConfig = z.object({
      name: z.string(),
      description: z.string(),
      version: z.string(),
      category: z.string(),
      args: z.record(z.any()).optional(),
      metadata: z.record(z.any()).optional(),
    }).parse(config);

    this.name = validConfig.name;
    this.description = validConfig.description;
    this.version = validConfig.version;
    this.category = validConfig.category;

    // 构建上下文
    this.context = ToolContextSchema.parse({
      name: validConfig.name,
      description: validConfig.description,
      args: validConfig.args || {},
      metadata: validConfig.metadata || {},
      state: {},
    });
  }

  /**
   * 执行工具
   * 子类必须实现此方法
   */
  abstract execute(args?: Record<string, any>): Promise<ToolResult>;

  /**
   * 验证工具是否可用
   * 子类可以覆盖此方法以提供自定义验证
   */
  async validate(): Promise<boolean> {
    return true;
  }

  /**
   * 处理工具执行异常
   * @param error 错误对象
   */
  async handleError(error: Error): Promise<void> {
    console.error(`Tool ${this.name} failed:`, error);
    // 子类可以覆盖此方法以提供自定义错误处理
  }

  /**
   * 获取工具帮助信息
   * 子类可以覆盖此方法以提供更详细的帮助信息
   */
  getHelp(): string {
    return `
Tool: ${this.name} (v${this.version})
Category: ${this.category}
Description: ${this.description}

Arguments:
${this.formatArgs()}
    `.trim();
  }

  /**
   * 创建工具执行结果
   * @param success 是否成功
   * @param message 结果消息
   * @param data 结果数据
   * @param error 错误信息
   * @param metadata 结果元数据
   */
  protected createResult(
    success: boolean,
    message: string,
    data?: any,
    error?: any,
    metadata?: Record<string, any>
  ): ToolResult {
    return ToolResultSchema.parse({
      success,
      message,
      data,
      error,
      metadata,
    });
  }

  /**
   * 获取工具参数
   * @param key 参数键
   * @returns 参数值
   */
  protected getArg<T>(key: string): T | undefined {
    return this.context.args?.[key] as T;
  }

  /**
   * 设置工具参数
   * @param key 参数键
   * @param value 参数值
   */
  protected setArg<T>(key: string, value: T): void {
    if (!this.context.args) {
      this.context.args = {};
    }
    this.context.args[key] = value;
  }

  /**
   * 获取工具状态
   * @param key 状态键
   * @returns 状态值
   */
  protected getState<T>(key: string): T | undefined {
    return this.context.state?.[key] as T;
  }

  /**
   * 设置工具状态
   * @param key 状态键
   * @param value 状态值
   */
  protected setState<T>(key: string, value: T): void {
    if (!this.context.state) {
      this.context.state = {};
    }
    this.context.state[key] = value;
  }

  /**
   * 格式化参数说明
   */
  private formatArgs(): string {
    const args = this.context.args || {};
    return Object.entries(args)
      .map(([key, value]) => `- ${key}: ${typeof value}`)
      .join('\n');
  }
} 