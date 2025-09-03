import { z } from 'zod';

/**
 * 工具类型模板字面量类型
 */
export type ToolType =
  | 'system'                   // 系统工具
  | 'search'                   // 搜索工具
  | 'code'                     // 代码工具
  | 'analysis'                 // 分析工具
  | 'visualization'            // 可视化工具
  | 'communication'            // 通信工具
  | 'data'                     // 数据工具
  | 'ai'                       // AI工具
  | `custom:${string}`;        // 自定义工具类型

/**
 * 工具ID品牌类型
 */
export type ToolId<T extends string = string> = T & { readonly __brand: 'ToolId' };

/**
 * 工具状态枚举
 */
export const ToolState = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type ToolStateType = typeof ToolState[keyof typeof ToolState];

/**
 * 工具优先级
 */
export const ToolPriority = {
  CRITICAL: 1000,
  HIGH: 800,
  NORMAL: 500,
  LOW: 200,
  BACKGROUND: 100,
} as const;

export type ToolPriorityLevel = typeof ToolPriority[keyof typeof ToolPriority];

/**
 * 增强的工具配置结构
 */
export const ToolConfigSchema = z.object({
  /** 工具ID */
  id: z.string().optional(),
  /** 工具名称 */
  name: z.string(),
  /** 工具描述 */
  description: z.string(),
  /** 工具版本 */
  version: z.string(),
  /** 工具类别 */
  category: z.string(),
  /** 工具类型 */
  type: z.string().default('custom'),
  /** 工具优先级 */
  priority: z.number().default(ToolPriority.NORMAL),
  /** 工具参数 */
  args: z.record(z.any()).optional(),
  /** 工具依赖 */
  dependencies: z.array(z.string()).optional(),
  /** 工具标签 */
  tags: z.array(z.string()).optional(),
  /** 是否启用 */
  enabled: z.boolean().optional(),
  /** 超时时间（毫秒） */
  timeout: z.number().positive().optional(),
  /** 重试次数 */
  retries: z.number().nonnegative().optional(),
  /** 元数据 */
  metadata: z.record(z.any()).optional(),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;

/**
 * 工具执行上下文结构
 */
export const ToolContextSchema = z.object({
  /** 工具ID */
  id: z.string(),
  /** 工具名称 */
  name: z.string(),
  /** 工具描述 */
  description: z.string(),
  /** 工具类型 */
  type: z.string(),
  /** 当前状态 */
  state: z.string().default(ToolState.IDLE),
  /** 执行参数 */
  args: z.record(z.any()).default({}),
  /** 工具状态数据 */
  stateData: z.record(z.any()).default({}),
  /** 执行历史 */
  history: z.array(z.any()).default([]),
  /** 性能指标 */
  metrics: z.object({
    executionCount: z.number().default(0),
    totalExecutionTime: z.number().default(0),
    averageExecutionTime: z.number().default(0),
    successCount: z.number().default(0),
    failureCount: z.number().default(0),
    lastExecutionTime: z.date().optional(),
  }).default({}),
  /** 环境ID */
  environmentId: z.string().optional(),
  /** 会话ID */
  sessionId: z.string().optional(),
  /** 元数据 */
  metadata: z.record(z.any()).default({}),
});

export type ToolContext = z.infer<typeof ToolContextSchema>;

/**
 * 工具执行结果结构
 */
export const ToolResultSchema = z.object({
  /** 工具ID */
  toolId: z.string(),
  /** 执行是否成功 */
  success: z.boolean(),
  /** 结果消息 */
  message: z.string(),
  /** 执行结果数据 */
  data: z.any().optional(),
  /** 错误信息 */
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    details: z.any().optional(),
  }).optional(),
  /** 执行时间（毫秒） */
  executionTime: z.number().nonnegative(),
  /** 开始时间 */
  startTime: z.date(),
  /** 结束时间 */
  endTime: z.date(),
  /** 资源使用情况 */
  resourceUsage: z.object({
    cpu: z.number().optional(),
    memory: z.number().optional(),
    network: z.number().optional(),
  }).optional(),
  /** 结果元数据 */
  metadata: z.record(z.any()).default({}),
  /** 输出文件路径 */
  outputFiles: z.array(z.string()).default([]),
  /** 警告信息 */
  warnings: z.array(z.string()).default([]),
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * 工具执行选项
 */
export interface ToolExecutionOptions {
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
  /** 是否异步执行 */
  async?: boolean;
  /** 进度回调 */
  onProgress?: (progress: number) => void;
  /** 环境ID */
  environmentId?: string;
  /** 会话ID */
  sessionId?: string;
  /** 执行上下文 */
  context?: Record<string, any>;
}

/**
 * 工具指标
 */
export interface ToolMetrics {
  /** 执行次数 */
  executionCount: number;
  /** 总执行时间 */
  totalExecutionTime: number;
  /** 平均执行时间 */
  averageExecutionTime: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 成功率 */
  successRate: number;
  /** 最后执行时间 */
  lastExecutionTime?: Date;
  /** 资源使用统计 */
  resourceUsage: {
    cpu: { min: number; max: number; avg: number };
    memory: { min: number; max: number; avg: number };
    network: { min: number; max: number; avg: number };
  };
}

/**
 * 工具事件类型
 */
export interface ToolEvents {
  'tool:created': (tool: ToolInfo) => void;
  'tool:started': (tool: ToolInfo) => void;
  'tool:completed': (tool: ToolInfo, result: ToolResult) => void;
  'tool:failed': (tool: ToolInfo, error: Error) => void;
  'tool:cancelled': (tool: ToolInfo) => void;
  'tool:progress': (tool: ToolInfo, progress: number) => void;
  'tool:state-changed': (tool: ToolInfo, oldState: ToolStateType, newState: ToolStateType) => void;
}

/**
 * 工具信息接口
 */
export interface ToolInfo {
  /** 工具ID */
  id: ToolId;
  /** 工具名称 */
  name: string;
  /** 工具类型 */
  type: ToolType;
  /** 当前状态 */
  state: ToolStateType;
  /** 创建时间 */
  createdAt: Date;
  /** 最后执行时间 */
  lastExecutedAt?: Date;
  /** 标签 */
  tags: Set<string>;
  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 增强的工具接口
 */
export interface Tool {
  /** 工具ID */
  readonly id: ToolId;
  /** 工具名称 */
  readonly name: string;
  /** 工具描述 */
  readonly description: string;
  /** 工具版本 */
  readonly version: string;
  /** 工具类别 */
  readonly category: string;
  /** 工具类型 */
  readonly type: ToolType;
  /** 工具上下文 */
  readonly context: ToolContext;
  /** 是否启用 */
  enabled: boolean;

  /**
   * 执行工具
   * @param args 执行参数
   * @param options 执行选项
   * @returns 执行结果
   */
  execute(args?: Record<string, any>, options?: ToolExecutionOptions): Promise<ToolResult>;

  /**
   * 验证工具是否可用
   * @returns 验证结果
   */
  validate(): Promise<boolean>;

  /**
   * 取消工具执行
   */
  cancel(): Promise<void>;

  /**
   * 重置工具状态
   */
  reset(): Promise<void>;

  /**
   * 获取工具状态
   */
  getState(): ToolStateType;

  /**
   * 获取工具信息
   */
  getInfo(): ToolInfo;

  /**
   * 获取工具指标
   */
  getMetrics(): ToolMetrics;

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

  /**
   * 序列化工具状态
   */
  serialize(): Record<string, any>;

  /**
   * 反序列化工具状态
   */
  deserialize(data: Record<string, any>): Promise<void>;
}

/**
 * 工具管理器接口
 */
export interface ToolManager {
  /**
   * 注册工具
   */
  register(tool: Tool): Promise<void>;

  /**
   * 注册多个工具
   */
  registerMany(tools: Tool[]): Promise<void>;

  /**
   * 注销工具
   */
  unregister(toolId: ToolId): Promise<void>;

  /**
   * 获取工具
   */
  getTool(toolId: ToolId): Tool | undefined;

  /**
   * 获取所有工具
   */
  getAllTools(): Tool[];

  /**
   * 按类型获取工具
   */
  getToolsByType(type: ToolType): Tool[];

  /**
   * 按类别获取工具
   */
  getToolsByCategory(category: string): Tool[];

  /**
   * 搜索工具
   */
  searchTools(query: string): Tool[];

  /**
   * 执行工具
   */
  executeTool(toolId: ToolId, args?: Record<string, any>, options?: ToolExecutionOptions): Promise<ToolResult>;

  /**
   * 批量执行工具
   */
  executeTools(executions: Array<{ toolId: ToolId; args?: Record<string, any>; options?: ToolExecutionOptions }>): Promise<ToolResult[]>;

  /**
   * 获取工具统计信息
   */
  getStatistics(): ToolManagerStatistics;

  /**
   * 重置所有工具
   */
  reset(): Promise<void>;
}

/**
 * 工具管理器统计信息
 */
export interface ToolManagerStatistics {
  /** 总工具数 */
  totalTools: number;
  /** 启用的工具数 */
  enabledTools: number;
  /** 按类型分组的工具数 */
  toolsByType: Record<ToolType, number>;
  /** 按类别分组的工具数 */
  toolsByCategory: Record<string, number>;
  /** 总执行次数 */
  totalExecutions: number;
  /** 成功执行次数 */
  successfulExecutions: number;
  /** 失败执行次数 */
  failedExecutions: number;
  /** 平均执行时间 */
  averageExecutionTime: number;
}

/**
 * 工具执行器接口
 */
export interface ToolExecutor {
  /**
   * 执行工具
   */
  execute(tool: Tool, args?: Record<string, any>, options?: ToolExecutionOptions): Promise<ToolResult>;

  /**
   * 取消执行
   */
  cancel(toolId: ToolId): Promise<void>;

  /**
   * 获取执行状态
   */
  getExecutionStatus(toolId: ToolId): string | undefined;

  /**
   * 获取正在执行的工具
   */
  getRunningTools(): ToolId[];
}