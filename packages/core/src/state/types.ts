/**
 * TypeScript原生状态管理类型定义
 * 
 * 充分利用TypeScript的高级类型特性：
 * - 字面量类型和模板字符串类型
 * - 条件类型和映射类型
 * - 品牌类型和类型守卫
 * - 泛型约束和类型推导
 */

import { z } from 'zod';
import type { Message } from '../types/message';
import type { Action } from '../types/action';

/**
 * 状态标识符品牌类型
 * 使用品牌类型确保状态ID的类型安全
 */
export type StateId<T extends string = string> = T & { readonly __brand: 'StateId' };

/**
 * 事件标识符品牌类型
 */
export type EventType<T extends string = string> = T & { readonly __brand: 'EventType' };

/**
 * 状态转换守卫函数类型
 */
export type StateGuard<TContext = any, TEvent = any> = (
  context: TContext,
  event: TEvent
) => boolean | Promise<boolean>;

/**
 * 状态副作用函数类型
 */
export type StateEffect<TContext = any, TEvent = any> = (
  context: TContext,
  event: TEvent
) => void | Promise<void>;

/**
 * 状态转换配置
 */
export interface StateTransition<TContext = any, TEvent = any> {
  /** 目标状态 */
  target: StateId;
  /** 转换守卫 */
  guard?: StateGuard<TContext, TEvent>;
  /** 转换副作用 */
  effect?: StateEffect<TContext, TEvent>;
  /** 转换描述 */
  description?: string;
}

/**
 * 状态配置接口
 */
export interface StateConfig<TContext = any> {
  /** 状态ID */
  id: StateId;
  /** 状态名称 */
  name: string;
  /** 状态描述 */
  description?: string;
  /** 进入状态时的副作用 */
  onEntry?: StateEffect<TContext>;
  /** 退出状态时的副作用 */
  onExit?: StateEffect<TContext>;
  /** 状态转换映射 */
  transitions: Record<EventType, StateTransition<TContext>>;
  /** 是否为最终状态 */
  final?: boolean;
  /** 状态元数据 */
  meta?: Record<string, any>;
}

/**
 * 状态机配置接口
 */
export interface StateMachineConfig<TContext = any> {
  /** 状态机ID */
  id: string;
  /** 初始状态 */
  initial: StateId;
  /** 状态配置映射 */
  states: Record<StateId, StateConfig<TContext>>;
  /** 状态机上下文 */
  context: TContext;
  /** 状态机元数据 */
  meta?: Record<string, any>;
}

/**
 * 状态快照接口
 */
export interface StateSnapshot<TContext = any> {
  /** 当前状态 */
  value: StateId;
  /** 状态机上下文 */
  context: TContext;
  /** 状态历史 */
  history: StateHistoryEntry[];
  /** 是否为最终状态 */
  done: boolean;
  /** 状态元数据 */
  meta: Record<string, any>;
  /** 快照时间戳 */
  timestamp: number;
}

/**
 * 状态历史条目
 */
export interface StateHistoryEntry {
  /** 时间戳 */
  timestamp: number;
  /** 源状态 */
  from: StateId;
  /** 目标状态 */
  to: StateId;
  /** 触发事件 */
  event: EventType;
  /** 事件数据 */
  eventData?: any;
  /** 转换耗时 */
  duration?: number;
}

/**
 * 状态机事件接口
 */
export interface StateMachineEvent<T extends EventType = EventType> {
  /** 事件类型 */
  type: T;
  /** 事件数据 */
  data?: any;
  /** 事件时间戳 */
  timestamp?: number;
  /** 事件来源 */
  source?: string;
}

/**
 * 角色状态枚举
 * 使用const assertion确保类型推导
 */
export const RoleStates = {
  IDLE: 'idle' as const,
  OBSERVING: 'observing' as const,
  THINKING: 'thinking' as const,
  ACTING: 'acting' as const,
  REACTING: 'reacting' as const,
  PLANNING: 'planning' as const,
  LEARNING: 'learning' as const,
  ERROR: 'error' as const,
  SUSPENDED: 'suspended' as const,
} as const;

/**
 * 角色状态类型
 * 从枚举值推导类型
 */
export type RoleState = typeof RoleStates[keyof typeof RoleStates];

/**
 * 角色事件枚举
 */
export const RoleEvents = {
  OBSERVE: 'OBSERVE' as const,
  THINK: 'THINK' as const,
  ACT: 'ACT' as const,
  REACT: 'REACT' as const,
  PLAN: 'PLAN' as const,
  LEARN: 'LEARN' as const,
  COMPLETE: 'COMPLETE' as const,
  ERROR: 'ERROR' as const,
  SUSPEND: 'SUSPEND' as const,
  RESUME: 'RESUME' as const,
  RESET: 'RESET' as const,
} as const;

/**
 * 角色事件类型
 */
export type RoleEventType = typeof RoleEvents[keyof typeof RoleEvents];

/**
 * 角色上下文接口
 */
export interface RoleContext {
  /** 角色名称 */
  name: string;
  /** 当前消息 */
  currentMessage?: Message;
  /** 当前动作 */
  currentAction?: Action;
  /** 消息队列 */
  messageQueue: Message[];
  /** 错误信息 */
  error?: Error;
  /** 重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 执行统计 */
  stats: {
    observeCount: number;
    thinkCount: number;
    actCount: number;
    reactCount: number;
    errorCount: number;
  };
  /** 自定义数据 */
  data: Record<string, any>;
}

/**
 * 角色事件联合类型
 * 使用判别联合类型确保类型安全
 */
export type RoleEvent =
  | { type: typeof RoleEvents.OBSERVE; message?: Message }
  | { type: typeof RoleEvents.THINK; context?: any }
  | { type: typeof RoleEvents.ACT; action?: Action }
  | { type: typeof RoleEvents.REACT; message: Message }
  | { type: typeof RoleEvents.PLAN; goal?: string }
  | { type: typeof RoleEvents.LEARN; feedback?: any }
  | { type: typeof RoleEvents.COMPLETE; result?: any }
  | { type: typeof RoleEvents.ERROR; error: Error }
  | { type: typeof RoleEvents.SUSPEND; reason?: string }
  | { type: typeof RoleEvents.RESUME }
  | { type: typeof RoleEvents.RESET };

/**
 * 状态持久化配置
 */
export interface StatePersistenceConfig {
  /** 是否启用持久化 */
  enabled: boolean;
  /** 存储键前缀 */
  keyPrefix: string;
  /** 序列化器 */
  serializer?: {
    serialize: (state: StateSnapshot) => string;
    deserialize: (data: string) => StateSnapshot;
  };
  /** 存储适配器 */
  storage?: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    remove: (key: string) => Promise<void>;
  };
}

/**
 * 状态可视化配置
 */
export interface StateVisualizationConfig {
  /** 是否启用可视化 */
  enabled: boolean;
  /** 可视化格式 */
  format: 'mermaid' | 'dot' | 'json';
  /** 输出路径 */
  outputPath?: string;
  /** 包含历史记录 */
  includeHistory?: boolean;
}

/**
 * 状态机选项
 */
export interface StateMachineOptions {
  /** 持久化配置 */
  persistence?: StatePersistenceConfig;
  /** 可视化配置 */
  visualization?: StateVisualizationConfig;
  /** 调试模式 */
  debug?: boolean;
  /** 最大历史记录数 */
  maxHistorySize?: number;
}

/**
 * 类型守卫：检查是否为角色事件
 */
export function isRoleEvent(event: any): event is RoleEvent {
  return event && typeof event.type === 'string' && event.type in RoleEvents;
}

/**
 * 类型守卫：检查是否为特定角色事件
 */
export function isRoleEventOfType<T extends RoleEventType>(
  event: RoleEvent,
  type: T
): event is Extract<RoleEvent, { type: T }> {
  return event.type === type;
}

/**
 * 状态ID创建函数
 */
export function createStateId<T extends string>(id: T): StateId<T> {
  return id as StateId<T>;
}

/**
 * 事件类型创建函数
 */
export function createEventType<T extends string>(type: T): EventType<T> {
  return type as EventType<T>;
}

/**
 * Zod schema for validation
 */
export const StateSnapshotSchema = z.object({
  value: z.string(),
  context: z.any(),
  history: z.array(z.object({
    timestamp: z.number(),
    from: z.string(),
    to: z.string(),
    event: z.string(),
    eventData: z.any().optional(),
    duration: z.number().optional(),
  })),
  done: z.boolean(),
  meta: z.record(z.any()),
  timestamp: z.number(),
});

export const RoleContextSchema = z.object({
  name: z.string(),
  currentMessage: z.any().optional(),
  currentAction: z.any().optional(),
  messageQueue: z.array(z.any()),
  error: z.any().optional(),
  retryCount: z.number(),
  maxRetries: z.number(),
  stats: z.object({
    observeCount: z.number(),
    thinkCount: z.number(),
    actCount: z.number(),
    reactCount: z.number(),
    errorCount: z.number(),
  }),
  data: z.record(z.any()),
});
