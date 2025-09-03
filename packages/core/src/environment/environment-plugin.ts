/**
 * 环境插件系统
 * 
 * 提供可扩展的环境功能插件架构，支持动态加载和管理环境插件
 */

import { EventEmitter } from 'events';
import { Environment, EnvironmentInfo, EnvironmentMetrics } from './environment';
import { Role, Message } from '../types';
import { logger } from '../utils/logger';

/**
 * 插件生命周期钩子
 */
export interface PluginHooks {
  /** 环境创建前 */
  beforeEnvironmentCreate?: (config: any) => Promise<void> | void;
  /** 环境创建后 */
  afterEnvironmentCreate?: (environment: Environment) => Promise<void> | void;
  /** 环境启动前 */
  beforeEnvironmentStart?: (environment: Environment) => Promise<void> | void;
  /** 环境启动后 */
  afterEnvironmentStart?: (environment: Environment) => Promise<void> | void;
  /** 环境停止前 */
  beforeEnvironmentStop?: (environment: Environment) => Promise<void> | void;
  /** 环境停止后 */
  afterEnvironmentStop?: (environment: Environment) => Promise<void> | void;
  /** 角色添加前 */
  beforeRoleAdd?: (environment: Environment, role: Role) => Promise<void> | void;
  /** 角色添加后 */
  afterRoleAdd?: (environment: Environment, role: Role) => Promise<void> | void;
  /** 消息发送前 */
  beforeMessageSend?: (environment: Environment, message: Message) => Promise<void> | void;
  /** 消息发送后 */
  afterMessageSend?: (environment: Environment, message: Message) => Promise<void> | void;
}

/**
 * 环境插件接口
 */
export interface EnvironmentPlugin {
  /** 插件名称 */
  readonly name: string;
  /** 插件版本 */
  readonly version: string;
  /** 插件描述 */
  readonly description: string;
  /** 插件依赖 */
  readonly dependencies: string[];
  /** 是否已启用 */
  readonly enabled: boolean;
  
  /** 初始化插件 */
  initialize(manager: PluginManager): Promise<void>;
  /** 销毁插件 */
  destroy(): Promise<void>;
  /** 启用插件 */
  enable(): Promise<void>;
  /** 禁用插件 */
  disable(): Promise<void>;
  /** 获取插件配置 */
  getConfig(): Record<string, any>;
  /** 设置插件配置 */
  setConfig(config: Record<string, any>): void;
  /** 获取生命周期钩子 */
  getHooks(): PluginHooks;
}

/**
 * 基础插件抽象类
 */
export abstract class BaseEnvironmentPlugin extends EventEmitter implements EnvironmentPlugin {
  public abstract readonly name: string;
  public abstract readonly version: string;
  public abstract readonly description: string;
  public readonly dependencies: string[] = [];
  
  protected _enabled = false;
  protected _config: Record<string, any> = {};
  protected manager?: PluginManager;

  public get enabled(): boolean {
    return this._enabled;
  }

  async initialize(manager: PluginManager): Promise<void> {
    this.manager = manager;
    await this.onInitialize();
    logger.info(`Plugin initialized: ${this.name} v${this.version}`);
  }

  async destroy(): Promise<void> {
    await this.disable();
    await this.onDestroy();
    this.removeAllListeners();
    logger.info(`Plugin destroyed: ${this.name}`);
  }

  async enable(): Promise<void> {
    if (this._enabled) return;
    
    await this.onEnable();
    this._enabled = true;
    this.emit('enabled');
    logger.info(`Plugin enabled: ${this.name}`);
  }

  async disable(): Promise<void> {
    if (!this._enabled) return;
    
    await this.onDisable();
    this._enabled = false;
    this.emit('disabled');
    logger.info(`Plugin disabled: ${this.name}`);
  }

  getConfig(): Record<string, any> {
    return { ...this._config };
  }

  setConfig(config: Record<string, any>): void {
    this._config = { ...this._config, ...config };
    this.onConfigChange(this._config);
  }

  abstract getHooks(): PluginHooks;

  // 生命周期方法（子类可重写）
  protected async onInitialize(): Promise<void> {}
  protected async onDestroy(): Promise<void> {}
  protected async onEnable(): Promise<void> {}
  protected async onDisable(): Promise<void> {}
  protected onConfigChange(config: Record<string, any>): void {}
}

/**
 * 性能监控插件
 */
export class PerformanceMonitorPlugin extends BaseEnvironmentPlugin {
  public readonly name = 'PerformanceMonitor';
  public readonly version = '1.0.0';
  public readonly description = '环境性能监控插件';

  private monitoringInterval?: NodeJS.Timer;
  private performanceData: Map<string, any[]> = new Map();

  protected async onEnable(): Promise<void> {
    this.startMonitoring();
  }

  protected async onDisable(): Promise<void> {
    this.stopMonitoring();
  }

  getHooks(): PluginHooks {
    return {
      afterEnvironmentStart: async (environment) => {
        this.startEnvironmentMonitoring(environment);
      },
      beforeEnvironmentStop: async (environment) => {
        this.stopEnvironmentMonitoring(environment);
      },
    };
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectPerformanceData();
    }, this._config.interval || 5000);
  }

  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  private startEnvironmentMonitoring(environment: Environment): void {
    const envId = environment.getInfo().id;
    this.performanceData.set(envId, []);
    logger.debug(`Started monitoring environment: ${envId}`);
  }

  private stopEnvironmentMonitoring(environment: Environment): void {
    const envId = environment.getInfo().id;
    this.performanceData.delete(envId);
    logger.debug(`Stopped monitoring environment: ${envId}`);
  }

  private collectPerformanceData(): void {
    // 模拟性能数据收集
    const data = {
      timestamp: Date.now(),
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 1024,
      activeConnections: Math.floor(Math.random() * 100),
    };

    for (const [envId, history] of this.performanceData) {
      history.push(data);
      
      // 保持历史数据在合理范围内
      if (history.length > 100) {
        history.shift();
      }
    }

    this.emit('performance:data', data);
  }

  public getPerformanceData(environmentId: string): any[] {
    return this.performanceData.get(environmentId) || [];
  }
}

/**
 * 日志记录插件
 */
export class LoggingPlugin extends BaseEnvironmentPlugin {
  public readonly name = 'Logging';
  public readonly version = '1.0.0';
  public readonly description = '环境日志记录插件';

  private logBuffer: string[] = [];

  getHooks(): PluginHooks {
    return {
      afterEnvironmentCreate: async (environment) => {
        this.log(`Environment created: ${environment.getInfo().name}`);
      },
      afterEnvironmentStart: async (environment) => {
        this.log(`Environment started: ${environment.getInfo().name}`);
      },
      afterEnvironmentStop: async (environment) => {
        this.log(`Environment stopped: ${environment.getInfo().name}`);
      },
      afterRoleAdd: async (environment, role) => {
        this.log(`Role added to ${environment.getInfo().name}: ${role.name}`);
      },
      afterMessageSend: async (environment, message) => {
        this.log(`Message sent in ${environment.getInfo().name}: ${message.content.substring(0, 50)}...`);
      },
    };
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    
    this.logBuffer.push(logEntry);
    
    // 保持日志缓冲区大小
    const maxBufferSize = this._config.maxBufferSize || 1000;
    if (this.logBuffer.length > maxBufferSize) {
      this.logBuffer.shift();
    }

    this.emit('log', logEntry);
    
    if (this._config.console) {
      console.log(`[${this.name}] ${logEntry}`);
    }
  }

  public getLogs(): string[] {
    return [...this.logBuffer];
  }

  public clearLogs(): void {
    this.logBuffer.length = 0;
    this.emit('logs:cleared');
  }
}

/**
 * 安全审计插件
 */
export class SecurityAuditPlugin extends BaseEnvironmentPlugin {
  public readonly name = 'SecurityAudit';
  public readonly version = '1.0.0';
  public readonly description = '环境安全审计插件';

  private auditLog: Array<{ timestamp: Date; event: string; details: any }> = [];

  getHooks(): PluginHooks {
    return {
      beforeRoleAdd: async (environment, role) => {
        await this.auditRoleAddition(environment, role);
      },
      beforeMessageSend: async (environment, message) => {
        await this.auditMessageSend(environment, message);
      },
    };
  }

  private async auditRoleAddition(environment: Environment, role: Role): Promise<void> {
    const auditEntry = {
      timestamp: new Date(),
      event: 'role:add',
      details: {
        environmentId: environment.getInfo().id,
        roleName: role.name,
        roleProfile: role.profile,
      },
    };

    this.auditLog.push(auditEntry);
    this.emit('audit', auditEntry);

    // 安全检查
    if (this.isRoleSecure(role)) {
      logger.debug(`Role ${role.name} passed security audit`);
    } else {
      logger.warn(`Role ${role.name} failed security audit`);
      throw new Error(`Role ${role.name} does not meet security requirements`);
    }
  }

  private async auditMessageSend(environment: Environment, message: Message): Promise<void> {
    const auditEntry = {
      timestamp: new Date(),
      event: 'message:send',
      details: {
        environmentId: environment.getInfo().id,
        messageRole: message.role,
        messageLength: message.content.length,
        hasAttachments: false, // 简化实现
      },
    };

    this.auditLog.push(auditEntry);
    this.emit('audit', auditEntry);

    // 消息安全检查
    if (this.isMessageSecure(message)) {
      logger.debug(`Message from ${message.role} passed security audit`);
    } else {
      logger.warn(`Message from ${message.role} failed security audit`);
      throw new Error(`Message does not meet security requirements`);
    }
  }

  private isRoleSecure(role: Role): boolean {
    // 简化的安全检查
    return role.name.length > 0 && role.profile.length > 0;
  }

  private isMessageSecure(message: Message): boolean {
    // 简化的消息安全检查
    const suspiciousPatterns = ['<script>', 'javascript:', 'eval('];
    return !suspiciousPatterns.some(pattern => 
      message.content.toLowerCase().includes(pattern)
    );
  }

  public getAuditLog(): Array<{ timestamp: Date; event: string; details: any }> {
    return [...this.auditLog];
  }
}

/**
 * 插件管理器
 */
export class PluginManager extends EventEmitter {
  private plugins: Map<string, EnvironmentPlugin> = new Map();
  private hooks: Map<keyof PluginHooks, EnvironmentPlugin[]> = new Map();

  /**
   * 注册插件
   */
  async registerPlugin(plugin: EnvironmentPlugin): Promise<void> {
    // 检查依赖
    for (const dependency of plugin.dependencies) {
      if (!this.plugins.has(dependency)) {
        throw new Error(`Plugin dependency not found: ${dependency}`);
      }
    }

    // 初始化插件
    await plugin.initialize(this);
    
    // 注册插件
    this.plugins.set(plugin.name, plugin);
    
    // 注册钩子
    this.registerPluginHooks(plugin);
    
    this.emit('plugin:registered', plugin.name);
    logger.info(`Plugin registered: ${plugin.name} v${plugin.version}`);
  }

  /**
   * 卸载插件
   */
  async unregisterPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    // 检查是否有其他插件依赖此插件
    for (const [_, otherPlugin] of this.plugins) {
      if (otherPlugin.dependencies.includes(name)) {
        throw new Error(`Cannot unregister plugin ${name}: it is required by ${otherPlugin.name}`);
      }
    }

    // 销毁插件
    await plugin.destroy();
    
    // 移除插件
    this.plugins.delete(name);
    
    // 移除钩子
    this.unregisterPluginHooks(plugin);
    
    this.emit('plugin:unregistered', name);
    logger.info(`Plugin unregistered: ${name}`);
  }

  /**
   * 获取插件
   */
  getPlugin(name: string): EnvironmentPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): EnvironmentPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 启用插件
   */
  async enablePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    await plugin.enable();
    this.emit('plugin:enabled', name);
  }

  /**
   * 禁用插件
   */
  async disablePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    await plugin.disable();
    this.emit('plugin:disabled', name);
  }

  /**
   * 执行钩子
   */
  async executeHook<K extends keyof PluginHooks>(
    hookName: K,
    ...args: Parameters<NonNullable<PluginHooks[K]>>
  ): Promise<void> {
    const plugins = this.hooks.get(hookName) || [];
    
    for (const plugin of plugins) {
      if (!plugin.enabled) continue;
      
      try {
        const hooks = plugin.getHooks();
        const hook = hooks[hookName];
        if (hook) {
          await (hook as any)(...args);
        }
      } catch (error) {
        logger.error(`Plugin hook error in ${plugin.name}.${hookName}:`, error);
        this.emit('plugin:error', plugin.name, hookName, error);
      }
    }
  }

  /**
   * 注册插件钩子
   */
  private registerPluginHooks(plugin: EnvironmentPlugin): void {
    const hooks = plugin.getHooks();
    
    for (const hookName of Object.keys(hooks) as Array<keyof PluginHooks>) {
      if (!this.hooks.has(hookName)) {
        this.hooks.set(hookName, []);
      }
      this.hooks.get(hookName)!.push(plugin);
    }
  }

  /**
   * 移除插件钩子
   */
  private unregisterPluginHooks(plugin: EnvironmentPlugin): void {
    for (const [hookName, plugins] of this.hooks) {
      const index = plugins.indexOf(plugin);
      if (index !== -1) {
        plugins.splice(index, 1);
      }
    }
  }
}

/**
 * 默认插件管理器实例
 */
export const defaultPluginManager = new PluginManager();
