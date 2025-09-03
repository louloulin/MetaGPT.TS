/**
 * 角色状态机专用实现
 * 
 * 基于TypeScript原生状态机的角色专用状态管理：
 * - 角色生命周期状态定义
 * - 智能状态转换逻辑
 * - 错误处理和恢复机制
 * - 性能监控和统计
 */

import { StateMachine } from './state-machine';
import { logger } from '../utils/logger';
import type { Message } from '../types/message';
import type { Action } from '../types/action';
import type {
  StateId,
  EventType,
  StateMachineConfig,
  StateMachineOptions,
  RoleContext,
  RoleEvent,
  RoleState,
  RoleEventType,
} from './types';
import {
  RoleStates,
  RoleEvents,
  createStateId,
  createEventType,
  isRoleEvent,
  isRoleEventOfType,
} from './types';

/**
 * 角色状态机配置选项
 */
export interface RoleStateMachineOptions extends StateMachineOptions {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 自动恢复错误 */
  autoRecover?: boolean;
  /** 性能监控 */
  enableMetrics?: boolean;
  /** 状态超时配置 */
  stateTimeouts?: Partial<Record<RoleState, number>>;
}

/**
 * 角色状态机工厂
 */
export class RoleStateMachineFactory {
  /**
   * 创建标准角色状态机
   */
  static createStandard(
    roleId: string,
    context: RoleContext,
    options: RoleStateMachineOptions = {}
  ): RoleStateMachine {
    const config = this.createStandardConfig(roleId, context);
    return new RoleStateMachine(config, options);
  }

  /**
   * 创建学习型角色状态机
   */
  static createLearning(
    roleId: string,
    context: RoleContext,
    options: RoleStateMachineOptions = {}
  ): RoleStateMachine {
    const config = this.createLearningConfig(roleId, context);
    return new RoleStateMachine(config, options);
  }

  /**
   * 创建协作型角色状态机
   */
  static createCollaborative(
    roleId: string,
    context: RoleContext,
    options: RoleStateMachineOptions = {}
  ): RoleStateMachine {
    const config = this.createCollaborativeConfig(roleId, context);
    return new RoleStateMachine(config, options);
  }

  /**
   * 创建标准配置
   */
  private static createStandardConfig(
    roleId: string,
    context: RoleContext
  ): StateMachineConfig<RoleContext> {
    return {
      id: `role-${roleId}`,
      initial: createStateId(RoleStates.IDLE),
      context,
      states: {
        [createStateId(RoleStates.IDLE)]: {
          id: createStateId(RoleStates.IDLE),
          name: 'Idle',
          description: '角色空闲状态，等待消息或指令',
          onEntry: async (ctx) => {
            logger.debug(`[${ctx.name}] Entered idle state`);
          },
          transitions: {
            [createEventType(RoleEvents.OBSERVE)]: {
              target: createStateId(RoleStates.OBSERVING),
              description: '开始观察环境',
            },
            [createEventType(RoleEvents.REACT)]: {
              target: createStateId(RoleStates.REACTING),
              description: '直接响应消息',
            },
            [createEventType(RoleEvents.SUSPEND)]: {
              target: createStateId(RoleStates.SUSPENDED),
              description: '暂停角色',
            },
          },
        },

        [createStateId(RoleStates.OBSERVING)]: {
          id: createStateId(RoleStates.OBSERVING),
          name: 'Observing',
          description: '观察环境，收集信息',
          onEntry: async (ctx) => {
            ctx.stats.observeCount++;
            logger.debug(`[${ctx.name}] Started observing (count: ${ctx.stats.observeCount})`);
          },
          transitions: {
            [createEventType(RoleEvents.THINK)]: {
              target: createStateId(RoleStates.THINKING),
              guard: async (ctx) => ctx.messageQueue.length > 0,
              description: '有消息时开始思考',
            },
            [createEventType(RoleEvents.COMPLETE)]: {
              target: createStateId(RoleStates.IDLE),
              guard: async (ctx) => ctx.messageQueue.length === 0,
              description: '无消息时返回空闲',
            },
            [createEventType(RoleEvents.ERROR)]: {
              target: createStateId(RoleStates.ERROR),
              description: '观察过程出错',
            },
          },
        },

        [createStateId(RoleStates.THINKING)]: {
          id: createStateId(RoleStates.THINKING),
          name: 'Thinking',
          description: '分析信息，制定行动计划',
          onEntry: async (ctx) => {
            ctx.stats.thinkCount++;
            logger.debug(`[${ctx.name}] Started thinking (count: ${ctx.stats.thinkCount})`);
          },
          transitions: {
            [createEventType(RoleEvents.ACT)]: {
              target: createStateId(RoleStates.ACTING),
              guard: async (ctx) => ctx.currentAction !== undefined,
              description: '有行动计划时开始执行',
            },
            [createEventType(RoleEvents.PLAN)]: {
              target: createStateId(RoleStates.PLANNING),
              description: '需要更详细规划',
            },
            [createEventType(RoleEvents.COMPLETE)]: {
              target: createStateId(RoleStates.IDLE),
              guard: async (ctx) => ctx.currentAction === undefined,
              description: '无行动计划时返回空闲',
            },
            [createEventType(RoleEvents.ERROR)]: {
              target: createStateId(RoleStates.ERROR),
              description: '思考过程出错',
            },
          },
        },

        [createStateId(RoleStates.ACTING)]: {
          id: createStateId(RoleStates.ACTING),
          name: 'Acting',
          description: '执行具体行动',
          onEntry: async (ctx) => {
            ctx.stats.actCount++;
            logger.debug(`[${ctx.name}] Started acting (count: ${ctx.stats.actCount})`);
          },
          transitions: {
            [createEventType(RoleEvents.COMPLETE)]: {
              target: createStateId(RoleStates.IDLE),
              description: '行动完成',
            },
            [createEventType(RoleEvents.REACT)]: {
              target: createStateId(RoleStates.REACTING),
              description: '需要响应新消息',
            },
            [createEventType(RoleEvents.ERROR)]: {
              target: createStateId(RoleStates.ERROR),
              description: '行动执行出错',
            },
          },
        },

        [createStateId(RoleStates.REACTING)]: {
          id: createStateId(RoleStates.REACTING),
          name: 'Reacting',
          description: '响应消息或事件',
          onEntry: async (ctx) => {
            ctx.stats.reactCount++;
            logger.debug(`[${ctx.name}] Started reacting (count: ${ctx.stats.reactCount})`);
          },
          transitions: {
            [createEventType(RoleEvents.OBSERVE)]: {
              target: createStateId(RoleStates.OBSERVING),
              description: '响应后继续观察',
            },
            [createEventType(RoleEvents.COMPLETE)]: {
              target: createStateId(RoleStates.IDLE),
              description: '响应完成',
            },
            [createEventType(RoleEvents.ERROR)]: {
              target: createStateId(RoleStates.ERROR),
              description: '响应过程出错',
            },
          },
        },

        [createStateId(RoleStates.PLANNING)]: {
          id: createStateId(RoleStates.PLANNING),
          name: 'Planning',
          description: '制定详细计划',
          onEntry: async (ctx) => {
            logger.debug(`[${ctx.name}] Started planning`);
          },
          transitions: {
            [createEventType(RoleEvents.ACT)]: {
              target: createStateId(RoleStates.ACTING),
              description: '计划完成，开始执行',
            },
            [createEventType(RoleEvents.THINK)]: {
              target: createStateId(RoleStates.THINKING),
              description: '重新思考计划',
            },
            [createEventType(RoleEvents.ERROR)]: {
              target: createStateId(RoleStates.ERROR),
              description: '规划过程出错',
            },
          },
        },

        [createStateId(RoleStates.ERROR)]: {
          id: createStateId(RoleStates.ERROR),
          name: 'Error',
          description: '错误状态，需要处理或恢复',
          onEntry: async (ctx, event) => {
            ctx.stats.errorCount++;
            if (isRoleEventOfType(event as RoleEvent, RoleEvents.ERROR)) {
              ctx.error = event.error;
            }
            logger.error(`[${ctx.name}] Entered error state (count: ${ctx.stats.errorCount})`);
          },
          transitions: {
            [createEventType(RoleEvents.RESET)]: {
              target: createStateId(RoleStates.IDLE),
              effect: async (ctx) => {
                ctx.error = undefined;
                ctx.retryCount = 0;
              },
              description: '重置到空闲状态',
            },
            [createEventType(RoleEvents.RESUME)]: {
              target: createStateId(RoleStates.OBSERVING),
              guard: async (ctx) => ctx.retryCount < ctx.maxRetries,
              effect: async (ctx) => {
                ctx.retryCount++;
                ctx.error = undefined;
              },
              description: '重试恢复',
            },
          },
        },

        [createStateId(RoleStates.SUSPENDED)]: {
          id: createStateId(RoleStates.SUSPENDED),
          name: 'Suspended',
          description: '暂停状态',
          onEntry: async (ctx) => {
            logger.debug(`[${ctx.name}] Suspended`);
          },
          transitions: {
            [createEventType(RoleEvents.RESUME)]: {
              target: createStateId(RoleStates.IDLE),
              description: '恢复到空闲状态',
            },
          },
          final: false,
        },
      },
    };
  }

  /**
   * 创建学习型配置（扩展标准配置）
   */
  private static createLearningConfig(
    roleId: string,
    context: RoleContext
  ): StateMachineConfig<RoleContext> {
    const standardConfig = this.createStandardConfig(roleId, context);
    
    // 添加学习状态
    standardConfig.states[createStateId(RoleStates.LEARNING)] = {
      id: createStateId(RoleStates.LEARNING),
      name: 'Learning',
      description: '学习和改进状态',
      onEntry: async (ctx) => {
        logger.debug(`[${ctx.name}] Started learning`);
      },
      transitions: {
        [createEventType(RoleEvents.COMPLETE)]: {
          target: createStateId(RoleStates.IDLE),
          description: '学习完成',
        },
        [createEventType(RoleEvents.ERROR)]: {
          target: createStateId(RoleStates.ERROR),
          description: '学习过程出错',
        },
      },
    };

    // 为其他状态添加学习转换
    const learningTransition = {
      target: createStateId(RoleStates.LEARNING),
      description: '进入学习状态',
    };

    standardConfig.states[createStateId(RoleStates.ACTING)].transitions[createEventType(RoleEvents.LEARN)] = learningTransition;
    standardConfig.states[createStateId(RoleStates.REACTING)].transitions[createEventType(RoleEvents.LEARN)] = learningTransition;

    return standardConfig;
  }

  /**
   * 创建协作型配置（扩展标准配置）
   */
  private static createCollaborativeConfig(
    roleId: string,
    context: RoleContext
  ): StateMachineConfig<RoleContext> {
    const standardConfig = this.createStandardConfig(roleId, context);
    
    // 为协作添加额外的转换逻辑
    // 这里可以添加团队协作相关的状态和转换
    
    return standardConfig;
  }
}

/**
 * 角色状态机类
 * 扩展基础状态机，添加角色专用功能
 */
export class RoleStateMachine extends StateMachine<RoleContext> {
  private readonly options: RoleStateMachineOptions;
  private stateTimeouts: Map<StateId, NodeJS.Timeout> = new Map();

  constructor(config: StateMachineConfig<RoleContext>, options: RoleStateMachineOptions = {}) {
    super(config, options);
    
    this.options = {
      maxRetries: 3,
      autoRecover: true,
      enableMetrics: true,
      ...options,
    };

    // 设置状态超时监控
    if (this.options.stateTimeouts) {
      this.setupStateTimeouts();
    }

    // 设置自动错误恢复
    if (this.options.autoRecover) {
      this.setupAutoRecovery();
    }
  }

  /**
   * 发送角色事件
   */
  async sendRoleEvent(event: RoleEvent): Promise<boolean> {
    if (!isRoleEvent(event)) {
      throw new Error('Invalid role event');
    }

    return this.send({
      type: event.type as EventType,
      data: event,
      timestamp: Date.now(),
      source: 'role',
    });
  }

  /**
   * 添加消息到队列
   */
  addMessage(message: Message): void {
    this.updateContext(ctx => ({
      ...ctx,
      messageQueue: [...ctx.messageQueue, message],
    }));
  }

  /**
   * 设置当前动作
   */
  setCurrentAction(action: Action | undefined): void {
    this.updateContext(ctx => ({
      ...ctx,
      currentAction: action,
    }));
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const context = this.getContext();
    return {
      ...context.stats,
      currentState: this.getCurrentState(),
      messageQueueSize: context.messageQueue.length,
      retryCount: context.retryCount,
      hasError: !!context.error,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.updateContext(ctx => ({
      ...ctx,
      stats: {
        observeCount: 0,
        thinkCount: 0,
        actCount: 0,
        reactCount: 0,
        errorCount: 0,
      },
      retryCount: 0,
      error: undefined,
    }));
  }

  /**
   * 设置状态超时监控
   */
  private setupStateTimeouts(): void {
    this.on('state:entered', (stateId) => {
      const timeout = this.options.stateTimeouts?.[stateId as RoleState];
      if (timeout) {
        const timeoutId = setTimeout(() => {
          logger.warn(`[${this.getId()}] State ${stateId} timeout after ${timeout}ms`);
          this.sendRoleEvent({ type: RoleEvents.ERROR, error: new Error(`State timeout: ${stateId}`) });
        }, timeout);
        
        this.stateTimeouts.set(stateId, timeoutId);
      }
    });

    this.on('state:exited', (stateId) => {
      const timeoutId = this.stateTimeouts.get(stateId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.stateTimeouts.delete(stateId);
      }
    });
  }

  /**
   * 设置自动错误恢复
   */
  private setupAutoRecovery(): void {
    this.on('state:entered', (stateId) => {
      if (stateId === createStateId(RoleStates.ERROR)) {
        const context = this.getContext();
        if (context.retryCount < context.maxRetries) {
          // 延迟自动恢复
          setTimeout(() => {
            this.sendRoleEvent({ type: RoleEvents.RESUME });
          }, 1000 * (context.retryCount + 1)); // 递增延迟
        }
      }
    });
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // 清理所有超时
    for (const timeoutId of this.stateTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.stateTimeouts.clear();

    // 停止状态机
    await this.stop();
  }
}
