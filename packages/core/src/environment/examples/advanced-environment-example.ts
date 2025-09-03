/**
 * 环境系统高级功能综合示例
 * 
 * 展示环境工厂、适配器、插件和集群管理的完整功能
 */

import {
  Environment,
  EnvironmentFactory,
  EnvironmentCluster,
  PerformanceMonitorPlugin,
  LoggingPlugin,
  SecurityAuditPlugin,
  PluginManager,
  LocalEnvironmentAdapter,
  AdapterManager,
  createLocalEnvironment,
  createCloudEnvironment,
  createContainerEnvironment,
} from '../index';
import { UserMessage, SystemMessage } from '../../types/message';
import { Role, Message } from '../../types';
import { logger } from '../../utils/logger';

// 示例角色实现
class AdvancedRole implements Role {
  public name: string;
  public profile: string;
  public goal: string;
  public constraints: string;
  public actions: any[] = [];
  public context: any = {};

  private _isIdle: boolean = true;
  private messageCount: number = 0;

  constructor(name: string, profile: string, goal: string) {
    this.name = name;
    this.profile = profile;
    this.goal = goal;
    this.constraints = 'Follow best practices and be helpful';
  }

  async observe(): Promise<boolean> {
    console.log(`🔍 ${this.name} is observing...`);
    return true;
  }

  async think(): Promise<boolean> {
    console.log(`🤔 ${this.name} is thinking...`);
    await this.delay(50);
    return true;
  }

  async act(): Promise<Message> {
    console.log(`⚡ ${this.name} is acting...`);
    this.messageCount++;
    
    const message = new UserMessage(
      `Action result from ${this.name} (message #${this.messageCount})`
    );
    message.role = this.name;
    
    await this.delay(100);
    return message;
  }

  async react(message?: Message): Promise<Message> {
    console.log(`🔄 ${this.name} is reacting to: ${message?.content || 'unknown'}`);
    
    const response = new UserMessage(
      `${this.name} reacts: I received "${message?.content}"`
    );
    response.role = this.name;
    
    return response;
  }

  async run(message?: Message): Promise<Message> {
    console.log(`🏃 ${this.name} is running...`);
    
    await this.observe();
    await this.think();
    const result = await this.act();
    
    this._isIdle = Math.random() > 0.3;
    
    return result;
  }

  isIdle(): boolean {
    return this._isIdle;
  }

  setEnvironment(env: Environment): void {
    console.log(`🌍 ${this.name} joined environment: ${env.getInfo().name}`);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 环境工厂示例
 */
async function environmentFactoryExample(): Promise<void> {
  console.log('\n🏭 环境工厂示例\n');

  const factory = new EnvironmentFactory();

  // 创建不同类型的环境
  console.log('创建不同类型的环境:');
  
  const localEnv = await createLocalEnvironment({
    name: 'LocalDev',
    maxRoles: 5,
  });
  console.log(`✅ 本地环境: ${localEnv.getInfo().name}`);

  const cloudEnv = await createCloudEnvironment({
    name: 'CloudProd',
    maxRoles: 20,
  });
  console.log(`☁️ 云端环境: ${cloudEnv.getInfo().name}`);

  const containerEnv = await createContainerEnvironment({
    name: 'ContainerTest',
    maxRoles: 10,
  });
  console.log(`🐳 容器环境: ${containerEnv.getInfo().name}`);

  // 批量创建环境
  console.log('\n批量创建环境:');
  const environments = await factory.createEnvironments([
    { type: 'local', config: { name: 'Batch1' } },
    { type: 'cloud', config: { name: 'Batch2' } },
    { type: 'container', config: { name: 'Batch3' } },
  ]);

  console.log(`✅ 批量创建了 ${environments.length} 个环境`);

  // 清理
  for (const env of [localEnv, cloudEnv, containerEnv, ...environments]) {
    await env.destroy();
  }
}

/**
 * 环境插件示例
 */
async function environmentPluginExample(): Promise<void> {
  console.log('\n🔌 环境插件示例\n');

  const pluginManager = new PluginManager();

  // 创建插件
  const performancePlugin = new PerformanceMonitorPlugin();
  const loggingPlugin = new LoggingPlugin();
  const securityPlugin = new SecurityAuditPlugin();

  // 注册插件
  await pluginManager.registerPlugin(performancePlugin);
  await pluginManager.registerPlugin(loggingPlugin);
  await pluginManager.registerPlugin(securityPlugin);

  // 启用插件
  await pluginManager.enablePlugin('PerformanceMonitor');
  await pluginManager.enablePlugin('Logging');
  await pluginManager.enablePlugin('SecurityAudit');

  console.log('✅ 插件已注册并启用');

  // 创建环境并触发插件钩子
  const environment = new Environment({
    name: 'PluginTestEnv',
    type: 'local',
  });

  await pluginManager.executeHook('afterEnvironmentCreate', environment);
  await environment.start();
  await pluginManager.executeHook('afterEnvironmentStart', environment);

  // 添加角色
  const role = new AdvancedRole('PluginRole', 'Test Role', 'Test plugin functionality');
  await pluginManager.executeHook('beforeRoleAdd', environment, role);
  environment.addRole(role);
  await pluginManager.executeHook('afterRoleAdd', environment, role);

  // 发送消息
  const message = new UserMessage('Plugin test message');
  await pluginManager.executeHook('beforeMessageSend', environment, message);
  environment.publishMessage(message);
  await pluginManager.executeHook('afterMessageSend', environment, message);

  // 查看日志
  const logs = loggingPlugin.getLogs();
  console.log(`📝 插件日志记录了 ${logs.length} 条记录`);

  // 查看审计日志
  const auditLog = securityPlugin.getAuditLog();
  console.log(`🔒 安全审计记录了 ${auditLog.length} 条记录`);

  // 清理
  await environment.destroy();
  await pluginManager.unregisterPlugin('SecurityAudit');
  await pluginManager.unregisterPlugin('Logging');
  await pluginManager.unregisterPlugin('PerformanceMonitor');
}

/**
 * 环境适配器示例
 */
async function environmentAdapterExample(): Promise<void> {
  console.log('\n🔌 环境适配器示例\n');

  const adapterManager = new AdapterManager();
  const localAdapter = new LocalEnvironmentAdapter();

  // 注册适配器
  adapterManager.registerAdapter(localAdapter);

  // 连接适配器
  await localAdapter.connect({
    options: { timeout: 5000 }
  });

  console.log('✅ 适配器已连接');

  // 通过适配器创建环境
  const envId = await localAdapter.createEnvironment({
    name: 'AdapterEnv',
    type: 'local',
    maxRoles: 5,
  });

  console.log(`🌍 通过适配器创建环境: ${envId}`);

  // 启动环境
  await localAdapter.startEnvironment(envId);

  // 添加角色
  const role = new AdvancedRole('AdapterRole', 'Adapter Test', 'Test adapter functionality');
  await localAdapter.addRoleToEnvironment(envId, role);

  // 发送消息
  const message = new UserMessage('Adapter test message');
  await localAdapter.sendMessageToEnvironment(envId, message);

  // 获取环境信息
  const info = await localAdapter.getEnvironmentInfo(envId);
  console.log(`📊 环境信息: ${info.name} (${info.state})`);

  // 获取环境指标
  const metrics = await localAdapter.getEnvironmentMetrics(envId);
  console.log(`📈 环境指标: ${metrics.activeRoles} 个活跃角色`);

  // 清理
  await localAdapter.stopEnvironment(envId);
  await localAdapter.destroyEnvironment(envId);
  await localAdapter.disconnect();
}

/**
 * 环境集群示例
 */
async function environmentClusterExample(): Promise<void> {
  console.log('\n🏢 环境集群示例\n');

  const cluster = new EnvironmentCluster({
    name: 'ProductionCluster',
    maxEnvironments: 10,
    loadBalancingStrategy: 'round-robin',
    failover: {
      enabled: false, // 简化示例
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 5000,
    },
    autoScaling: {
      enabled: false, // 简化示例
      minEnvironments: 2,
      maxEnvironments: 8,
      scaleUpThreshold: 80,
      scaleDownThreshold: 20,
      cooldownPeriod: 30000,
    },
  });

  // 启动集群
  await cluster.start();
  console.log('✅ 集群已启动');

  // 添加环境到集群
  const env1Id = await cluster.addEnvironment({
    name: 'ClusterEnv1',
    type: 'local',
    maxRoles: 5,
  });

  const env2Id = await cluster.addEnvironment({
    name: 'ClusterEnv2',
    type: 'cloud',
    maxRoles: 10,
  });

  const env3Id = await cluster.addEnvironment({
    name: 'ClusterEnv3',
    type: 'container',
    maxRoles: 8,
  });

  console.log(`🌍 集群中添加了 3 个环境`);

  // 负载均衡测试
  console.log('\n负载均衡测试:');
  for (let i = 0; i < 6; i++) {
    const env = cluster.getBestEnvironment();
    if (env) {
      console.log(`  请求 ${i + 1} -> 环境: ${env.getInfo().name}`);
      cluster.releaseEnvironment(env.getInfo().id);
    }
  }

  // 添加角色到集群
  const roles = [
    new AdvancedRole('ClusterRole1', 'Cluster Worker', 'Handle cluster tasks'),
    new AdvancedRole('ClusterRole2', 'Cluster Manager', 'Manage cluster operations'),
    new AdvancedRole('ClusterRole3', 'Cluster Monitor', 'Monitor cluster health'),
  ];

  for (const role of roles) {
    const envId = await cluster.addRoleToCluster(role);
    console.log(`👤 角色 ${role.name} 添加到环境 ${envId}`);
  }

  // 广播消息
  const broadcastMessage = new SystemMessage('集群广播消息：系统维护通知');
  await cluster.broadcastMessage(broadcastMessage);
  console.log('📢 广播消息已发送到所有环境');

  // 获取集群指标
  const metrics = cluster.getClusterMetrics();
  console.log('\n📊 集群指标:');
  console.log(`  - 总环境数: ${metrics.totalEnvironments}`);
  console.log(`  - 健康环境数: ${metrics.healthyEnvironments}`);
  console.log(`  - 总连接数: ${metrics.totalConnections}`);
  console.log(`  - 平均CPU使用率: ${metrics.averageCpuUsage.toFixed(2)}%`);
  console.log(`  - 平均内存使用率: ${metrics.averageMemoryUsage.toFixed(2)}MB`);

  // 清理
  await cluster.stop();
  console.log('🧹 集群已停止并清理');
}

/**
 * 综合集成示例
 */
async function comprehensiveIntegrationExample(): Promise<void> {
  console.log('\n🎯 综合集成示例\n');

  // 创建插件管理器
  const pluginManager = new PluginManager();
  const loggingPlugin = new LoggingPlugin();
  await pluginManager.registerPlugin(loggingPlugin);
  await pluginManager.enablePlugin('Logging');

  // 创建环境工厂
  const factory = new EnvironmentFactory();

  // 创建集群
  const cluster = new EnvironmentCluster({
    name: 'IntegratedCluster',
    maxEnvironments: 5,
    loadBalancingStrategy: 'least-connections',
    failover: { enabled: false, maxRetries: 3, retryDelay: 1000, healthCheckInterval: 5000 },
    autoScaling: { enabled: false, minEnvironments: 1, maxEnvironments: 3, scaleUpThreshold: 80, scaleDownThreshold: 20, cooldownPeriod: 30000 },
  }, factory);

  await cluster.start();

  // 添加多种类型的环境
  await cluster.addEnvironment({ name: 'Frontend', type: 'local', maxRoles: 3 });
  await cluster.addEnvironment({ name: 'Backend', type: 'cloud', maxRoles: 5 });
  await cluster.addEnvironment({ name: 'Database', type: 'container', maxRoles: 2 });

  // 创建团队角色
  const team = [
    new AdvancedRole('ProductManager', 'Product Manager', 'Define requirements'),
    new AdvancedRole('TechLead', 'Technical Lead', 'Architecture decisions'),
    new AdvancedRole('Developer1', 'Frontend Developer', 'UI/UX implementation'),
    new AdvancedRole('Developer2', 'Backend Developer', 'API development'),
    new AdvancedRole('DevOps', 'DevOps Engineer', 'Infrastructure management'),
  ];

  // 分配角色到集群
  for (const role of team) {
    await pluginManager.executeHook('beforeRoleAdd', cluster as any, role);
    const envId = await cluster.addRoleToCluster(role);
    await pluginManager.executeHook('afterRoleAdd', cluster as any, role);
    console.log(`👤 ${role.name} 分配到环境`);
  }

  // 模拟项目协作
  const projectMessages = [
    new SystemMessage('项目启动：开始新的产品开发'),
    new UserMessage('需求分析：用户需要一个现代化的Web应用'),
    new UserMessage('技术选型：使用React + Node.js + PostgreSQL'),
    new UserMessage('架构设计：微服务架构，容器化部署'),
    new UserMessage('开发计划：分为3个迭代，每个迭代2周'),
  ];

  for (const message of projectMessages) {
    await pluginManager.executeHook('beforeMessageSend', cluster as any, message);
    await cluster.broadcastMessage(message);
    await pluginManager.executeHook('afterMessageSend', cluster as any, message);
    console.log(`📨 发送消息: ${message.content.substring(0, 30)}...`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 显示最终状态
  const finalMetrics = cluster.getClusterMetrics();
  console.log('\n🎉 项目协作完成！');
  console.log(`📊 最终状态: ${finalMetrics.totalEnvironments} 个环境，${finalMetrics.totalProcessedMessages} 条消息`);

  // 显示日志摘要
  const logs = loggingPlugin.getLogs();
  console.log(`📝 系统日志: 记录了 ${logs.length} 条操作日志`);

  // 清理
  await cluster.stop();
  await pluginManager.unregisterPlugin('Logging');
  console.log('🧹 系统已清理完成');
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('🚀 MetaGPT.TS 环境系统高级功能示例');
  console.log('==========================================');

  try {
    await environmentFactoryExample();
    await environmentPluginExample();
    await environmentAdapterExample();
    await environmentClusterExample();
    await comprehensiveIntegrationExample();
    
    console.log('\n✅ 所有高级功能示例执行完成!');
    console.log('\n🎯 环境系统功能总结:');
    console.log('  ✅ 环境工厂 - 类型安全的环境创建');
    console.log('  ✅ 环境插件 - 可扩展的功能增强');
    console.log('  ✅ 环境适配器 - 统一的环境管理接口');
    console.log('  ✅ 环境集群 - 负载均衡和故障转移');
    console.log('  ✅ 系统集成 - 无缝的组件协作');
    
  } catch (error) {
    console.error('❌ 示例执行失败:', error);
    process.exit(1);
  }
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}

export {
  environmentFactoryExample,
  environmentPluginExample,
  environmentAdapterExample,
  environmentClusterExample,
  comprehensiveIntegrationExample,
  AdvancedRole,
};
