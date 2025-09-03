/**
 * @module ToolManager
 * @category Tools
 *
 * 增强的工具管理器，集成第一阶段完成的核心系统
 */

import { EventEmitter } from 'events';
import { MessageRouter } from '../messaging/router';
import { logger } from '../utils/logger';
import type {
  Tool,
  ToolId,
  ToolType,
  ToolManager as IToolManager,
  ToolManagerStatistics,
  ToolExecutor,
  ToolResult,
  ToolExecutionOptions,
  ToolEvents
} from '../types/tool';

/**
 * 增强的工具管理器
 * 集成序列化、消息路由等核心系统
 * 充分利用TypeScript高级特性
 */
export class ToolManager implements IToolManager {
  private static instance: ToolManager;
  private tools: Map<ToolId, Tool> = new Map();
  private categories: Map<string, Set<ToolId>> = new Map();
  private types: Map<ToolType, Set<ToolId>> = new Map();
  private tags: Map<string, Set<ToolId>> = new Map();
  private eventEmitter: EventEmitter;
  private messageRouter: MessageRouter;
  private executor: ToolExecutor;

  /**
   * 获取单例实例
   */
  public static getInstance(): ToolManager {
    if (!ToolManager.instance) {
      ToolManager.instance = new ToolManager();
    }
    return ToolManager.instance;
  }

  private constructor() {
    // 初始化事件发射器
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(1000);

    // 初始化消息路由器
    this.messageRouter = new MessageRouter({
      maxConcurrency: 50,
      enableMetrics: true,
    });

    // 初始化工具执行器
    this.executor = new ToolExecutorImpl();

    logger.info('Tool Manager initialized');
  }

  /**
   * 注册工具
   * @param tool 工具实例
   */
  public async register(tool: Tool): Promise<void> {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool with ID '${tool.id}' is already registered`);
    }

    // 验证工具
    const isValid = await tool.validate();
    if (!isValid) {
      throw new Error(`Tool '${tool.name}' validation failed`);
    }

    // 注册工具
    this.tools.set(tool.id, tool);

    // 添加到类别索引
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set());
    }
    this.categories.get(tool.category)?.add(tool.id);

    // 添加到类型索引
    if (!this.types.has(tool.type)) {
      this.types.set(tool.type, new Set());
    }
    this.types.get(tool.type)?.add(tool.id);

    // 添加到标签索引
    const toolInfo = tool.getInfo();
    for (const tag of toolInfo.tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag)?.add(tool.id);
    }

    // 监听工具事件
    this.setupToolEventListeners(tool);

    logger.info(`Registered tool: ${tool.name} (${tool.id}) - category: ${tool.category}, type: ${tool.type}`);
    this.eventEmitter.emit('tool:registered', tool.getInfo());
  }

  /**
   * 批量注册工具
   * @param tools 工具实例数组
   */
  public async registerMany(tools: Tool[]): Promise<void> {
    const results = await Promise.allSettled(
      tools.map(tool => this.register(tool))
    );

    const failed = results
      .map((result, index) => ({ result, tool: tools[index] }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, tool }) => ({
        tool: tool.name,
        error: (result as PromiseRejectedResult).reason
      }));

    if (failed.length > 0) {
      logger.warn(`Failed to register ${failed.length} tools:`, failed);
    }

    logger.info(`Registered ${tools.length - failed.length}/${tools.length} tools`);
  }

  /**
   * 注销工具
   * @param toolId 工具ID
   */
  public async unregister(toolId: ToolId): Promise<void> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool with ID '${toolId}' is not registered`);
    }

    // 取消正在执行的任务
    await tool.cancel();

    // 从类别索引中移除
    this.categories.get(tool.category)?.delete(toolId);
    if (this.categories.get(tool.category)?.size === 0) {
      this.categories.delete(tool.category);
    }

    // 从类型索引中移除
    this.types.get(tool.type)?.delete(toolId);
    if (this.types.get(tool.type)?.size === 0) {
      this.types.delete(tool.type);
    }

    // 从标签索引中移除
    const toolInfo = tool.getInfo();
    for (const tag of toolInfo.tags) {
      this.tags.get(tag)?.delete(toolId);
      if (this.tags.get(tag)?.size === 0) {
        this.tags.delete(tag);
      }
    }

    // 清理工具资源
    if (typeof (tool as any).dispose === 'function') {
      await (tool as any).dispose();
    }

    this.tools.delete(toolId);
    logger.info(`Unregistered tool: ${tool.name} (${toolId})`);
    this.eventEmitter.emit('tool:unregistered', toolInfo);
  }

  /**
   * 获取工具
   * @param toolId 工具ID
   * @returns 工具实例或undefined
   */
  public getTool(toolId: ToolId): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * 获取所有注册的工具
   * @returns 所有工具的数组
   */
  public getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按类型获取工具
   * @param type 工具类型
   * @returns 指定类型的工具数组
   */
  public getToolsByType(type: ToolType): Tool[] {
    const toolIds = this.types.get(type);
    if (!toolIds) {
      return [];
    }

    return Array.from(toolIds)
      .map(id => this.tools.get(id))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  /**
   * 按类别获取工具
   * @param category 类别名称
   * @returns 指定类别的工具数组
   */
  public getToolsByCategory(category: string): Tool[] {
    const toolIds = this.categories.get(category);
    if (!toolIds) {
      return [];
    }

    return Array.from(toolIds)
      .map(id => this.tools.get(id))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  /**
   * 按标签获取工具
   * @param tag 标签名称
   * @returns 包含指定标签的工具数组
   */
  public getToolsByTag(tag: string): Tool[] {
    const toolIds = this.tags.get(tag);
    if (!toolIds) {
      return [];
    }

    return Array.from(toolIds)
      .map(id => this.tools.get(id))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  /**
   * 搜索工具
   * @param query 搜索查询
   * @returns 匹配的工具数组
   */
  public searchTools(query: string): Tool[] {
    const lowerQuery = query.toLowerCase();
    const results: Tool[] = [];

    for (const tool of this.tools.values()) {
      const toolInfo = tool.getInfo();

      // 搜索名称、描述、类别、类型和标签
      if (
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.category.toLowerCase().includes(lowerQuery) ||
        tool.type.toLowerCase().includes(lowerQuery) ||
        Array.from(toolInfo.tags).some(tag => tag.toLowerCase().includes(lowerQuery))
      ) {
        results.push(tool);
      }
    }

    return results;
  }

  /**
   * 获取所有工具类别
   * @returns 所有类别名称的数组
   */
  public getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * 获取所有工具类型
   * @returns 所有类型的数组
   */
  public getTypes(): ToolType[] {
    return Array.from(this.types.keys());
  }

  /**
   * 获取所有标签
   * @returns 所有标签的数组
   */
  public getTags(): string[] {
    return Array.from(this.tags.keys());
  }

  /**
   * 执行工具
   * @param toolId 工具ID
   * @param args 工具参数
   * @param options 执行选项
   * @returns 工具执行结果
   */
  public async executeTool(
    toolId: ToolId,
    args?: Record<string, any>,
    options?: ToolExecutionOptions
  ): Promise<ToolResult> {
    const tool = this.getTool(toolId);
    if (!tool) {
      throw new Error(`Tool with ID '${toolId}' is not registered`);
    }

    if (!tool.enabled) {
      throw new Error(`Tool '${tool.name}' is disabled`);
    }

    return await this.executor.execute(tool, args, options);
  }

  /**
   * 批量执行工具
   * @param executions 执行配置数组
   * @returns 执行结果数组
   */
  public async executeTools(
    executions: Array<{
      toolId: ToolId;
      args?: Record<string, any>;
      options?: ToolExecutionOptions
    }>
  ): Promise<ToolResult[]> {
    const results = await Promise.allSettled(
      executions.map(({ toolId, args, options }) =>
        this.executeTool(toolId, args, options)
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const execution = executions[index];
        // const tool = this.getTool(execution.toolId);
        return {
          toolId: execution.toolId,
          success: false,
          message: `Execution failed: ${result.reason.message}`,
          error: {
            code: result.reason.name || 'ExecutionError',
            message: result.reason.message,
            stack: result.reason.stack,
          },
          executionTime: 0,
          startTime: new Date(),
          endTime: new Date(),
          metadata: {},
          outputFiles: [],
          warnings: [],
        } as ToolResult;
      }
    });
  }

  /**
   * 获取工具统计信息
   * @returns 统计信息
   */
  public getStatistics(): ToolManagerStatistics {
    const tools = this.getAllTools();
    const enabledTools = tools.filter(tool => tool.enabled);

    const toolsByType = {} as Record<ToolType, number>;
    const toolsByCategory = {} as Record<string, number>;

    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let totalExecutionTime = 0;

    for (const tool of tools) {
      // 按类型统计
      toolsByType[tool.type] = (toolsByType[tool.type] || 0) + 1;

      // 按类别统计
      toolsByCategory[tool.category] = (toolsByCategory[tool.category] || 0) + 1;

      // 执行统计
      const metrics = tool.getMetrics();
      totalExecutions += metrics.executionCount;
      successfulExecutions += metrics.successCount;
      failedExecutions += metrics.failureCount;
      totalExecutionTime += metrics.totalExecutionTime;
    }

    return {
      totalTools: tools.length,
      enabledTools: enabledTools.length,
      toolsByType,
      toolsByCategory,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime: totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0,
    };
  }

  /**
   * 检查工具是否已注册
   * @param toolId 工具ID
   * @returns 如果工具已注册则返回true
   */
  public hasTool(toolId: ToolId): boolean {
    return this.tools.has(toolId);
  }

  /**
   * 重置注册表（移除所有工具）
   * 主要用于测试
   */
  public async reset(): Promise<void> {
    // 注销所有工具
    const toolIds = Array.from(this.tools.keys());
    await Promise.all(toolIds.map(id => this.unregister(id)));

    // 清理索引
    this.categories.clear();
    this.types.clear();
    this.tags.clear();

    // 清理事件监听器
    this.eventEmitter.removeAllListeners();

    // 停止消息路由器
    try {
      await this.messageRouter.stop();
    } catch (error) {
      logger.warn('Failed to stop message router:', error);
    }

    logger.info('Tool manager reset');
  }

  /**
   * 设置工具事件监听器
   */
  private setupToolEventListeners(tool: Tool): void {
    if (typeof (tool as any).on === 'function') {
      const toolAny = tool as any;

      toolAny.on('tool:started', (info: any) => {
        this.eventEmitter.emit('tool:started', info);
      });

      toolAny.on('tool:completed', (info: any, result: ToolResult) => {
        this.eventEmitter.emit('tool:completed', info, result);
      });

      toolAny.on('tool:failed', (info: any, error: Error) => {
        this.eventEmitter.emit('tool:failed', info, error);
      });

      toolAny.on('tool:cancelled', (info: any) => {
        this.eventEmitter.emit('tool:cancelled', info);
      });
    }
  }

  /**
   * 事件监听器方法
   */
  public on<K extends keyof ToolEvents>(event: K, listener: ToolEvents[K]): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  /**
   * 移除事件监听器
   */
  public off<K extends keyof ToolEvents>(event: K, listener: ToolEvents[K]): this {
    this.eventEmitter.off(event, listener);
    return this;
  }

  /**
   * 序列化管理器状态
   */
  public serialize(): Record<string, any> {
    const toolsData = Array.from(this.tools.entries()).map(([id, tool]) => ({
      id,
      data: tool.serialize(),
    }));

    return {
      tools: toolsData,
      statistics: this.getStatistics(),
    };
  }

  /**
   * 反序列化管理器状态
   */
  public async deserialize(data: Record<string, any>): Promise<void> {
    if (data.tools && Array.isArray(data.tools)) {
      for (const { id, data: toolData } of data.tools) {
        const tool = this.getTool(id as ToolId);
        if (tool) {
          await tool.deserialize(toolData);
        }
      }
    }

    logger.info('Tool manager state deserialized');
  }
}

/**
 * 工具执行器实现
 */
class ToolExecutorImpl implements ToolExecutor {
  private runningTools: Map<ToolId, Promise<ToolResult>> = new Map();

  /**
   * 执行工具
   */
  async execute(
    tool: Tool,
    args?: Record<string, any>,
    options?: ToolExecutionOptions
  ): Promise<ToolResult> {
    if (this.runningTools.has(tool.id)) {
      throw new Error(`Tool ${tool.name} is already running`);
    }

    const executionPromise = tool.execute(args, options);
    this.runningTools.set(tool.id, executionPromise);

    try {
      const result = await executionPromise;
      return result;
    } finally {
      this.runningTools.delete(tool.id);
    }
  }

  /**
   * 取消执行
   */
  async cancel(toolId: ToolId): Promise<void> {
    const executionPromise = this.runningTools.get(toolId);
    if (executionPromise) {
      // 这里可以实现更复杂的取消逻辑
      this.runningTools.delete(toolId);
    }
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(toolId: ToolId): string | undefined {
    return this.runningTools.has(toolId) ? 'running' : undefined;
  }

  /**
   * 获取正在执行的工具
   */
  getRunningTools(): ToolId[] {
    return Array.from(this.runningTools.keys());
  }
}

// 导出别名以保持向后兼容性
export const ToolRegistry = ToolManager;