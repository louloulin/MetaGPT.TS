/**
 * @module Environment
 * @category Core
 * @description 增强的环境系统模块，支持现代化的TypeScript特性
 *
 * 主要特性：
 * - 类型安全的环境管理和配置
 * - 环境生命周期管理（创建、启动、停止、销毁）
 * - 角色管理和状态机集成
 * - 消息路由和通信协调
 * - 环境监控和健康检查
 * - 序列化和持久化支持
 * - 多种环境类型支持（本地、云端、容器化等）
 * - 环境工厂模式和提供者系统
 * - 环境适配器和插件系统
 * - 环境集群管理和负载均衡
 * - 自动扩缩容和故障转移
 */

// 核心环境系统
export * from './environment';

// 环境工厂和提供者
export * from './environment-factory';

// 环境适配器系统
export * from './environment-adapter';

// 环境插件系统
export * from './environment-plugin';

// 环境集群管理
export * from './environment-cluster';

// 传统模块（向后兼容）
export * from './sandbox';
export * from './code-execution';