/**
 * 环境系统使用示例
 * 
 * 展示如何使用增强的环境系统进行角色管理、消息路由和状态监控
 */

import { Environment, EnvironmentConfig, EnvironmentState, createEnvironmentId } from '../environment';
import { UserMessage, SystemMessage } from '../../types/message';
import { Role, Message } from '../../types';
import { logger } from '../../utils/logger';

// 示例角色实现
class ExampleRole implements Role {
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
    await this.delay(100); // Simulate thinking time
    return true;
  }

  async act(): Promise<Message> {
    console.log(`⚡ ${this.name} is acting...`);
    this.messageCount++;
    
    const message = new UserMessage(
      `Action result from ${this.name} (message #${this.messageCount})`
    );
    message.role = this.name;
    
    await this.delay(200); // Simulate action time
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
    
    this._isIdle = Math.random() > 0.3; // Randomly become idle
    
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
 * 基础环境示例
 */
async function basicEnvironmentExample(): Promise<void> {
  console.log('\n🚀 基础环境系统示例\n');

  // 创建环境配置
  const config: Partial<EnvironmentConfig> = {
    name: 'DevelopmentTeam',
    type: 'local',
    description: '软件开发团队环境',
    maxRoles: 5,
    maxHistorySize: 50,
    enableMonitoring: true,
    enableAutoRecovery: true,
    healthCheckInterval: 5000,
    messageRouting: {
      enabled: false, // 简化示例
      maxConcurrency: 3,
      enableMetrics: true,
    },
    stateManagement: {
      enabled: false, // 简化示例
      persistence: false,
      debug: true,
    },
    tags: ['development', 'team', 'local'],
    metadata: {
      project: 'MetaGPT.TS',
      version: '2.0.0',
    },
  };

  // 创建环境
  const environment = new Environment(config);
  console.log(`✅ 环境已创建: ${environment.getInfo().name} (${environment.getInfo().id})`);

  // 创建角色
  const productManager = new ExampleRole(
    'ProductManager',
    'Product Manager',
    'Define product requirements and roadmap'
  );

  const architect = new ExampleRole(
    'Architect',
    'Software Architect',
    'Design system architecture and technical solutions'
  );

  const developer = new ExampleRole(
    'Developer',
    'Software Developer',
    'Implement features and fix bugs'
  );

  // 添加角色到环境
  console.log('\n📝 添加角色到环境:');
  environment.addRoles([productManager, architect, developer]);

  // 启动环境
  console.log('\n🎬 启动环境...');
  await environment.start();
  console.log(`✅ 环境状态: ${environment.getInfo().state}`);

  // 发送初始消息
  console.log('\n📨 发送初始消息:');
  const initialMessage = new SystemMessage('开始新的项目开发周期');
  await environment.broadcastMessage(initialMessage);

  // 模拟角色交互
  console.log('\n🔄 模拟角色交互:');
  for (let round = 1; round <= 3; round++) {
    console.log(`\n--- 第 ${round} 轮交互 ---`);
    
    // 运行环境一步
    await environment.run();
    
    // 显示环境状态
    console.log(`环境空闲状态: ${environment.isIdle}`);
    console.log(`活跃角色数: ${environment.getRoles().length}`);
    
    // 显示消息统计
    const stats = environment.getMessageStats();
    console.log(`消息统计: 总计 ${stats.total}, 最近 ${stats.recent}`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 角色间通信示例
  console.log('\n💬 角色间通信示例:');
  const pmMessage = new UserMessage('需要设计用户认证系统');
  pmMessage.role = 'ProductManager';
  await environment.sendMessageToRole(pmMessage, 'Architect');

  const archResponse = new UserMessage('我将设计OAuth 2.0认证架构');
  archResponse.role = 'Architect';
  await environment.sendMessageToRole(archResponse, 'Developer');

  // 显示消息历史
  console.log('\n📚 消息历史:');
  const history = environment.history;
  history.slice(-5).forEach((msg, index) => {
    console.log(`${index + 1}. [${msg.role}]: ${msg.content}`);
  });

  // 环境指标
  console.log('\n📊 环境指标:');
  const info = environment.getInfo();
  console.log(`- 环境ID: ${info.id}`);
  console.log(`- 环境名称: ${info.name}`);
  console.log(`- 环境类型: ${info.type}`);
  console.log(`- 当前状态: ${info.state}`);
  console.log(`- 创建时间: ${info.createdAt.toISOString()}`);
  console.log(`- 启动时间: ${info.startedAt?.toISOString()}`);
  console.log(`- 标签: ${Array.from(info.tags).join(', ')}`);

  // 停止环境
  console.log('\n🛑 停止环境...');
  await environment.stop();
  console.log(`✅ 环境状态: ${environment.getInfo().state}`);

  // 清理资源
  await environment.destroy();
  console.log('🧹 环境已销毁');
}

/**
 * 环境生命周期示例
 */
async function lifecycleExample(): Promise<void> {
  console.log('\n🔄 环境生命周期示例\n');

  const environment = new Environment({
    name: 'LifecycleDemo',
    type: 'local',
    enableMonitoring: true,
  });

  // 监听环境事件
  const eventEmitter = (environment as any).eventEmitter;
  
  eventEmitter.on('environment:created', (info: any) => {
    console.log(`🎉 环境已创建: ${info.name}`);
  });

  eventEmitter.on('environment:started', (info: any) => {
    console.log(`▶️ 环境已启动: ${info.name}`);
  });

  eventEmitter.on('environment:paused', (info: any) => {
    console.log(`⏸️ 环境已暂停: ${info.name}`);
  });

  eventEmitter.on('environment:stopped', (info: any) => {
    console.log(`⏹️ 环境已停止: ${info.name}`);
  });

  eventEmitter.on('environment:destroyed', (info: any) => {
    console.log(`💥 环境已销毁: ${info.name}`);
  });

  // 演示生命周期
  console.log('1. 启动环境...');
  await environment.start();

  console.log('2. 暂停环境...');
  await environment.pause();

  console.log('3. 恢复环境...');
  await environment.resume();

  console.log('4. 停止环境...');
  await environment.stop();

  console.log('5. 销毁环境...');
  await environment.destroy();
}

/**
 * 错误处理示例
 */
async function errorHandlingExample(): Promise<void> {
  console.log('\n⚠️ 错误处理示例\n');

  const environment = new Environment({
    name: 'ErrorDemo',
    maxRoles: 1, // 限制角色数量
  });

  try {
    // 尝试添加超过限制的角色
    const role1 = new ExampleRole('Role1', 'Test', 'Test');
    const role2 = new ExampleRole('Role2', 'Test', 'Test');
    
    environment.addRole(role1);
    console.log('✅ 成功添加第一个角色');
    
    environment.addRole(role2); // 这应该抛出错误
    
  } catch (error) {
    console.log(`❌ 捕获到预期错误: ${(error as Error).message}`);
  }

  try {
    // 尝试在错误状态下启动
    await environment.start();
    await environment.start(); // 重复启动应该失败
    
  } catch (error) {
    console.log(`❌ 捕获到生命周期错误: ${(error as Error).message}`);
  }

  await environment.destroy();
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('🌟 MetaGPT.TS 环境系统示例');
  console.log('=====================================');

  try {
    await basicEnvironmentExample();
    await lifecycleExample();
    await errorHandlingExample();
    
    console.log('\n✅ 所有示例执行完成!');
    
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
  basicEnvironmentExample,
  lifecycleExample,
  errorHandlingExample,
  ExampleRole,
};
