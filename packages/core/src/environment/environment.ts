import { z } from 'zod';
import type { Message } from '../types/message';
import type { Role } from '../types/role';
import type { Context } from '../context/context';
import { logger } from '../utils/logger';
import { SerializationMixin } from '../base/serialization';
import { MessageRouter, RoutableMessage, MessageFactory, createRouterId } from '../messaging';
import { RoleStateMachine, RoleStateMachineFactory, RoleStates, RoleEvents } from '../state';
import type { RoleContext } from '../state/types';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

/**
 * 环境类型模板字面量类型
 */
export type EnvironmentType =
  | 'local'                    // 本地环境
  | 'cloud'                    // 云端环境
  | 'container'                // 容器化环境
  | 'sandbox'                  // 沙箱环境
  | 'hybrid'                   // 混合环境
  | `custom:${string}`;        // 自定义环境类型

/**
 * 环境ID品牌类型
 */
export type EnvironmentId<T extends string = string> = T & { readonly __brand: 'EnvironmentId' };

/**
 * 环境状态枚举
 */
export const EnvironmentState = {
  CREATED: 'created',
  INITIALIZING: 'initializing',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error',
  DESTROYED: 'destroyed',
} as const;

export type EnvironmentStateType = typeof EnvironmentState[keyof typeof EnvironmentState];

/**
 * 环境优先级
 */
export const EnvironmentPriority = {
  CRITICAL: 1000,
  HIGH: 800,
  NORMAL: 500,
  LOW: 200,
  BACKGROUND: 100,
} as const;

export type EnvironmentPriorityLevel = typeof EnvironmentPriority[keyof typeof EnvironmentPriority];

/**
 * 资源限制配置
 */
export interface ResourceLimits {
  /** CPU限制（核心数） */
  cpu?: number;
  /** 内存限制（MB） */
  memory?: number;
  /** 存储限制（MB） */
  storage?: number;
  /** 网络带宽限制（Mbps） */
  bandwidth?: number;
  /** 并发连接数限制 */
  connections?: number;
  /** 执行时间限制（毫秒） */
  timeout?: number;
}

/**
 * 增强的环境配置schema
 */
export const EnvironmentConfigSchema = z.object({
  /** 环境ID */
  id: z.string().optional(),
  /** 环境名称 */
  name: z.string().default('DefaultEnvironment'),
  /** 环境类型 */
  type: z.string().default('local'),
  /** 环境描述 */
  description: z.string().default(''),
  /** 环境优先级 */
  priority: z.number().default(EnvironmentPriority.NORMAL),
  /** 资源限制 */
  resourceLimits: z.object({
    cpu: z.number().positive().optional(),
    memory: z.number().positive().optional(),
    storage: z.number().positive().optional(),
    bandwidth: z.number().positive().optional(),
    connections: z.number().positive().optional(),
    timeout: z.number().positive().optional(),
  }).default({}),
  /** 环境变量 */
  env: z.record(z.string()).default({}),
  /** 标签 */
  tags: z.array(z.string()).default([]),
  /** 是否启用监控 */
  enableMonitoring: z.boolean().default(true),
  /** 是否启用自动恢复 */
  enableAutoRecovery: z.boolean().default(false),
  /** 健康检查间隔（毫秒） */
  healthCheckInterval: z.number().positive().default(30000),
  /** 最大消息历史大小 */
  maxHistorySize: z.number().default(1000),
  /** 最大角色数量 */
  maxRoles: z.number().positive().default(100),
  /** 消息路由配置 */
  messageRouting: z.object({
    enabled: z.boolean().default(true),
    maxConcurrency: z.number().positive().default(10),
    enableMetrics: z.boolean().default(true),
  }).default({}),
  /** 状态管理配置 */
  stateManagement: z.object({
    enabled: z.boolean().default(true),
    persistence: z.boolean().default(false),
    debug: z.boolean().default(false),
  }).default({}),
  /** 上下文配置 */
  context: z.any().optional(),
  /** 元数据 */
  metadata: z.record(z.any()).default({}),
});

export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

/**
 * 环境指标接口
 */
export interface EnvironmentMetrics {
  /** 环境ID */
  environmentId: EnvironmentId;
  /** 当前状态 */
  currentState: EnvironmentStateType;
  /** 运行时间（毫秒） */
  uptime: number;
  /** CPU使用率（百分比） */
  cpuUsage: number;
  /** 内存使用量（MB） */
  memoryUsage: number;
  /** 活跃角色数量 */
  activeRoles: number;
  /** 处理的消息数量 */
  processedMessages: number;
  /** 错误计数 */
  errorCount: number;
  /** 最后更新时间 */
  lastUpdated: Date;
}

/**
 * 环境事件类型
 */
export interface EnvironmentEvents {
  'environment:created': (env: EnvironmentInfo) => void;
  'environment:initialized': (env: EnvironmentInfo) => void;
  'environment:started': (env: EnvironmentInfo) => void;
  'environment:paused': (env: EnvironmentInfo) => void;
  'environment:stopped': (env: EnvironmentInfo) => void;
  'environment:destroyed': (env: EnvironmentInfo) => void;
  'environment:error': (env: EnvironmentInfo, error: Error) => void;
  'environment:metrics': (metrics: EnvironmentMetrics) => void;
  'environment:health-check': (env: EnvironmentInfo, healthy: boolean) => void;
  'role:added': (env: EnvironmentInfo, role: Role) => void;
  'role:removed': (env: EnvironmentInfo, roleId: string) => void;
  'message:received': (env: EnvironmentInfo, message: RoutableMessage) => void;
  'message:sent': (env: EnvironmentInfo, message: RoutableMessage) => void;
}

/**
 * 环境信息接口
 */
export interface EnvironmentInfo {
  /** 环境ID */
  id: EnvironmentId;
  /** 环境名称 */
  name: string;
  /** 环境类型 */
  type: EnvironmentType;
  /** 当前状态 */
  state: EnvironmentStateType;
  /** 创建时间 */
  createdAt: Date;
  /** 启动时间 */
  startedAt?: Date;
  /** 停止时间 */
  stoppedAt?: Date;
  /** 标签 */
  tags: Set<string>;
  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 工厂函数：创建环境ID
 */
export function createEnvironmentId<T extends string>(id: T): EnvironmentId<T> {
  return id as EnvironmentId<T>;
}

/**
 * 类型守卫：检查是否为有效的环境类型
 */
export function isValidEnvironmentType(type: string): type is EnvironmentType {
  const validTypes = ['local', 'cloud', 'container', 'sandbox', 'hybrid'];
  return validTypes.includes(type) || type.startsWith('custom:');
}

/**
 * Helper function to write JSON file
 */
function writeJsonFile(filePath: string, data: Record<string, any>): void {
  // Ensure directory exists
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Write file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * 增强的环境类，支持现代化的TypeScript特性
 *
 * 集成了序列化系统、状态管理系统和消息路由系统，
 * 提供类型安全的环境管理和角色协调功能。
 */
export class Environment extends SerializationMixin {
  /** 环境ID */
  private readonly id: EnvironmentId;

  /** 环境配置 */
  private config: EnvironmentConfig;

  /** 环境状态 */
  private state: EnvironmentStateType = EnvironmentState.CREATED;

  /** 角色映射 */
  private roles: Map<string, Role> = new Map();

  /** 角色状态机映射 */
  private roleStateMachines: Map<string, RoleStateMachine> = new Map();

  /** 消息历史 */
  private messageHistory: Message[] = [];

  /** 消息路由器 */
  private messageRouter?: MessageRouter;

  /** 事件发射器 */
  private eventEmitter = new EventEmitter();

  /** 环境指标 */
  private metrics: EnvironmentMetrics;

  /** 创建时间 */
  private readonly createdAt: Date = new Date();

  /** 启动时间 */
  private startedAt?: Date;

  /** 停止时间 */
  private stoppedAt?: Date;

  /** 健康检查定时器 */
  private healthCheckTimer?: NodeJS.Timer;

  /** 上下文 */
  private _context: Context;

  /** 环境描述 */
  private description: string = '';

  /** 空闲状态标志 */
  private _isIdle: boolean = true;

  /**
   * 创建新的环境实例
   * @param config 环境配置
   */
  constructor(config: Partial<EnvironmentConfig> = {}) {
    super();

    // 解析和验证配置
    this.config = EnvironmentConfigSchema.parse(config);

    // 生成环境ID
    this.id = createEnvironmentId(this.config.id || `env-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);

    // 初始化上下文
    this._context = this.config.context || {};
    this.description = this.config.description;

    // 初始化指标
    this.metrics = {
      environmentId: this.id,
      currentState: this.state,
      uptime: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      activeRoles: 0,
      processedMessages: 0,
      errorCount: 0,
      lastUpdated: new Date(),
    };

    // 初始化消息路由器
    if (this.config.messageRouting.enabled) {
      this.initializeMessageRouter();
    }

    // 发射创建事件
    this.emitEvent('environment:created', this.getInfo());

    logger.info(`Environment created: ${this.id} (${this.config.name})`);
  }

  /**
   * 获取序列化路径
   */
  getSerializationPath(): string {
    return `./environments/${this.id}.json`;
  }

  /**
   * 初始化消息路由器
   */
  private initializeMessageRouter(): void {
    this.messageRouter = new MessageRouter({
      id: createRouterId(`${this.id}-router`),
      name: `${this.config.name} Router`,
      debug: this.config.stateManagement.debug,
      maxConcurrency: this.config.messageRouting.maxConcurrency,
      enableMetrics: this.config.messageRouting.enableMetrics,
    });

    // 配置消息路由规则
    this.setupMessageRouting();
  }

  /**
   * 设置消息路由规则
   */
  private setupMessageRouting(): void {
    if (!this.messageRouter) return;

    // 启动路由器
    this.messageRouter.start();

    // 监听路由事件
    this.messageRouter.on('message:routed', (_result) => {
      this.metrics.processedMessages++;
      this.updateMetrics();
    });

    this.messageRouter.on('message:failed', (_message, error) => {
      this.metrics.errorCount++;
      this.updateMetrics();
      logger.error(`Message routing failed in environment ${this.id}:`, error);
    });
  }

  /**
   * 发射环境事件
   */
  private emitEvent<K extends keyof EnvironmentEvents>(
    event: K,
    ...args: Parameters<EnvironmentEvents[K]>
  ): void {
    this.eventEmitter.emit(event, ...args);
  }

  /**
   * 获取环境信息
   */
  public getInfo(): EnvironmentInfo {
    return {
      id: this.id,
      name: this.config.name,
      type: this.config.type as EnvironmentType,
      state: this.state,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      tags: new Set(this.config.tags),
      metadata: { ...this.config.metadata },
    };
  }

  /**
   * 更新环境指标
   */
  private updateMetrics(): void {
    this.metrics.currentState = this.state;
    this.metrics.uptime = this.startedAt ? Date.now() - this.startedAt.getTime() : 0;
    this.metrics.activeRoles = this.roles.size;
    this.metrics.lastUpdated = new Date();

    this.emitEvent('environment:metrics', this.metrics);
  }

  /**
   * 启动环境
   */
  public async start(): Promise<void> {
    if (this.state !== EnvironmentState.CREATED) {
      throw new Error(`Cannot start environment in state: ${this.state}`);
    }

    try {
      this.setState(EnvironmentState.INITIALIZING);

      // 启动消息路由器
      if (this.messageRouter && !this.messageRouter.isRunning()) {
        this.messageRouter.start();
      }

      // 启动健康检查
      if (this.config.enableMonitoring) {
        this.startHealthCheck();
      }

      this.startedAt = new Date();
      this.setState(EnvironmentState.RUNNING);

      this.emitEvent('environment:started', this.getInfo());
      logger.info(`Environment started: ${this.id}`);

    } catch (error) {
      this.setState(EnvironmentState.ERROR);
      this.emitEvent('environment:error', this.getInfo(), error as Error);
      throw error;
    }
  }

  /**
   * 停止环境
   */
  public async stop(): Promise<void> {
    if (this.state === EnvironmentState.STOPPED || this.state === EnvironmentState.DESTROYED) {
      return;
    }

    try {
      this.setState(EnvironmentState.STOPPING);

      // 停止健康检查
      this.stopHealthCheck();

      // 停止消息路由器
      if (this.messageRouter && this.messageRouter.isRunning()) {
        this.messageRouter.stop();
      }

      // 停止所有角色状态机
      for (const stateMachine of this.roleStateMachines.values()) {
        await stateMachine.dispose();
      }
      this.roleStateMachines.clear();

      this.stoppedAt = new Date();
      this.setState(EnvironmentState.STOPPED);

      this.emitEvent('environment:stopped', this.getInfo());
      logger.info(`Environment stopped: ${this.id}`);

    } catch (error) {
      this.setState(EnvironmentState.ERROR);
      this.emitEvent('environment:error', this.getInfo(), error as Error);
      throw error;
    }
  }

  /**
   * 暂停环境
   */
  public async pause(): Promise<void> {
    if (this.state !== EnvironmentState.RUNNING) {
      throw new Error(`Cannot pause environment in state: ${this.state}`);
    }

    this.setState(EnvironmentState.PAUSED);
    this.emitEvent('environment:paused', this.getInfo());
    logger.info(`Environment paused: ${this.id}`);
  }

  /**
   * 恢复环境
   */
  public async resume(): Promise<void> {
    if (this.state !== EnvironmentState.PAUSED) {
      throw new Error(`Cannot resume environment in state: ${this.state}`);
    }

    this.setState(EnvironmentState.RUNNING);
    this.emitEvent('environment:started', this.getInfo());
    logger.info(`Environment resumed: ${this.id}`);
  }

  /**
   * 销毁环境
   */
  public async destroy(): Promise<void> {
    await this.stop();

    // 清理资源
    this.roles.clear();
    this.messageHistory.length = 0;
    this.eventEmitter.removeAllListeners();

    this.setState(EnvironmentState.DESTROYED);
    this.emitEvent('environment:destroyed', this.getInfo());
    logger.info(`Environment destroyed: ${this.id}`);
  }

  /**
   * 设置环境状态
   */
  private setState(newState: EnvironmentStateType): void {
    const oldState = this.state;
    this.state = newState;
    this.updateMetrics();

    logger.debug(`Environment ${this.id} state changed: ${oldState} -> ${newState}`);
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthy = this.state === EnvironmentState.RUNNING &&
                     this.roles.size <= this.config.maxRoles &&
                     this.messageHistory.length <= this.config.maxHistorySize;

      this.emitEvent('environment:health-check', this.getInfo(), healthy);

      if (!healthy && this.config.enableAutoRecovery) {
        logger.warn(`Environment ${this.id} health check failed, attempting recovery`);
        await this.attemptRecovery();
      }

    } catch (error) {
      logger.error(`Health check failed for environment ${this.id}:`, error);
    }
  }

  /**
   * 尝试自动恢复
   */
  private async attemptRecovery(): Promise<void> {
    try {
      // 清理过期消息
      if (this.messageHistory.length > this.config.maxHistorySize) {
        const excessCount = this.messageHistory.length - this.config.maxHistorySize;
        this.messageHistory.splice(0, excessCount);
        logger.info(`Cleaned ${excessCount} excess messages from environment ${this.id}`);
      }

      // 重启消息路由器
      if (this.messageRouter && !this.messageRouter.isRunning()) {
        this.messageRouter.start();
        logger.info(`Restarted message router for environment ${this.id}`);
      }

    } catch (error) {
      logger.error(`Recovery failed for environment ${this.id}:`, error);
    }
  }

  /**
   * Get the environment's context
   */
  public get context(): Context {
    return this._context;
  }

  /**
   * Set the environment description
   * @param description Environment description
   */
  public setDescription(description: string): void {
    this.description = description;
  }

  /**
   * 添加角色到环境（增强版）
   * @param roles 要添加的角色列表
   */
  public addRoles(roles: Role[]): void {
    for (const role of roles) {
      this.addRole(role);
    }
    logger.info(`Added ${roles.length} roles to environment ${this.id}`);
  }

  /**
   * 添加单个角色到环境
   * @param role 要添加的角色
   */
  public addRole(role: Role): void {
    if (this.roles.has(role.name)) {
      logger.warn(`Role ${role.name} already exists in environment ${this.id}`);
      return;
    }

    if (this.roles.size >= this.config.maxRoles) {
      throw new Error(`Environment ${this.id} has reached maximum role limit: ${this.config.maxRoles}`);
    }

    // 添加角色到映射
    this.roles.set(role.name, role);

    // 设置角色的环境引用
    (role as any).setEnvironment?.(this);

    // 如果启用了状态管理，创建角色状态机
    if (this.config.stateManagement.enabled) {
      this.createRoleStateMachine(role);
    }

    // 更新指标
    this.updateMetrics();

    // 发射事件
    this.emitEvent('role:added', this.getInfo(), role);

    logger.info(`Added role ${role.name} to environment ${this.id}`);
  }

  /**
   * 移除角色
   * @param roleName 角色名称
   */
  public removeRole(roleName: string): boolean {
    const role = this.roles.get(roleName);
    if (!role) {
      return false;
    }

    // 移除角色状态机
    const stateMachine = this.roleStateMachines.get(roleName);
    if (stateMachine) {
      stateMachine.dispose();
      this.roleStateMachines.delete(roleName);
    }

    // 移除角色
    this.roles.delete(roleName);

    // 更新指标
    this.updateMetrics();

    // 发射事件
    this.emitEvent('role:removed', this.getInfo(), roleName);

    logger.info(`Removed role ${roleName} from environment ${this.id}`);
    return true;
  }

  /**
   * 创建角色状态机
   * @param role 角色
   */
  private createRoleStateMachine(role: Role): void {
    try {
      // 创建角色上下文
      const roleContext: RoleContext = {
        name: role.name,
        messageQueue: [],
        retryCount: 0,
        maxRetries: 3,
        stats: {
          observeCount: 0,
          thinkCount: 0,
          actCount: 0,
          reactCount: 0,
          errorCount: 0,
        },
        data: {},
      };

      // 创建状态机
      const stateMachine = RoleStateMachineFactory.createStandard(
        `${this.id}-${role.name}`,
        roleContext,
        {
          debug: this.config.stateManagement.debug,
          maxRetries: 3,
          autoRecover: this.config.enableAutoRecovery,
        }
      );

      // 启动状态机
      stateMachine.start();

      // 监听状态机事件
      stateMachine.on('state:changed', (snapshot) => {
        logger.debug(`Role ${role.name} state changed to: ${snapshot.value}`);
      });

      // 存储状态机
      this.roleStateMachines.set(role.name, stateMachine);

      logger.debug(`Created state machine for role ${role.name}`);

    } catch (error) {
      logger.error(`Failed to create state machine for role ${role.name}:`, error);
    }
  }

  /**
   * 获取角色状态机
   * @param roleName 角色名称
   */
  public getRoleStateMachine(roleName: string): RoleStateMachine | undefined {
    return this.roleStateMachines.get(roleName);
  }

  /**
   * Get a role by name
   * @param name Role name
   * @returns Role or undefined if not found
   */
  public getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }

  /**
   * Get all roles in the environment
   * @returns Array of roles
   */
  public getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * 发布消息到环境（增强版）
   * @param message 要发布的消息
   */
  public publishMessage(message: Message): void {
    // 添加到历史记录
    this.messageHistory.push(message);

    // 清理过期消息
    this.trimMessageHistory();

    // 如果启用了消息路由，转换为可路由消息并路由
    if (this.messageRouter && this.config.messageRouting.enabled) {
      this.routeMessage(message);
    }

    // 发射事件
    const routableMessage = this.convertToRoutableMessage(message);
    this.emitEvent('message:received', this.getInfo(), routableMessage);

    logger.debug(`Published message: ${message.role} -> ${Array.from(message.sendTo).join(', ')}`);
  }

  /**
   * 路由消息
   * @param message 原始消息
   */
  private async routeMessage(message: Message): Promise<void> {
    if (!this.messageRouter) return;

    try {
      const routableMessage = this.convertToRoutableMessage(message);
      await this.messageRouter.route(routableMessage);
    } catch (error) {
      logger.error(`Failed to route message in environment ${this.id}:`, error);
      this.metrics.errorCount++;
      this.updateMetrics();
    }
  }

  /**
   * 转换为可路由消息
   * @param message 原始消息
   */
  private convertToRoutableMessage(message: Message): RoutableMessage {
    return MessageFactory.fromBaseMessage(message, {
      messageType: 'environment_message',
      tags: ['environment', this.config.type],
      metadata: {
        environmentId: this.id,
        environmentName: this.config.name,
      },
    });
  }

  /**
   * 清理消息历史
   */
  private trimMessageHistory(): void {
    if (this.messageHistory.length > this.config.maxHistorySize) {
      const excessCount = this.messageHistory.length - this.config.maxHistorySize;
      this.messageHistory.splice(0, excessCount);
      logger.debug(`Trimmed ${excessCount} messages from environment ${this.id} history`);
    }
  }

  /**
   * 发送消息给特定角色
   * @param message 消息
   * @param targetRole 目标角色名称
   */
  public async sendMessageToRole(message: Message, targetRole: string): Promise<void> {
    const role = this.roles.get(targetRole);
    if (!role) {
      throw new Error(`Role ${targetRole} not found in environment ${this.id}`);
    }

    // 更新消息的接收者
    const targetedMessage = {
      ...message,
      sendTo: new Set([targetRole]),
    };

    // 发布消息
    this.publishMessage(targetedMessage);

    // 如果角色有状态机，触发消息接收事件
    const stateMachine = this.roleStateMachines.get(targetRole);
    if (stateMachine) {
      try {
        await stateMachine.sendRoleEvent({
          type: RoleEvents.OBSERVE,
        });
      } catch (error) {
        logger.error(`Failed to notify role ${targetRole} of new message:`, error);
      }
    }
  }

  /**
   * 广播消息给所有角色
   * @param message 消息
   */
  public async broadcastMessage(message: Message): Promise<void> {
    // 设置为广播消息
    const broadcastMessage = {
      ...message,
      sendTo: new Set(['ALL']),
    };

    // 发布消息
    this.publishMessage(broadcastMessage);

    // 通知所有角色状态机
    for (const [roleName, stateMachine] of this.roleStateMachines) {
      try {
        await stateMachine.sendRoleEvent({
          type: RoleEvents.OBSERVE,
        });
      } catch (error) {
        logger.error(`Failed to notify role ${roleName} of broadcast message:`, error);
      }
    }
  }

  /**
   * 获取过滤后的消息（增强版）
   * @param recipient 消息接收者（角色名称）
   * @param fromIndex 历史记录起始索引（可选）
   * @returns 过滤后的消息
   */
  public getMessages(recipient: string, fromIndex?: number): Message[] {
    const start = fromIndex !== undefined ? Math.max(0, fromIndex) : 0;

    return this.messageHistory.slice(start).filter(message => {
      return message.sendTo.has('ALL') || message.sendTo.has(recipient);
    });
  }

  /**
   * 获取角色的新消息
   * @param roleName 角色名称
   * @param lastMessageIndex 上次读取的消息索引
   * @returns 新消息列表
   */
  public getNewMessagesForRole(roleName: string, lastMessageIndex: number = 0): Message[] {
    return this.getMessages(roleName, lastMessageIndex);
  }

  /**
   * 获取环境中的消息统计
   */
  public getMessageStats(): {
    total: number;
    byRole: Record<string, number>;
    recent: number;
  } {
    const byRole: Record<string, number> = {};
    const oneHourAgo = Date.now() - 3600000; // 1 hour ago
    let recent = 0;

    for (const message of this.messageHistory) {
      // 统计按角色分组的消息数
      if (!byRole[message.role]) {
        byRole[message.role] = 0;
      }
      byRole[message.role]++;

      // 统计最近一小时的消息数
      const messageTime = new Date(message.timestamp).getTime();
      if (messageTime > oneHourAgo) {
        recent++;
      }
    }

    return {
      total: this.messageHistory.length,
      byRole,
      recent,
    };
  }

  /**
   * Get all messages in the environment
   * @returns All messages
   */
  public get history(): Message[] {
    return [...this.messageHistory];
  }

  /**
   * 检查所有角色是否空闲（增强版）
   */
  public get isIdle(): boolean {
    if (this.roles.size === 0) {
      return true;
    }

    // 检查角色状态机状态
    for (const stateMachine of this.roleStateMachines.values()) {
      const snapshot = stateMachine.getSnapshot();
      if (snapshot.value !== RoleStates.IDLE) {
        return false;
      }
    }

    // 回退到传统检查方法
    for (const role of this.roles.values()) {
      const roleWithMethods = role as unknown as { isIdle?: () => boolean };
      if (roleWithMethods.isIdle && !roleWithMethods.isIdle()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Run one step of all roles in the environment
   * @returns Promise that resolves when all roles have processed one step
   */
  public async run(): Promise<void> {
    this._isIdle = true;
    
    // Run all roles in parallel
    const promises = Array.from(this.roles.values()).map(async (role) => {
      const roleWithMethods = role as unknown as {
        isIdle?: () => boolean;
        run?: () => Promise<void> | void;
      };

      if (roleWithMethods.isIdle && !roleWithMethods.isIdle()) {
        this._isIdle = false;
        if (roleWithMethods.run) {
          await roleWithMethods.run();
        }
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * Archive the environment
   * @param storagePath Storage path for archiving
   */
  public async archive(storagePath?: string): Promise<void> {
    if (!storagePath) {
      return;
    }
    
    // Save environment state
    const envPath = path.join(storagePath, 'environment');
    const historyPath = path.join(envPath, 'history.json');
    
    // Save message history
    writeJsonFile(historyPath, {
      description: this.description,
      messages: this.messageHistory.map(msg => {
        const msgWithSerialize = msg as unknown as { serialize?: () => Record<string, unknown> };
        return msgWithSerialize.serialize?.() || msg;
      }),
    });
    
    logger.info(`Archived environment data to ${envPath}`);
  }
} 