import { z } from 'zod';

/**
 * 工具配置结构
 */
export const ToolConfigSchema = z.object({
  name: z.string(),                    // 工具名称
  description: z.string(),             // 工具描述
  version: z.string(),                 // 工具版本
  category: z.string(),                // 工具类别
  args: z.record(z.any()).optional(), // 工具参数
  metadata: z.record(z.any()).optional(), // 元数据
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;

/**
 * 工具上下文结构
 */
export const ToolContextSchema = z.object({
  name: z.string(),
  description: z.string(),
  args: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  state: z.record(z.any()).optional(),
});

export type ToolContext = z.infer<typeof ToolContextSchema>;

/**
 * 工具执行结果结构
 */
export const ToolResultSchema = z.object({
  success: z.boolean(),                // 执行是否成功
  message: z.string(),                 // 结果消息
  data: z.any().optional(),           // 执行结果数据
  error: z.any().optional(),          // 错误信息
  metadata: z.record(z.any()).optional(), // 结果元数据
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * 工具接口
 */
export interface Tool {
  name: string;                       // 工具名称
  description: string;                // 工具描述
  version: string;                    // 工具版本
  category: string;                   // 工具类别
  context: ToolContext;              // 工具上下文

  /**
   * 执行工具
   * @param args 执行参数
   * @returns 执行结果
   */
  execute(args?: Record<string, any>): Promise<ToolResult>;

  /**
   * 验证工具是否可用
   * @returns 验证结果
   */
  validate(): Promise<boolean>;

  /**
   * 处理工具执行异常
   * @param error 错误对象
   */
  handleError(error: Error): Promise<void>;

  /**
   * 获取工具帮助信息
   * @returns 帮助信息
   */
  getHelp(): string;
} 