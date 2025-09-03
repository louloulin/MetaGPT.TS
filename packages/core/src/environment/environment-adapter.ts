/**
 * 环境适配器系统
 * 
 * 提供环境系统的适配器模式实现，支持不同环境提供者的统一接口
 */

import { EventEmitter } from 'events';
import { Environment, EnvironmentConfig, EnvironmentType, EnvironmentInfo, EnvironmentMetrics } from './environment';
import { Role, Message } from '../types';
import { logger } from '../utils/logger';

/**
 * 环境适配器接口
 */
export interface EnvironmentAdapter {
  /** 适配器名称 */
  readonly name: string;
  /** 支持的环境类型 */
  readonly supportedTypes: EnvironmentType[];
  /** 是否已连接 */
  readonly isConnected: boolean;
  
  /** 连接到环境提供者 */
  connect(config: AdapterConfig): Promise<void>;
  /** 断开连接 */
  disconnect(): Promise<void>;
  /** 创建环境 */
  createEnvironment(config: EnvironmentConfig): Promise<string>;
  /** 销毁环境 */
  destroyEnvironment(environmentId: string): Promise<void>;
  /** 启动环境 */
  startEnvironment(environmentId: string): Promise<void>;
  /** 停止环境 */
  stopEnvironment(environmentId: string): Promise<void>;
  /** 获取环境信息 */
  getEnvironmentInfo(environmentId: string): Promise<EnvironmentInfo>;
  /** 获取环境指标 */
  getEnvironmentMetrics(environmentId: string): Promise<EnvironmentMetrics>;
  /** 添加角色到环境 */
  addRoleToEnvironment(environmentId: string, role: Role): Promise<void>;
  /** 从环境移除角色 */
  removeRoleFromEnvironment(environmentId: string, roleName: string): Promise<void>;
  /** 发送消息到环境 */
  sendMessageToEnvironment(environmentId: string, message: Message): Promise<void>;
}

/**
 * 适配器配置
 */
export interface AdapterConfig {
  /** 连接URL或端点 */
  endpoint?: string;
  /** 认证信息 */
  credentials?: {
    apiKey?: string;
    token?: string;
    username?: string;
    password?: string;
  };
  /** 连接选项 */
  options?: {
    timeout?: number;
    retries?: number;
    keepAlive?: boolean;
  };
  /** 其他配置 */
  [key: string]: any;
}

/**
 * 本地环境适配器
 */
export class LocalEnvironmentAdapter extends EventEmitter implements EnvironmentAdapter {
  public readonly name = 'LocalEnvironmentAdapter';
  public readonly supportedTypes: EnvironmentType[] = ['local'];
  
  private _isConnected = false;
  private environments: Map<string, Environment> = new Map();
  private config?: AdapterConfig;

  public get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(config: AdapterConfig): Promise<void> {
    this.config = config;
    this._isConnected = true;
    this.emit('connected');
    logger.info('Local environment adapter connected');
  }

  async disconnect(): Promise<void> {
    // 停止所有环境
    for (const [id, env] of this.environments) {
      try {
        await env.stop();
        await env.destroy();
      } catch (error) {
        logger.error(`Failed to cleanup environment ${id}:`, error);
      }
    }
    
    this.environments.clear();
    this._isConnected = false;
    this.emit('disconnected');
    logger.info('Local environment adapter disconnected');
  }

  async createEnvironment(config: EnvironmentConfig): Promise<string> {
    if (!this._isConnected) {
      throw new Error('Adapter not connected');
    }

    const environment = new Environment(config);
    const environmentId = environment.getInfo().id;
    
    this.environments.set(environmentId, environment);
    this.emit('environment:created', environmentId);
    
    logger.info(`Created local environment: ${environmentId}`);
    return environmentId;
  }

  async destroyEnvironment(environmentId: string): Promise<void> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    await environment.destroy();
    this.environments.delete(environmentId);
    this.emit('environment:destroyed', environmentId);
    
    logger.info(`Destroyed local environment: ${environmentId}`);
  }

  async startEnvironment(environmentId: string): Promise<void> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    await environment.start();
    this.emit('environment:started', environmentId);
    
    logger.info(`Started local environment: ${environmentId}`);
  }

  async stopEnvironment(environmentId: string): Promise<void> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    await environment.stop();
    this.emit('environment:stopped', environmentId);
    
    logger.info(`Stopped local environment: ${environmentId}`);
  }

  async getEnvironmentInfo(environmentId: string): Promise<EnvironmentInfo> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    return environment.getInfo();
  }

  async getEnvironmentMetrics(environmentId: string): Promise<EnvironmentMetrics> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    // 获取当前指标（这里简化实现）
    const info = environment.getInfo();
    return {
      environmentId: info.id,
      currentState: info.state,
      uptime: info.startedAt ? Date.now() - info.startedAt.getTime() : 0,
      cpuUsage: Math.random() * 100, // 模拟数据
      memoryUsage: Math.random() * 1024,
      activeRoles: environment.getRoles().length,
      processedMessages: environment.history.length,
      errorCount: 0,
      lastUpdated: new Date(),
    };
  }

  async addRoleToEnvironment(environmentId: string, role: Role): Promise<void> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    environment.addRole(role);
    this.emit('role:added', environmentId, role.name);
    
    logger.info(`Added role ${role.name} to environment ${environmentId}`);
  }

  async removeRoleFromEnvironment(environmentId: string, roleName: string): Promise<void> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    environment.removeRole(roleName);
    this.emit('role:removed', environmentId, roleName);
    
    logger.info(`Removed role ${roleName} from environment ${environmentId}`);
  }

  async sendMessageToEnvironment(environmentId: string, message: Message): Promise<void> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    environment.publishMessage(message);
    this.emit('message:sent', environmentId, message);
    
    logger.debug(`Sent message to environment ${environmentId}`);
  }
}

/**
 * 云端环境适配器（模拟实现）
 */
export class CloudEnvironmentAdapter extends EventEmitter implements EnvironmentAdapter {
  public readonly name = 'CloudEnvironmentAdapter';
  public readonly supportedTypes: EnvironmentType[] = ['cloud'];
  
  private _isConnected = false;
  private config?: AdapterConfig;
  private apiClient?: any; // 模拟API客户端

  public get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(config: AdapterConfig): Promise<void> {
    this.config = config;
    
    // 模拟连接到云端API
    await this.initializeApiClient();
    
    this._isConnected = true;
    this.emit('connected');
    logger.info('Cloud environment adapter connected');
  }

  async disconnect(): Promise<void> {
    this.apiClient = undefined;
    this._isConnected = false;
    this.emit('disconnected');
    logger.info('Cloud environment adapter disconnected');
  }

  async createEnvironment(config: EnvironmentConfig): Promise<string> {
    if (!this._isConnected) {
      throw new Error('Adapter not connected');
    }

    // 模拟云端环境创建
    const environmentId = `cloud-env-${Date.now()}`;
    
    logger.info(`Creating cloud environment: ${environmentId}`);
    await this.simulateApiCall('POST', '/environments', config);
    
    this.emit('environment:created', environmentId);
    return environmentId;
  }

  async destroyEnvironment(environmentId: string): Promise<void> {
    await this.simulateApiCall('DELETE', `/environments/${environmentId}`);
    this.emit('environment:destroyed', environmentId);
    logger.info(`Destroyed cloud environment: ${environmentId}`);
  }

  async startEnvironment(environmentId: string): Promise<void> {
    await this.simulateApiCall('POST', `/environments/${environmentId}/start`);
    this.emit('environment:started', environmentId);
    logger.info(`Started cloud environment: ${environmentId}`);
  }

  async stopEnvironment(environmentId: string): Promise<void> {
    await this.simulateApiCall('POST', `/environments/${environmentId}/stop`);
    this.emit('environment:stopped', environmentId);
    logger.info(`Stopped cloud environment: ${environmentId}`);
  }

  async getEnvironmentInfo(environmentId: string): Promise<EnvironmentInfo> {
    const response = await this.simulateApiCall('GET', `/environments/${environmentId}`);
    return response as EnvironmentInfo;
  }

  async getEnvironmentMetrics(environmentId: string): Promise<EnvironmentMetrics> {
    const response = await this.simulateApiCall('GET', `/environments/${environmentId}/metrics`);
    return response as EnvironmentMetrics;
  }

  async addRoleToEnvironment(environmentId: string, role: Role): Promise<void> {
    await this.simulateApiCall('POST', `/environments/${environmentId}/roles`, role);
    this.emit('role:added', environmentId, role.name);
    logger.info(`Added role ${role.name} to cloud environment ${environmentId}`);
  }

  async removeRoleFromEnvironment(environmentId: string, roleName: string): Promise<void> {
    await this.simulateApiCall('DELETE', `/environments/${environmentId}/roles/${roleName}`);
    this.emit('role:removed', environmentId, roleName);
    logger.info(`Removed role ${roleName} from cloud environment ${environmentId}`);
  }

  async sendMessageToEnvironment(environmentId: string, message: Message): Promise<void> {
    await this.simulateApiCall('POST', `/environments/${environmentId}/messages`, message);
    this.emit('message:sent', environmentId, message);
    logger.debug(`Sent message to cloud environment ${environmentId}`);
  }

  private async initializeApiClient(): Promise<void> {
    // 模拟API客户端初始化
    this.apiClient = {
      endpoint: this.config?.endpoint || 'https://api.example.com',
      credentials: this.config?.credentials,
    };
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async simulateApiCall(method: string, path: string, data?: any): Promise<any> {
    // 模拟API调用
    logger.debug(`Cloud API call: ${method} ${path}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 返回模拟数据
    return {
      success: true,
      data: data || {},
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * 适配器管理器
 */
export class AdapterManager {
  private adapters: Map<string, EnvironmentAdapter> = new Map();
  private typeToAdapter: Map<EnvironmentType, EnvironmentAdapter> = new Map();

  /**
   * 注册适配器
   */
  registerAdapter(adapter: EnvironmentAdapter): void {
    this.adapters.set(adapter.name, adapter);
    
    for (const type of adapter.supportedTypes) {
      this.typeToAdapter.set(type, adapter);
    }
    
    logger.info(`Registered adapter: ${adapter.name}`);
  }

  /**
   * 获取适配器
   */
  getAdapter(name: string): EnvironmentAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * 根据环境类型获取适配器
   */
  getAdapterForType(type: EnvironmentType): EnvironmentAdapter | undefined {
    return this.typeToAdapter.get(type);
  }

  /**
   * 获取所有适配器
   */
  getAllAdapters(): EnvironmentAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * 连接所有适配器
   */
  async connectAll(configs: Map<string, AdapterConfig>): Promise<void> {
    const promises = Array.from(this.adapters.entries()).map(async ([name, adapter]) => {
      const config = configs.get(name) || {};
      try {
        await adapter.connect(config);
        logger.info(`Connected adapter: ${name}`);
      } catch (error) {
        logger.error(`Failed to connect adapter ${name}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * 断开所有适配器
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        await adapter.disconnect();
        logger.info(`Disconnected adapter: ${adapter.name}`);
      } catch (error) {
        logger.error(`Failed to disconnect adapter ${adapter.name}:`, error);
      }
    });

    await Promise.all(promises);
  }
}

/**
 * 默认适配器管理器实例
 */
export const defaultAdapterManager = new AdapterManager();

// 注册默认适配器
defaultAdapterManager.registerAdapter(new LocalEnvironmentAdapter());
defaultAdapterManager.registerAdapter(new CloudEnvironmentAdapter());
