/**
 * AFlow类型定义
 */

import type { Action } from '../../types/action';
import type { Role } from '../../types/role';
import type { Message } from '../../types/message';

/**
 * AFlow工作流状态
 */
export enum AFlowState {
  CREATED = 'created',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}

/**
 * AFlow优化配置
 */
export interface AFlowOptimizationConfig {
  /** 最大优化轮数 */
  maxRounds?: number;
  /** 每轮样本数 */
  samplesPerRound?: number;
  /** 收敛阈值 */
  convergenceThreshold?: number;
  /** 验证轮数 */
  validationRounds?: number;
  /** 是否启用早停 */
  enableEarlyStop?: boolean;
}

/**
 * AFlow评估结果
 */
export interface AFlowEvaluationResult {
  /** 评估分数 */
  score: number;
  /** 执行时间 */
  executionTime: number;
  /** 资源消耗 */
  resourceUsage: {
    memory: number;
    cpu: number;
  };
  /** 错误信息 */
  error?: string;
}

/**
 * AFlow优化历史记录
 */
export interface AFlowOptimizationHistory {
  /** 优化轮次 */
  round: number;
  /** 最佳分数 */
  bestScore: number;
  /** 平均分数 */
  averageScore: number;
  /** 工作流配置 */
  workflowConfig: any;
  /** 评估结果 */
  evaluationResults: AFlowEvaluationResult[];
}

/**
 * AFlow操作符定义
 */
export interface AFlowOperator {
  /** 操作符ID */
  id: string;
  /** 操作符名称 */
  name: string;
  /** 操作符类型 */
  type: string;
  /** 操作符配置 */
  config: Record<string, any>;
  /** 执行函数 */
  execute: (input: any) => Promise<any>;
}

/**
 * AFlow数据集类型
 */
export enum AFlowDatasetType {
  HUMAN_EVAL = 'HumanEval',
  MBPP = 'MBPP',
  GSM8K = 'GSM8K',
  MATH = 'MATH',
  HOTPOT_QA = 'HotpotQA',
  DROP = 'DROP',
  CUSTOM = 'Custom'
}

/**
 * AFlow基准测试接口
 */
export interface AFlowBenchmark {
  /** 评估问题 */
  evaluateProblem(problem: string): Promise<AFlowEvaluationResult>;
  /** 计算分数 */
  calculateScore(results: AFlowEvaluationResult[]): number;
  /** 获取结果列 */
  getResultColumns(): string[];
}

/**
 * AFlow工作流模板
 */
export interface AFlowTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 节点定义 */
  nodes: {
    id: string;
    type: string;
    config: Record<string, any>;
  }[];
  /** 边定义 */
  edges: {
    source: string;
    target: string;
    condition?: string;
  }[];
}

/**
 * AFlow工作流实例
 */
export interface AFlowInstance {
  /** 实例ID */
  id: string;
  /** 工作流ID */
  workflowId: string;
  /** 实例状态 */
  state: AFlowState;
  /** 活动节点 */
  activeNodes: string[];
  /** 已完成节点 */
  completedNodes: string[];
  /** 节点结果 */
  nodeResults: Record<string, any>;
  /** 工作流变量 */
  variables: Record<string, any>;
  /** 开始时间 */
  startTime?: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 错误信息 */
  error?: string;
} 