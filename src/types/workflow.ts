import { z } from 'zod';
import type { Role } from './role';
import type { Action } from './action';
import type { Message } from './message';

/**
 * 工作流节点类型
 */
export const WorkflowNodeSchema = z.object({
  /** 节点ID */
  id: z.string(),
  /** 节点名称 */
  name: z.string(),
  /** 节点类型 */
  type: z.enum(['action', 'role', 'condition', 'parallel', 'sequence']),
  /** 节点配置 */
  config: z.record(z.any()).optional(),
  /** 节点状态 */
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  /** 节点执行结果 */
  result: z.any().optional(),
  /** 父节点ID */
  parentId: z.string().optional(),
  /** 子节点ID列表 */
  childIds: z.array(z.string()).default([]),
});

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

/**
 * 工作流配置
 */
export const WorkflowConfigSchema = z.object({
  /** 工作流ID */
  id: z.string(),
  /** 工作流名称 */
  name: z.string(),
  /** 工作流描述 */
  description: z.string().optional(),
  /** 工作流版本 */
  version: z.string().default('1.0.0'),
  /** 工作流节点列表 */
  nodes: z.array(WorkflowNodeSchema),
  /** 工作流配置 */
  config: z.record(z.any()).optional(),
  /** 工作流元数据 */
  metadata: z.record(z.any()).optional(),
});

export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;

/**
 * 工作流状态
 */
export const WorkflowStateSchema = z.object({
  /** 工作流ID */
  id: z.string(),
  /** 工作流状态 */
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  /** 当前执行的节点ID */
  currentNodeId: z.string().optional(),
  /** 已完成的节点ID列表 */
  completedNodeIds: z.array(z.string()).default([]),
  /** 失败的节点ID列表 */
  failedNodeIds: z.array(z.string()).default([]),
  /** 工作流执行历史 */
  history: z.array(z.object({
    timestamp: z.number(),
    nodeId: z.string(),
    status: z.string(),
    message: z.string().optional(),
  })).default([]),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

/**
 * 工作流执行器接口
 */
export interface WorkflowExecutor {
  /** 执行工作流 */
  execute(config: WorkflowConfig): Promise<void>;
  /** 暂停工作流 */
  pause(): Promise<void>;
  /** 恢复工作流 */
  resume(): Promise<void>;
  /** 停止工作流 */
  stop(): Promise<void>;
  /** 获取工作流状态 */
  getState(): WorkflowState;
}

/**
 * 工作流节点执行器接口
 */
export interface NodeExecutor {
  /** 执行节点 */
  execute(node: WorkflowNode, context: any): Promise<any>;
  /** 验证节点配置 */
  validate(node: WorkflowNode): boolean;
  /** 获取节点状态 */
  getStatus(): string;
  /** 获取节点结果 */
  getResult(): any;
}

/**
 * 工作流事件类型
 */
export const WorkflowEventSchema = z.object({
  /** 事件类型 */
  type: z.enum([
    'workflow:start',
    'workflow:complete',
    'workflow:fail',
    'node:start',
    'node:complete',
    'node:fail',
    'error'
  ]),
  /** 事件时间戳 */
  timestamp: z.number(),
  /** 工作流ID */
  workflowId: z.string(),
  /** 节点ID */
  nodeId: z.string().optional(),
  /** 事件数据 */
  data: z.any().optional(),
  /** 错误信息 */
  error: z.any().optional(),
});

export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>; 