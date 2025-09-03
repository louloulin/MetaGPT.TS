/**
 * 环境集群管理系统
 * 
 * 提供多环境协调、负载均衡和故障转移功能
 */

import { EventEmitter } from 'events';
import { Environment, EnvironmentConfig, EnvironmentInfo, EnvironmentMetrics, EnvironmentId } from './environment';
import { EnvironmentFactory } from './environment-factory';
import { Role, Message } from '../types';
import { logger } from '../utils/logger';

/**
 * 集群配置
 */
export interface ClusterConfig {
  /** 集群名称 */
  name: string;
  /** 最大环境数量 */
  maxEnvironments: number;
  /** 负载均衡策略 */
  loadBalancingStrategy: 'round-robin' | 'least-connections' | 'weighted' | 'random';
  /** 故障转移配置 */
  failover: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    healthCheckInterval: number;
  };
  /** 自动扩缩容配置 */
  autoScaling: {
    enabled: boolean;
    minEnvironments: number;
    maxEnvironments: number;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
    cooldownPeriod: number;
  };
}

/**
 * 环境节点信息
 */
export interface EnvironmentNode {
  /** 环境实例 */
  environment: Environment;
  /** 节点权重 */
  weight: number;
  /** 当前连接数 */
  connections: number;
  /** 是否健康 */
  healthy: boolean;
  /** 最后健康检查时间 */
  lastHealthCheck: Date;
  /** 节点标签 */
  labels: Map<string, string>;
}

/**
 * 集群指标
 */
export interface ClusterMetrics {
  /** 集群名称 */
  clusterName: string;
  /** 总环境数 */
  totalEnvironments: number;
  /** 健康环境数 */
  healthyEnvironments: number;
  /** 总连接数 */
  totalConnections: number;
  /** 平均CPU使用率 */
  averageCpuUsage: number;
  /** 平均内存使用率 */
  averageMemoryUsage: number;
  /** 总处理消息数 */
  totalProcessedMessages: number;
  /** 最后更新时间 */
  lastUpdated: Date;
}

/**
 * 环境集群管理器
 */
export class EnvironmentCluster extends EventEmitter {
  private config: ClusterConfig;
  private nodes: Map<EnvironmentId, EnvironmentNode> = new Map();
  private factory: EnvironmentFactory;
  private currentIndex = 0; // 用于轮询负载均衡
  private healthCheckTimer?: NodeJS.Timer;
  private autoScalingTimer?: NodeJS.Timer;

  constructor(config: ClusterConfig, factory?: EnvironmentFactory) {
    super();
    this.config = config;
    this.factory = factory || new EnvironmentFactory();
  }

  /**
   * 启动集群
   */
  async start(): Promise<void> {
    logger.info(`Starting environment cluster: ${this.config.name}`);

    // 启动健康检查
    if (this.config.failover.enabled) {
      this.startHealthCheck();
    }

    // 启动自动扩缩容
    if (this.config.autoScaling.enabled) {
      this.startAutoScaling();
    }

    this.emit('cluster:started', this.config.name);
    logger.info(`Environment cluster started: ${this.config.name}`);
  }

  /**
   * 停止集群
   */
  async stop(): Promise<void> {
    logger.info(`Stopping environment cluster: ${this.config.name}`);

    // 停止定时器
    this.stopHealthCheck();
    this.stopAutoScaling();

    // 停止所有环境
    const stopPromises = Array.from(this.nodes.values()).map(async (node) => {
      try {
        await node.environment.stop();
        await node.environment.destroy();
      } catch (error) {
        logger.error(`Failed to stop environment ${node.environment.getInfo().id}:`, error);
      }
    });

    await Promise.all(stopPromises);
    this.nodes.clear();

    this.emit('cluster:stopped', this.config.name);
    logger.info(`Environment cluster stopped: ${this.config.name}`);
  }

  /**
   * 添加环境到集群
   */
  async addEnvironment(config: Partial<EnvironmentConfig>, weight = 1): Promise<EnvironmentId> {
    if (this.nodes.size >= this.config.maxEnvironments) {
      throw new Error(`Cluster ${this.config.name} has reached maximum environment limit`);
    }

    const environment = await this.factory.createEnvironment(config.type || 'local', config);

    // 只有在环境未启动时才启动
    const info = environment.getInfo();
    if (info.state === 'created') {
      await environment.start();
    }

    const node: EnvironmentNode = {
      environment,
      weight,
      connections: 0,
      healthy: true,
      lastHealthCheck: new Date(),
      labels: new Map(),
    };

    const environmentId = environment.getInfo().id;
    this.nodes.set(environmentId, node);

    this.emit('environment:added', environmentId);
    logger.info(`Added environment to cluster ${this.config.name}: ${environmentId}`);

    return environmentId;
  }

  /**
   * 从集群移除环境
   */
  async removeEnvironment(environmentId: EnvironmentId): Promise<void> {
    const node = this.nodes.get(environmentId);
    if (!node) {
      throw new Error(`Environment not found in cluster: ${environmentId}`);
    }

    await node.environment.stop();
    await node.environment.destroy();
    this.nodes.delete(environmentId);

    this.emit('environment:removed', environmentId);
    logger.info(`Removed environment from cluster ${this.config.name}: ${environmentId}`);
  }

  /**
   * 获取最佳环境（负载均衡）
   */
  getBestEnvironment(): Environment | null {
    const healthyNodes = Array.from(this.nodes.values()).filter(node => node.healthy);
    
    if (healthyNodes.length === 0) {
      return null;
    }

    let selectedNode: EnvironmentNode;

    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        selectedNode = this.getRoundRobinNode(healthyNodes);
        break;
      case 'least-connections':
        selectedNode = this.getLeastConnectionsNode(healthyNodes);
        break;
      case 'weighted':
        selectedNode = this.getWeightedNode(healthyNodes);
        break;
      case 'random':
        selectedNode = this.getRandomNode(healthyNodes);
        break;
      default:
        selectedNode = healthyNodes[0];
    }

    selectedNode.connections++;
    return selectedNode.environment;
  }

  /**
   * 释放环境连接
   */
  releaseEnvironment(environmentId: EnvironmentId): void {
    const node = this.nodes.get(environmentId);
    if (node && node.connections > 0) {
      node.connections--;
    }
  }

  /**
   * 添加角色到集群（自动选择环境）
   */
  async addRoleToCluster(role: Role): Promise<EnvironmentId> {
    const environment = this.getBestEnvironment();
    if (!environment) {
      throw new Error('No healthy environments available in cluster');
    }

    environment.addRole(role);
    const environmentId = environment.getInfo().id;
    
    this.emit('role:added', environmentId, role.name);
    logger.info(`Added role ${role.name} to cluster environment ${environmentId}`);

    return environmentId;
  }

  /**
   * 广播消息到所有环境
   */
  async broadcastMessage(message: Message): Promise<void> {
    const promises = Array.from(this.nodes.values())
      .filter(node => node.healthy)
      .map(async (node) => {
        try {
          await node.environment.broadcastMessage(message);
        } catch (error) {
          logger.error(`Failed to broadcast message to environment ${node.environment.getInfo().id}:`, error);
        }
      });

    await Promise.all(promises);
    this.emit('message:broadcast', message);
  }

  /**
   * 获取集群指标
   */
  getClusterMetrics(): ClusterMetrics {
    const nodes = Array.from(this.nodes.values());
    const healthyNodes = nodes.filter(node => node.healthy);

    let totalCpu = 0;
    let totalMemory = 0;
    let totalMessages = 0;
    let totalConnections = 0;

    for (const node of nodes) {
      totalConnections += node.connections;
      // 这里应该从环境获取实际指标，简化实现
      totalCpu += Math.random() * 100;
      totalMemory += Math.random() * 1024;
      totalMessages += node.environment.history.length;
    }

    return {
      clusterName: this.config.name,
      totalEnvironments: nodes.length,
      healthyEnvironments: healthyNodes.length,
      totalConnections,
      averageCpuUsage: nodes.length > 0 ? totalCpu / nodes.length : 0,
      averageMemoryUsage: nodes.length > 0 ? totalMemory / nodes.length : 0,
      totalProcessedMessages: totalMessages,
      lastUpdated: new Date(),
    };
  }

  /**
   * 获取所有环境信息
   */
  getEnvironments(): EnvironmentInfo[] {
    return Array.from(this.nodes.values()).map(node => node.environment.getInfo());
  }

  /**
   * 轮询负载均衡
   */
  private getRoundRobinNode(nodes: EnvironmentNode[]): EnvironmentNode {
    const node = nodes[this.currentIndex % nodes.length];
    this.currentIndex++;
    return node;
  }

  /**
   * 最少连接负载均衡
   */
  private getLeastConnectionsNode(nodes: EnvironmentNode[]): EnvironmentNode {
    return nodes.reduce((min, current) => 
      current.connections < min.connections ? current : min
    );
  }

  /**
   * 加权负载均衡
   */
  private getWeightedNode(nodes: EnvironmentNode[]): EnvironmentNode {
    const totalWeight = nodes.reduce((sum, node) => sum + node.weight, 0);
    let random = Math.random() * totalWeight;

    for (const node of nodes) {
      random -= node.weight;
      if (random <= 0) {
        return node;
      }
    }

    return nodes[0]; // 回退
  }

  /**
   * 随机负载均衡
   */
  private getRandomNode(nodes: EnvironmentNode[]): EnvironmentNode {
    return nodes[Math.floor(Math.random() * nodes.length)];
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.failover.healthCheckInterval);
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
    for (const [environmentId, node] of this.nodes) {
      try {
        const info = node.environment.getInfo();
        const wasHealthy = node.healthy;
        node.healthy = info.state === 'running';
        node.lastHealthCheck = new Date();

        if (wasHealthy && !node.healthy) {
          this.emit('environment:unhealthy', environmentId);
          logger.warn(`Environment became unhealthy: ${environmentId}`);
        } else if (!wasHealthy && node.healthy) {
          this.emit('environment:healthy', environmentId);
          logger.info(`Environment became healthy: ${environmentId}`);
        }
      } catch (error) {
        node.healthy = false;
        logger.error(`Health check failed for environment ${environmentId}:`, error);
      }
    }
  }

  /**
   * 启动自动扩缩容
   */
  private startAutoScaling(): void {
    this.autoScalingTimer = setInterval(() => {
      this.performAutoScaling();
    }, this.config.autoScaling.cooldownPeriod);
  }

  /**
   * 停止自动扩缩容
   */
  private stopAutoScaling(): void {
    if (this.autoScalingTimer) {
      clearInterval(this.autoScalingTimer);
      this.autoScalingTimer = undefined;
    }
  }

  /**
   * 执行自动扩缩容
   */
  private async performAutoScaling(): Promise<void> {
    const metrics = this.getClusterMetrics();
    const { autoScaling } = this.config;

    // 扩容检查
    if (metrics.totalEnvironments < autoScaling.maxEnvironments &&
        metrics.averageCpuUsage > autoScaling.scaleUpThreshold) {
      
      try {
        await this.addEnvironment({
          name: `auto-scaled-${Date.now()}`,
          type: 'local',
        });
        this.emit('cluster:scaled-up', metrics.totalEnvironments + 1);
        logger.info(`Cluster ${this.config.name} scaled up to ${metrics.totalEnvironments + 1} environments`);
      } catch (error) {
        logger.error(`Failed to scale up cluster ${this.config.name}:`, error);
      }
    }

    // 缩容检查
    if (metrics.totalEnvironments > autoScaling.minEnvironments &&
        metrics.averageCpuUsage < autoScaling.scaleDownThreshold) {
      
      // 找到连接数最少的环境进行移除
      const nodes = Array.from(this.nodes.values());
      const leastUsedNode = nodes.reduce((min, current) => 
        current.connections < min.connections ? current : min
      );

      if (leastUsedNode.connections === 0) {
        try {
          await this.removeEnvironment(leastUsedNode.environment.getInfo().id);
          this.emit('cluster:scaled-down', metrics.totalEnvironments - 1);
          logger.info(`Cluster ${this.config.name} scaled down to ${metrics.totalEnvironments - 1} environments`);
        } catch (error) {
          logger.error(`Failed to scale down cluster ${this.config.name}:`, error);
        }
      }
    }
  }
}
