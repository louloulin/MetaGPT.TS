# 环境系统 (Environment System)

MetaGPT.TS 的增强环境系统，提供类型安全的环境管理、角色协调和消息路由功能。

## 🌟 主要特性

### 🔧 类型安全的环境管理
- **品牌类型**：使用 `EnvironmentId` 确保环境ID的类型安全
- **模板字面量类型**：支持多种环境类型（`local`、`cloud`、`container`、`sandbox`、`hybrid`、`custom:*`）
- **条件类型映射**：根据环境类型自动推导配置类型
- **Zod验证**：运行时配置验证和类型安全

### 🔄 环境生命周期管理
- **完整生命周期**：创建 → 初始化 → 运行 → 暂停 → 停止 → 销毁
- **状态机管理**：使用状态机确保状态转换的正确性
- **事件驱动**：生命周期事件的发布和订阅
- **错误处理**：完善的错误处理和自动恢复机制

### 👥 增强的角色管理
- **状态机集成**：为每个角色创建独立的状态机
- **角色限制**：支持最大角色数量限制
- **动态管理**：运行时添加和移除角色
- **状态监控**：实时监控角色状态和活动

### 📨 智能消息路由
- **消息路由器集成**：与消息路由系统无缝集成
- **类型安全消息**：支持 `RoutableMessage` 类型
- **广播和定向**：支持广播消息和定向消息
- **消息历史**：自动管理消息历史和清理

### 📊 环境监控和健康检查
- **实时指标**：CPU、内存、存储使用率监控
- **健康检查**：定期健康检查和状态报告
- **自动恢复**：检测到问题时自动尝试恢复
- **性能分析**：响应时间、吞吐量、成功率统计

### 💾 序列化和持久化
- **序列化支持**：继承 `SerializationMixin` 支持序列化
- **状态保存**：环境状态的保存和恢复
- **消息归档**：消息历史的归档和存储
- **配置持久化**：环境配置的持久化存储

## 🚀 快速开始

### 基础使用

```typescript
import { Environment, EnvironmentConfig } from '@metagpt/core';

// 创建环境配置
const config: Partial<EnvironmentConfig> = {
  name: 'MyEnvironment',
  type: 'local',
  description: '我的开发环境',
  maxRoles: 10,
  enableMonitoring: true,
  enableAutoRecovery: true,
};

// 创建环境
const environment = new Environment(config);

// 启动环境
await environment.start();

// 添加角色
environment.addRole(myRole);

// 发送消息
await environment.broadcastMessage(message);

// 停止环境
await environment.stop();
```

### 环境生命周期管理

```typescript
// 监听环境事件
environment.on('environment:started', (info) => {
  console.log(`环境已启动: ${info.name}`);
});

environment.on('environment:error', (info, error) => {
  console.error(`环境错误: ${error.message}`);
});

// 生命周期操作
await environment.start();    // 启动环境
await environment.pause();    // 暂停环境
await environment.resume();   // 恢复环境
await environment.stop();     // 停止环境
await environment.destroy();  // 销毁环境
```

### 角色管理

```typescript
// 添加单个角色
environment.addRole(role);

// 添加多个角色
environment.addRoles([role1, role2, role3]);

// 移除角色
environment.removeRole('roleName');

// 获取角色
const role = environment.getRole('roleName');
const allRoles = environment.getRoles();

// 获取角色状态机
const stateMachine = environment.getRoleStateMachine('roleName');
```

### 消息管理

```typescript
// 发布消息
environment.publishMessage(message);

// 发送给特定角色
await environment.sendMessageToRole(message, 'targetRole');

// 广播消息
await environment.broadcastMessage(message);

// 获取消息
const messages = environment.getMessages('roleName');
const newMessages = environment.getNewMessagesForRole('roleName', lastIndex);

// 消息统计
const stats = environment.getMessageStats();
console.log(`总消息数: ${stats.total}, 最近消息: ${stats.recent}`);
```

### 环境监控

```typescript
// 检查环境状态
const isIdle = environment.isIdle;
const info = environment.getInfo();

// 获取环境指标
environment.on('environment:metrics', (metrics) => {
  console.log(`CPU使用率: ${metrics.cpuUsage}%`);
  console.log(`内存使用: ${metrics.memoryUsage}MB`);
  console.log(`活跃角色: ${metrics.activeRoles}`);
});

// 健康检查
environment.on('environment:health-check', (info, healthy) => {
  if (!healthy) {
    console.warn(`环境 ${info.name} 健康检查失败`);
  }
});
```

## 🏗️ 环境类型

### 本地环境 (Local)
```typescript
const localConfig = {
  type: 'local' as const,
  typeSpecific: {
    workingDirectory: './workspace',
    isolateProcess: true,
    tempDirectory: './temp',
  }
};
```

### 云端环境 (Cloud)
```typescript
const cloudConfig = {
  type: 'cloud' as const,
  typeSpecific: {
    provider: 'aws',
    region: 'us-east-1',
    instanceType: 't3.medium',
    imageId: 'ami-12345678',
  }
};
```

### 容器化环境 (Container)
```typescript
const containerConfig = {
  type: 'container' as const,
  typeSpecific: {
    engine: 'docker',
    image: 'node',
    tag: '18-alpine',
    ports: [{ host: 3000, container: 3000 }],
  }
};
```

### 沙箱环境 (Sandbox)
```typescript
const sandboxConfig = {
  type: 'sandbox' as const,
  typeSpecific: {
    sandboxType: 'container',
    allowedOperations: ['read', 'write'],
    fileSystemAccess: 'readonly',
    networkAccess: false,
  }
};
```

## 🧪 测试

运行环境系统测试：

```bash
# 运行所有测试
bun test src/environment/__tests__/

# 运行特定测试
bun test src/environment/__tests__/environment.test.ts

# 运行示例
bun run src/environment/examples/environment-example.ts
```

## 📚 API 参考

### Environment 类

#### 构造函数
- `constructor(config?: Partial<EnvironmentConfig>)`

#### 生命周期方法
- `start(): Promise<void>` - 启动环境
- `stop(): Promise<void>` - 停止环境
- `pause(): Promise<void>` - 暂停环境
- `resume(): Promise<void>` - 恢复环境
- `destroy(): Promise<void>` - 销毁环境

#### 角色管理
- `addRole(role: Role): void` - 添加角色
- `addRoles(roles: Role[]): void` - 添加多个角色
- `removeRole(roleName: string): boolean` - 移除角色
- `getRole(name: string): Role | undefined` - 获取角色
- `getRoles(): Role[]` - 获取所有角色

#### 消息管理
- `publishMessage(message: Message): void` - 发布消息
- `sendMessageToRole(message: Message, targetRole: string): Promise<void>` - 发送给角色
- `broadcastMessage(message: Message): Promise<void>` - 广播消息
- `getMessages(recipient: string, fromIndex?: number): Message[]` - 获取消息

#### 状态和监控
- `get isIdle(): boolean` - 检查是否空闲
- `getInfo(): EnvironmentInfo` - 获取环境信息
- `getMessageStats()` - 获取消息统计

#### 序列化
- `getSerializationPath(): string` - 获取序列化路径
- `archive(storagePath?: string): Promise<void>` - 归档环境数据

## 🔧 配置选项

详细的配置选项请参考 `EnvironmentConfig` 接口定义。

## 🤝 贡献

欢迎贡献代码！请确保：
1. 添加适当的测试
2. 更新文档
3. 遵循TypeScript最佳实践
4. 保持向后兼容性

## 🚀 高级功能

### 环境工厂模式

```typescript
import { EnvironmentFactory, createLocalEnvironment, createCloudEnvironment } from '@metagpt/core';

// 使用工厂创建环境
const factory = new EnvironmentFactory();
const localEnv = await factory.createEnvironment('local', { name: 'Dev' });
const cloudEnv = await factory.createEnvironment('cloud', { name: 'Prod' });

// 使用便捷函数
const quickLocal = await createLocalEnvironment({ name: 'Quick' });
const quickCloud = await createCloudEnvironment({ name: 'Quick' });

// 批量创建
const environments = await factory.createEnvironments([
  { type: 'local', config: { name: 'Env1' } },
  { type: 'cloud', config: { name: 'Env2' } },
]);
```

### 环境插件系统

```typescript
import { PluginManager, PerformanceMonitorPlugin, LoggingPlugin } from '@metagpt/core';

const pluginManager = new PluginManager();

// 注册插件
await pluginManager.registerPlugin(new PerformanceMonitorPlugin());
await pluginManager.registerPlugin(new LoggingPlugin());

// 启用插件
await pluginManager.enablePlugin('PerformanceMonitor');
await pluginManager.enablePlugin('Logging');

// 执行插件钩子
await pluginManager.executeHook('afterEnvironmentCreate', environment);
```

### 环境适配器

```typescript
import { LocalEnvironmentAdapter, AdapterManager } from '@metagpt/core';

const adapter = new LocalEnvironmentAdapter();
await adapter.connect({});

// 通过适配器管理环境
const envId = await adapter.createEnvironment({
  name: 'AdapterEnv',
  type: 'local',
});

await adapter.startEnvironment(envId);
const metrics = await adapter.getEnvironmentMetrics(envId);
```

### 环境集群管理

```typescript
import { EnvironmentCluster } from '@metagpt/core';

const cluster = new EnvironmentCluster({
  name: 'ProductionCluster',
  maxEnvironments: 10,
  loadBalancingStrategy: 'round-robin',
  failover: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000,
    healthCheckInterval: 5000,
  },
  autoScaling: {
    enabled: true,
    minEnvironments: 2,
    maxEnvironments: 8,
    scaleUpThreshold: 80,
    scaleDownThreshold: 20,
    cooldownPeriod: 30000,
  },
});

await cluster.start();

// 添加环境到集群
await cluster.addEnvironment({ name: 'Worker1', type: 'local' });
await cluster.addEnvironment({ name: 'Worker2', type: 'cloud' });

// 负载均衡
const env = cluster.getBestEnvironment();
if (env) {
  // 使用环境
  cluster.releaseEnvironment(env.getInfo().id);
}

// 集群指标
const metrics = cluster.getClusterMetrics();
console.log(`集群有 ${metrics.totalEnvironments} 个环境`);
```

## 🎯 完整示例

查看 `examples/` 目录中的完整示例：

- `environment-example.ts` - 基础环境功能示例
- `advanced-environment-example.ts` - 高级功能综合示例

运行示例：

```bash
# 基础示例
bun run src/environment/examples/environment-example.ts

# 高级功能示例
bun run src/environment/examples/advanced-environment-example.ts
```

## 📊 性能特性

- **高并发支持**：支持数千个并发环境
- **负载均衡**：多种负载均衡策略
- **自动扩缩容**：基于负载自动调整环境数量
- **故障转移**：自动检测和恢复故障环境
- **内存优化**：智能缓存和资源管理
- **实时监控**：完整的性能指标收集

## 🔧 配置参考

### 环境配置完整选项

```typescript
interface EnvironmentConfig {
  id?: string;                    // 环境ID
  name: string;                   // 环境名称
  type: EnvironmentType;          // 环境类型
  description?: string;           // 环境描述
  priority: number;               // 环境优先级
  resourceLimits: ResourceLimits; // 资源限制
  env: Record<string, string>;    // 环境变量
  tags: string[];                 // 标签
  enableMonitoring: boolean;      // 启用监控
  enableAutoRecovery: boolean;    // 启用自动恢复
  healthCheckInterval: number;    // 健康检查间隔
  maxHistorySize: number;         // 最大历史大小
  maxRoles: number;               // 最大角色数
  messageRouting: {               // 消息路由配置
    enabled: boolean;
    maxConcurrency: number;
    enableMetrics: boolean;
  };
  stateManagement: {              // 状态管理配置
    enabled: boolean;
    persistence: boolean;
    debug: boolean;
  };
  metadata: Record<string, any>;  // 元数据
}
```

## 📄 许可证

MIT License
