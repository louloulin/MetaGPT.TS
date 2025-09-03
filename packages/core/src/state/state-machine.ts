/**
 * TypeScript原生状态机实现
 * 
 * 充分利用TypeScript特性的状态机核心实现：
 * - 泛型约束和类型推导
 * - 事件驱动架构
 * - 类型安全的状态转换
 * - 异步状态处理
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { SerializationMixin, SerializeField, SerializableClass } from '../base/serialization';
import type {
  StateId,
  EventType,
  StateConfig,
  StateMachineConfig,
  StateSnapshot,
  StateHistoryEntry,
  StateMachineEvent,
  StateMachineOptions,
  StateGuard,
  StateEffect,
  StateTransition,
} from './types';

/**
 * 状态机事件
 */
export interface StateMachineEvents<TContext = any> {
  'state:changed': (snapshot: StateSnapshot<TContext>) => void;
  'state:entered': (stateId: StateId, context: TContext) => void;
  'state:exited': (stateId: StateId, context: TContext) => void;
  'transition:started': (from: StateId, to: StateId, event: StateMachineEvent) => void;
  'transition:completed': (from: StateId, to: StateId, event: StateMachineEvent, duration: number) => void;
  'transition:failed': (from: StateId, to: StateId, event: StateMachineEvent, error: Error) => void;
  'error': (error: Error) => void;
}

/**
 * TypeScript原生状态机实现
 * 
 * 特性：
 * - 类型安全的状态和事件定义
 * - 异步状态转换支持
 * - 状态历史追踪
 * - 状态持久化
 * - 事件驱动架构
 */
@SerializableClass({ 
  typeName: 'StateMachine',
  version: '1.0.0'
})
export class StateMachine<TContext = any> extends SerializationMixin {
  private readonly emitter = new EventEmitter();
  
  @SerializeField()
  private readonly id: string;
  
  @SerializeField()
  private currentState: StateId;
  
  @SerializeField()
  private context: TContext;
  
  @SerializeField()
  private readonly states: Map<StateId, StateConfig<TContext>>;
  
  @SerializeField()
  private readonly history: StateHistoryEntry[] = [];
  
  @SerializeField({ serialize: false })
  private readonly options: StateMachineOptions;
  
  @SerializeField({ serialize: false })
  private isRunning = false;
  
  @SerializeField({ serialize: false })
  private transitionPromise: Promise<void> | null = null;

  constructor(config: StateMachineConfig<TContext>, options: StateMachineOptions = {}) {
    super();
    
    this.id = config.id;
    this.currentState = config.initial;
    this.context = { ...config.context };
    this.states = new Map(Object.entries(config.states));
    this.options = {
      debug: false,
      maxHistorySize: 1000,
      ...options,
    };

    // 验证配置
    this.validateConfig(config);
    
    if (this.options.debug) {
      logger.debug(`[StateMachine:${this.id}] Initialized with initial state: ${this.currentState}`);
    }
  }

  /**
   * 启动状态机
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn(`[StateMachine:${this.id}] Already running`);
      return;
    }

    this.isRunning = true;
    
    // 进入初始状态
    await this.enterState(this.currentState);
    
    this.emitEvent('state:changed', this.getSnapshot());
    
    if (this.options.debug) {
      logger.debug(`[StateMachine:${this.id}] Started`);
    }
  }

  /**
   * 停止状态机
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // 等待当前转换完成
    if (this.transitionPromise) {
      await this.transitionPromise;
    }

    // 退出当前状态
    await this.exitState(this.currentState);
    
    this.isRunning = false;
    
    if (this.options.debug) {
      logger.debug(`[StateMachine:${this.id}] Stopped`);
    }
  }

  /**
   * 发送事件到状态机
   */
  async send<T extends EventType>(event: StateMachineEvent<T>): Promise<boolean> {
    if (!this.isRunning) {
      logger.warn(`[StateMachine:${this.id}] Cannot send event to stopped state machine`);
      return false;
    }

    // 等待当前转换完成
    if (this.transitionPromise) {
      await this.transitionPromise;
    }

    const currentStateConfig = this.states.get(this.currentState);
    if (!currentStateConfig) {
      throw new Error(`State ${this.currentState} not found`);
    }

    const transition = currentStateConfig.transitions[event.type];
    if (!transition) {
      if (this.options.debug) {
        logger.debug(`[StateMachine:${this.id}] No transition for event ${event.type} in state ${this.currentState}`);
      }
      return false;
    }

    // 执行状态转换
    this.transitionPromise = this.executeTransition(transition, event);
    const transitionResult = await this.transitionPromise;
    this.transitionPromise = null;

    return transitionResult;
  }

  /**
   * 获取当前状态快照
   */
  getSnapshot(): StateSnapshot<TContext> {
    const currentStateConfig = this.states.get(this.currentState);
    
    return {
      value: this.currentState,
      context: { ...this.context },
      history: [...this.history],
      done: currentStateConfig?.final || false,
      meta: currentStateConfig?.meta || {},
      timestamp: Date.now(),
    };
  }

  /**
   * 获取状态机ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): StateId {
    return this.currentState;
  }

  /**
   * 获取上下文
   */
  getContext(): TContext {
    return { ...this.context };
  }

  /**
   * 更新上下文
   */
  updateContext(updater: (context: TContext) => TContext): void {
    this.context = updater(this.context);
    this.emitEvent('state:changed', this.getSnapshot());
  }

  /**
   * 检查是否可以转换到指定状态
   */
  canTransition(eventType: EventType): boolean {
    const currentStateConfig = this.states.get(this.currentState);
    return currentStateConfig?.transitions[eventType] !== undefined;
  }

  /**
   * 获取可用的转换事件
   */
  getAvailableTransitions(): EventType[] {
    const currentStateConfig = this.states.get(this.currentState);
    return currentStateConfig ? Object.keys(currentStateConfig.transitions) as EventType[] : [];
  }

  /**
   * 监听状态机事件
   */
  on<K extends keyof StateMachineEvents<TContext>>(
    event: K,
    listener: StateMachineEvents<TContext>[K]
  ): this {
    this.emitter.on(event, listener);
    return this;
  }

  /**
   * 移除事件监听器
   */
  off<K extends keyof StateMachineEvents<TContext>>(
    event: K,
    listener: StateMachineEvents<TContext>[K]
  ): this {
    this.emitter.off(event, listener);
    return this;
  }

  /**
   * 执行状态转换
   */
  private async executeTransition(
    transition: StateTransition<TContext>,
    event: StateMachineEvent
  ): Promise<boolean> {
    const fromState = this.currentState;
    const toState = transition.target;
    const startTime = Date.now();

    try {
      this.emitEvent('transition:started', fromState, toState, event);

      // 检查转换守卫
      if (transition.guard) {
        const canTransition = await transition.guard(this.context, event);
        if (!canTransition) {
          if (this.options.debug) {
            logger.debug(`[StateMachine:${this.id}] Transition guard blocked ${fromState} -> ${toState}`);
          }
          return false;
        }
      }

      // 退出当前状态
      await this.exitState(fromState);

      // 执行转换副作用
      if (transition.effect) {
        await transition.effect(this.context, event);
      }

      // 更新当前状态
      this.currentState = toState;

      // 进入新状态
      await this.enterState(toState);

      // 记录历史
      const duration = Date.now() - startTime;
      this.addToHistory({
        timestamp: startTime,
        from: fromState,
        to: toState,
        event: event.type,
        eventData: event.data,
        duration,
      });

      this.emitEvent('transition:completed', fromState, toState, event, duration);
      this.emitEvent('state:changed', this.getSnapshot());

      if (this.options.debug) {
        logger.debug(`[StateMachine:${this.id}] Transitioned ${fromState} -> ${toState} (${duration}ms)`);
      }

      return true;

    } catch (error) {
      this.emitEvent('transition:failed', fromState, toState, event, error as Error);
      this.emitEvent('error', error as Error);
      throw error;
    }
  }

  /**
   * 进入状态
   */
  private async enterState(stateId: StateId): Promise<void> {
    const stateConfig = this.states.get(stateId);
    if (!stateConfig) {
      throw new Error(`State ${stateId} not found`);
    }

    if (stateConfig.onEntry) {
      await stateConfig.onEntry(this.context, { type: 'ENTER' as EventType });
    }

    this.emitEvent('state:entered', stateId, this.context);
  }

  /**
   * 退出状态
   */
  private async exitState(stateId: StateId): Promise<void> {
    const stateConfig = this.states.get(stateId);
    if (!stateConfig) {
      throw new Error(`State ${stateId} not found`);
    }

    if (stateConfig.onExit) {
      await stateConfig.onExit(this.context, { type: 'EXIT' as EventType });
    }

    this.emitEvent('state:exited', stateId, this.context);
  }

  /**
   * 添加历史记录
   */
  private addToHistory(entry: StateHistoryEntry): void {
    this.history.push(entry);
    
    // 限制历史记录大小
    if (this.options.maxHistorySize && this.history.length > this.options.maxHistorySize) {
      this.history.splice(0, this.history.length - this.options.maxHistorySize);
    }
  }

  /**
   * 发射事件
   */
  private emitEvent<K extends keyof StateMachineEvents<TContext>>(
    event: K,
    ...args: Parameters<StateMachineEvents<TContext>[K]>
  ): void {
    this.emitter.emit(event, ...args);
  }

  /**
   * 验证状态机配置
   */
  private validateConfig(config: StateMachineConfig<TContext>): void {
    // 检查初始状态是否存在
    if (!config.states[config.initial]) {
      throw new Error(`Initial state ${config.initial} not found in states`);
    }

    // 检查所有转换的目标状态是否存在
    for (const [stateId, stateConfig] of Object.entries(config.states)) {
      for (const [eventType, transition] of Object.entries(stateConfig.transitions)) {
        if (!config.states[transition.target]) {
          throw new Error(`Target state ${transition.target} not found for transition ${stateId} -> ${eventType}`);
        }
      }
    }
  }

  /**
   * 序列化路径
   */
  getSerializationPath(): string {
    return `./state-machines/${this.id}.json`;
  }
}
