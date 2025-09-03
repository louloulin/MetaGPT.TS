/**
 * 环境工厂模式实现
 * 
 * 提供类型安全的环境创建和管理功能，支持多种环境类型的统一创建接口
 */

import { z } from 'zod';
import { Environment, EnvironmentConfig, EnvironmentType, createEnvironmentId } from './environment';
import { logger } from '../utils/logger';

/**
 * 环境工厂配置
 */
export interface EnvironmentFactoryConfig {
  /** 默认环境类型 */
  defaultType: EnvironmentType;
  /** 环境注册表 */
  registry: Map<EnvironmentType, EnvironmentProvider>;
  /** 全局配置 */
  globalConfig: Partial<EnvironmentConfig>;
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 最大缓存大小 */
  maxCacheSize: number;
}

/**
 * 环境提供者接口
 */
export interface EnvironmentProvider {
  /** 提供者名称 */
  name: string;
  /** 支持的环境类型 */
  supportedTypes: EnvironmentType[];
  /** 创建环境实例 */
  createEnvironment(config: Partial<EnvironmentConfig>): Promise<Environment>;
  /** 验证配置 */
  validateConfig(config: Partial<EnvironmentConfig>): boolean;
  /** 获取默认配置 */
  getDefaultConfig(): Partial<EnvironmentConfig>;
}

/**
 * 本地环境提供者
 */
export class LocalEnvironmentProvider implements EnvironmentProvider {
  public readonly name = 'LocalEnvironmentProvider';
  public readonly supportedTypes: EnvironmentType[] = ['local'];

  async createEnvironment(config: Partial<EnvironmentConfig>): Promise<Environment> {
    const localConfig = {
      ...this.getDefaultConfig(),
      ...config,
      type: 'local' as const,
    };

    logger.info(`Creating local environment: ${localConfig.name}`);
    return new Environment(localConfig);
  }

  validateConfig(config: Partial<EnvironmentConfig>): boolean {
    // 本地环境的基本验证
    return !!(config.name && config.name.length > 0);
  }

  getDefaultConfig(): Partial<EnvironmentConfig> {
    return {
      type: 'local',
      maxRoles: 10,
      maxHistorySize: 1000,
      enableMonitoring: true,
      enableAutoRecovery: false,
      healthCheckInterval: 30000,
      resourceLimits: {
        cpu: 2,
        memory: 1024,
        storage: 5000,
      },
      messageRouting: {
        enabled: true,
        maxConcurrency: 5,
        enableMetrics: true,
      },
      stateManagement: {
        enabled: true,
        persistence: false,
        debug: false,
      },
    };
  }
}

/**
 * 云端环境提供者
 */
export class CloudEnvironmentProvider implements EnvironmentProvider {
  public readonly name = 'CloudEnvironmentProvider';
  public readonly supportedTypes: EnvironmentType[] = ['cloud'];

  async createEnvironment(config: Partial<EnvironmentConfig>): Promise<Environment> {
    const cloudConfig = {
      ...this.getDefaultConfig(),
      ...config,
      type: 'cloud' as const,
    };

    logger.info(`Creating cloud environment: ${cloudConfig.name}`);
    
    // 云端环境可能需要额外的初始化步骤
    await this.initializeCloudResources(cloudConfig);
    
    return new Environment(cloudConfig);
  }

  validateConfig(config: Partial<EnvironmentConfig>): boolean {
    // 云端环境需要更严格的验证
    return !!(
      config.name && 
      config.name.length > 0 &&
      config.resourceLimits &&
      config.resourceLimits.cpu &&
      config.resourceLimits.memory
    );
  }

  getDefaultConfig(): Partial<EnvironmentConfig> {
    return {
      type: 'cloud',
      maxRoles: 50,
      maxHistorySize: 10000,
      enableMonitoring: true,
      enableAutoRecovery: true,
      healthCheckInterval: 15000,
      resourceLimits: {
        cpu: 8,
        memory: 8192,
        storage: 50000,
        bandwidth: 1000,
        connections: 1000,
      },
      messageRouting: {
        enabled: true,
        maxConcurrency: 20,
        enableMetrics: true,
      },
      stateManagement: {
        enabled: true,
        persistence: true,
        debug: false,
      },
    };
  }

  private async initializeCloudResources(config: Partial<EnvironmentConfig>): Promise<void> {
    // 模拟云端资源初始化
    logger.debug(`Initializing cloud resources for ${config.name}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * 容器化环境提供者
 */
export class ContainerEnvironmentProvider implements EnvironmentProvider {
  public readonly name = 'ContainerEnvironmentProvider';
  public readonly supportedTypes: EnvironmentType[] = ['container'];

  async createEnvironment(config: Partial<EnvironmentConfig>): Promise<Environment> {
    const containerConfig = {
      ...this.getDefaultConfig(),
      ...config,
      type: 'container' as const,
    };

    logger.info(`Creating container environment: ${containerConfig.name}`);
    
    // 容器环境可能需要容器编排
    await this.setupContainer(containerConfig);
    
    return new Environment(containerConfig);
  }

  validateConfig(config: Partial<EnvironmentConfig>): boolean {
    // 容器环境的验证
    return !!(config.name && config.resourceLimits);
  }

  getDefaultConfig(): Partial<EnvironmentConfig> {
    return {
      type: 'container',
      maxRoles: 20,
      maxHistorySize: 5000,
      enableMonitoring: true,
      enableAutoRecovery: true,
      healthCheckInterval: 10000,
      resourceLimits: {
        cpu: 4,
        memory: 4096,
        storage: 20000,
        connections: 500,
      },
      messageRouting: {
        enabled: true,
        maxConcurrency: 10,
        enableMetrics: true,
      },
      stateManagement: {
        enabled: true,
        persistence: false,
        debug: false,
      },
    };
  }

  private async setupContainer(config: Partial<EnvironmentConfig>): Promise<void> {
    // 模拟容器设置
    logger.debug(`Setting up container for ${config.name}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

/**
 * 环境工厂类
 */
export class EnvironmentFactory {
  private config: EnvironmentFactoryConfig;
  private environmentCache: Map<string, Environment> = new Map();

  constructor(config?: Partial<EnvironmentFactoryConfig>) {
    this.config = {
      defaultType: 'local',
      registry: new Map(),
      globalConfig: {},
      enableCache: true,
      maxCacheSize: 100,
      ...config,
    };

    // 注册默认提供者
    this.registerDefaultProviders();
  }

  /**
   * 注册默认环境提供者
   */
  private registerDefaultProviders(): void {
    this.registerProvider(new LocalEnvironmentProvider());
    this.registerProvider(new CloudEnvironmentProvider());
    this.registerProvider(new ContainerEnvironmentProvider());
  }

  /**
   * 注册环境提供者
   */
  public registerProvider(provider: EnvironmentProvider): void {
    for (const type of provider.supportedTypes) {
      this.config.registry.set(type, provider);
      logger.debug(`Registered provider ${provider.name} for type ${type}`);
    }
  }

  /**
   * 创建环境
   */
  public async createEnvironment(
    type: EnvironmentType = this.config.defaultType,
    config: Partial<EnvironmentConfig> = {}
  ): Promise<Environment> {
    const cacheKey = this.generateCacheKey(type, config);
    
    // 检查缓存
    if (this.config.enableCache && this.environmentCache.has(cacheKey)) {
      const cachedEnv = this.environmentCache.get(cacheKey)!;
      logger.debug(`Returning cached environment: ${cacheKey}`);
      return cachedEnv;
    }

    // 获取提供者
    const provider = this.config.registry.get(type);
    if (!provider) {
      throw new Error(`No provider registered for environment type: ${type}`);
    }

    // 合并配置
    const mergedConfig = {
      ...this.config.globalConfig,
      ...provider.getDefaultConfig(),
      ...config,
      type,
    };

    // 验证配置
    if (!provider.validateConfig(mergedConfig)) {
      throw new Error(`Invalid configuration for environment type: ${type}`);
    }

    // 创建环境
    const environment = await provider.createEnvironment(mergedConfig);

    // 缓存环境
    if (this.config.enableCache) {
      this.cacheEnvironment(cacheKey, environment);
    }

    logger.info(`Created environment: ${environment.getInfo().id} (type: ${type})`);
    return environment;
  }

  /**
   * 批量创建环境
   */
  public async createEnvironments(
    requests: Array<{ type: EnvironmentType; config: Partial<EnvironmentConfig> }>
  ): Promise<Environment[]> {
    const environments = await Promise.all(
      requests.map(req => this.createEnvironment(req.type, req.config))
    );

    logger.info(`Created ${environments.length} environments`);
    return environments;
  }

  /**
   * 获取支持的环境类型
   */
  public getSupportedTypes(): EnvironmentType[] {
    return Array.from(this.config.registry.keys());
  }

  /**
   * 获取环境提供者信息
   */
  public getProviderInfo(type: EnvironmentType): EnvironmentProvider | undefined {
    return this.config.registry.get(type);
  }

  /**
   * 清理缓存
   */
  public clearCache(): void {
    this.environmentCache.clear();
    logger.debug('Environment cache cleared');
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(type: EnvironmentType, config: Partial<EnvironmentConfig>): string {
    const configHash = JSON.stringify(config);
    return `${type}:${Buffer.from(configHash).toString('base64').substring(0, 16)}`;
  }

  /**
   * 缓存环境
   */
  private cacheEnvironment(key: string, environment: Environment): void {
    // 检查缓存大小限制
    if (this.environmentCache.size >= this.config.maxCacheSize) {
      // 移除最旧的缓存项
      const firstKey = this.environmentCache.keys().next().value;
      this.environmentCache.delete(firstKey);
    }

    this.environmentCache.set(key, environment);
    logger.debug(`Cached environment: ${key}`);
  }
}

/**
 * 默认环境工厂实例
 */
export const defaultEnvironmentFactory = new EnvironmentFactory();

/**
 * 便捷函数：创建本地环境
 */
export async function createLocalEnvironment(config: Partial<EnvironmentConfig> = {}): Promise<Environment> {
  return defaultEnvironmentFactory.createEnvironment('local', config);
}

/**
 * 便捷函数：创建云端环境
 */
export async function createCloudEnvironment(config: Partial<EnvironmentConfig> = {}): Promise<Environment> {
  return defaultEnvironmentFactory.createEnvironment('cloud', config);
}

/**
 * 便捷函数：创建容器化环境
 */
export async function createContainerEnvironment(config: Partial<EnvironmentConfig> = {}): Promise<Environment> {
  return defaultEnvironmentFactory.createEnvironment('container', config);
}
