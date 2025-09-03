/**
 * @module Tools
 * @category Tools
 *
 * 增强的工具系统导出
 * 集成第一阶段完成的核心架构
 */

// 核心工具类和管理器
export { BaseTool } from './base-tool';
export { ToolManager, ToolRegistry } from './tool-registry';

// 具体工具实现
export { FileSystemTool } from './file-system';
export { EnhancedFileSystemTool } from './enhanced-file-system';

// 现有工具（保持向后兼容）
export * from './document-converter';
export * from './data-visualizer';

// 示例工具（从示例文件导出）
export {
  AIAnalysisTool,
  CodeAnalysisTool
} from './examples/tool-system-example';

// 重新导出所有工具相关类型
export type {
  Tool,
  ToolConfig,
  ToolContext,
  ToolResult,
  ToolId,
  ToolType,
  ToolStateType,
  ToolInfo,
  ToolMetrics,
  ToolExecutionOptions,
  ToolEvents,
  ToolManager as IToolManager,
  ToolManagerStatistics,
  ToolExecutor,
} from '../types/tool';

// 重新导出工具状态和优先级常量
export { ToolState, ToolPriority } from '../types/tool';