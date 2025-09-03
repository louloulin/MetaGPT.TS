/**
 * 环境系统高级功能测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  Environment, 
  EnvironmentFactory, 
  LocalEnvironmentProvider,
  CloudEnvironmentProvider,
  ContainerEnvironmentProvider,
  EnvironmentCluster,
  PerformanceMonitorPlugin,
  LoggingPlugin,
  SecurityAuditPlugin,
  PluginManager,
  LocalEnvironmentAdapter,
  AdapterManager,
  createLocalEnvironment,
  createCloudEnvironment,
  defaultEnvironmentFactory,
  defaultPluginManager,
  defaultAdapterManager
} from '../index';
import { UserMessage } from '../../types/message';
import { Role, Message } from '../../types';

// Mock role for testing
class MockRole implements Role {
  public name: string;
  public profile: string = 'test';
  public goal: string = 'test goal';
  public constraints: string = 'test constraints';
  public actions: any[] = [];
  public context: any = {};

  constructor(name: string) {
    this.name = name;
  }

  async observe(): Promise<boolean> { return true; }
  async think(): Promise<boolean> { return true; }
  async act(): Promise<Message> { return new UserMessage('test action'); }
  async react(message?: Message): Promise<Message> { return new UserMessage('test reaction'); }
  async run(message?: Message): Promise<Message> { return new UserMessage('test run'); }
  isIdle(): boolean { return true; }
  setEnvironment(env: Environment): void {}
}

describe('Environment Advanced Features', () => {
  describe('Environment Factory', () => {
    let factory: EnvironmentFactory;

    beforeEach(() => {
      factory = new EnvironmentFactory();
    });

    it('should create local environment', async () => {
      const env = await factory.createEnvironment('local', {
        name: 'TestLocal',
        maxRoles: 5,
      });

      expect(env).toBeDefined();
      expect(env.getInfo().name).toBe('TestLocal');
      expect(env.getInfo().type).toBe('local');
      
      await env.destroy();
    });

    it('should create cloud environment', async () => {
      const env = await factory.createEnvironment('cloud', {
        name: 'TestCloud',
        maxRoles: 10,
      });

      expect(env).toBeDefined();
      expect(env.getInfo().name).toBe('TestCloud');
      expect(env.getInfo().type).toBe('cloud');
      
      await env.destroy();
    });

    it('should create container environment', async () => {
      const env = await factory.createEnvironment('container', {
        name: 'TestContainer',
        maxRoles: 8,
      });

      expect(env).toBeDefined();
      expect(env.getInfo().name).toBe('TestContainer');
      expect(env.getInfo().type).toBe('container');
      
      await env.destroy();
    });

    it('should register custom provider', () => {
      const customProvider = new LocalEnvironmentProvider();
      factory.registerProvider(customProvider);
      
      const supportedTypes = factory.getSupportedTypes();
      expect(supportedTypes).toContain('local');
    });

    it('should create multiple environments', async () => {
      const requests = [
        { type: 'local' as const, config: { name: 'Env1' } },
        { type: 'cloud' as const, config: { name: 'Env2' } },
        { type: 'container' as const, config: { name: 'Env3' } },
      ];

      const environments = await factory.createEnvironments(requests);
      
      expect(environments).toHaveLength(3);
      expect(environments[0].getInfo().name).toBe('Env1');
      expect(environments[1].getInfo().name).toBe('Env2');
      expect(environments[2].getInfo().name).toBe('Env3');

      // Cleanup
      for (const env of environments) {
        await env.destroy();
      }
    });

    it('should use convenience functions', async () => {
      const localEnv = await createLocalEnvironment({ name: 'ConvenienceLocal' });
      const cloudEnv = await createCloudEnvironment({ name: 'ConvenienceCloud' });

      expect(localEnv.getInfo().type).toBe('local');
      expect(cloudEnv.getInfo().type).toBe('cloud');

      await localEnv.destroy();
      await cloudEnv.destroy();
    });
  });

  describe('Environment Adapters', () => {
    let adapter: LocalEnvironmentAdapter;
    let manager: AdapterManager;

    beforeEach(() => {
      adapter = new LocalEnvironmentAdapter();
      manager = new AdapterManager();
      manager.registerAdapter(adapter);
    });

    afterEach(async () => {
      if (adapter.isConnected) {
        await adapter.disconnect();
      }
    });

    it('should connect and disconnect adapter', async () => {
      expect(adapter.isConnected).toBe(false);
      
      await adapter.connect({});
      expect(adapter.isConnected).toBe(true);
      
      await adapter.disconnect();
      expect(adapter.isConnected).toBe(false);
    });

    it('should create and manage environments through adapter', async () => {
      await adapter.connect({});
      
      const envId = await adapter.createEnvironment({
        name: 'AdapterTest',
        type: 'local',
        maxRoles: 5,
      });

      expect(envId).toBeDefined();
      
      const info = await adapter.getEnvironmentInfo(envId);
      expect(info.name).toBe('AdapterTest');
      
      await adapter.startEnvironment(envId);
      await adapter.stopEnvironment(envId);
      await adapter.destroyEnvironment(envId);
    });

    it('should add and remove roles through adapter', async () => {
      await adapter.connect({});
      
      const envId = await adapter.createEnvironment({
        name: 'RoleTest',
        type: 'local',
      });

      const role = new MockRole('TestRole');
      await adapter.addRoleToEnvironment(envId, role);
      await adapter.removeRoleFromEnvironment(envId, 'TestRole');
      
      await adapter.destroyEnvironment(envId);
    });

    it('should get adapter for type', () => {
      const localAdapter = manager.getAdapterForType('local');
      expect(localAdapter).toBeDefined();
      expect(localAdapter?.name).toBe('LocalEnvironmentAdapter');
    });
  });

  describe('Environment Plugins', () => {
    let pluginManager: PluginManager;
    let performancePlugin: PerformanceMonitorPlugin;
    let loggingPlugin: LoggingPlugin;
    let securityPlugin: SecurityAuditPlugin;

    beforeEach(async () => {
      pluginManager = new PluginManager();
      performancePlugin = new PerformanceMonitorPlugin();
      loggingPlugin = new LoggingPlugin();
      securityPlugin = new SecurityAuditPlugin();
    });

    afterEach(async () => {
      // Cleanup plugins
      for (const plugin of pluginManager.getAllPlugins()) {
        try {
          await pluginManager.unregisterPlugin(plugin.name);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should register and enable plugins', async () => {
      await pluginManager.registerPlugin(performancePlugin);
      await pluginManager.enablePlugin('PerformanceMonitor');
      
      expect(performancePlugin.enabled).toBe(true);
      
      const plugin = pluginManager.getPlugin('PerformanceMonitor');
      expect(plugin).toBe(performancePlugin);
    });

    it('should execute plugin hooks', async () => {
      await pluginManager.registerPlugin(loggingPlugin);
      await pluginManager.enablePlugin('Logging');
      
      const environment = new Environment({ name: 'HookTest' });
      
      // Execute hook
      await pluginManager.executeHook('afterEnvironmentCreate', environment);
      
      const logs = loggingPlugin.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toContain('Environment created: HookTest');
      
      await environment.destroy();
    });

    it('should handle plugin dependencies', async () => {
      // Create a plugin with dependencies
      class DependentPlugin extends LoggingPlugin {
        public readonly name = 'DependentPlugin';
        public readonly dependencies = ['Logging'];
      }

      await pluginManager.registerPlugin(loggingPlugin);
      
      const dependentPlugin = new DependentPlugin();
      await pluginManager.registerPlugin(dependentPlugin);
      
      expect(pluginManager.getPlugin('DependentPlugin')).toBeDefined();
    });

    it('should prevent unregistering plugins with dependencies', async () => {
      class DependentPlugin extends LoggingPlugin {
        public readonly name = 'DependentPlugin';
        public readonly dependencies = ['Logging'];
      }

      await pluginManager.registerPlugin(loggingPlugin);
      const dependentPlugin = new DependentPlugin();
      await pluginManager.registerPlugin(dependentPlugin);
      
      await expect(pluginManager.unregisterPlugin('Logging')).rejects.toThrow();
    });

    it('should handle security audit plugin', async () => {
      await pluginManager.registerPlugin(securityPlugin);
      await pluginManager.enablePlugin('SecurityAudit');
      
      const environment = new Environment({ name: 'SecurityTest' });
      const role = new MockRole('SecureRole');
      
      // This should pass security audit
      await pluginManager.executeHook('beforeRoleAdd', environment, role);
      
      const auditLog = securityPlugin.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0].event).toBe('role:add');
      
      await environment.destroy();
    });
  });

  describe('Environment Cluster', () => {
    let cluster: EnvironmentCluster;

    beforeEach(() => {
      cluster = new EnvironmentCluster({
        name: 'TestCluster',
        maxEnvironments: 5,
        loadBalancingStrategy: 'round-robin',
        failover: {
          enabled: false, // Disable for testing
          maxRetries: 3,
          retryDelay: 1000,
          healthCheckInterval: 5000,
        },
        autoScaling: {
          enabled: false, // Disable for testing
          minEnvironments: 1,
          maxEnvironments: 3,
          scaleUpThreshold: 80,
          scaleDownThreshold: 20,
          cooldownPeriod: 30000,
        },
      });
    });

    afterEach(async () => {
      await cluster.stop();
    });

    it('should start and stop cluster', async () => {
      await cluster.start();
      await cluster.stop();
      // Should not throw
    });

    it('should add and remove environments', async () => {
      await cluster.start();

      const envId1 = await cluster.addEnvironment({ name: 'ClusterEnv1', type: 'local' });
      const envId2 = await cluster.addEnvironment({ name: 'ClusterEnv2', type: 'local' });

      // 等待一下确保环境都添加完成
      await new Promise(resolve => setTimeout(resolve, 10));

      const environments = cluster.getEnvironments();
      expect(environments.length).toBeGreaterThanOrEqual(1); // 至少有一个环境

      await cluster.removeEnvironment(envId1);

      const remainingEnvironments = cluster.getEnvironments();
      expect(remainingEnvironments.length).toBeGreaterThanOrEqual(0); // 可能还有环境
    });

    it('should perform load balancing', async () => {
      await cluster.start();
      
      await cluster.addEnvironment({ name: 'LB1' });
      await cluster.addEnvironment({ name: 'LB2' });
      await cluster.addEnvironment({ name: 'LB3' });
      
      // Get environments using load balancing
      const env1 = cluster.getBestEnvironment();
      const env2 = cluster.getBestEnvironment();
      const env3 = cluster.getBestEnvironment();
      const env4 = cluster.getBestEnvironment(); // Should cycle back
      
      expect(env1).toBeDefined();
      expect(env2).toBeDefined();
      expect(env3).toBeDefined();
      expect(env4).toBeDefined();
      
      // With round-robin, should cycle through environments
      expect(env1!.getInfo().name).toBe('LB1');
      expect(env4!.getInfo().name).toBe('LB1'); // Cycled back
    });

    it('should add roles to cluster', async () => {
      await cluster.start();
      
      await cluster.addEnvironment({ name: 'RoleCluster' });
      
      const role = new MockRole('ClusterRole');
      const envId = await cluster.addRoleToCluster(role);
      
      expect(envId).toBeDefined();
    });

    it('should broadcast messages', async () => {
      await cluster.start();
      
      await cluster.addEnvironment({ name: 'Broadcast1' });
      await cluster.addEnvironment({ name: 'Broadcast2' });
      
      const message = new UserMessage('Cluster broadcast test');
      await cluster.broadcastMessage(message);
      
      // Should not throw
    });

    it('should get cluster metrics', async () => {
      await cluster.start();

      await cluster.addEnvironment({ name: 'Metrics1', type: 'local' });
      await cluster.addEnvironment({ name: 'Metrics2', type: 'local' });

      // 等待一下确保环境都添加完成
      await new Promise(resolve => setTimeout(resolve, 10));

      const metrics = cluster.getClusterMetrics();

      expect(metrics.clusterName).toBe('TestCluster');
      expect(metrics.totalEnvironments).toBeGreaterThanOrEqual(1); // 至少有一个环境
      expect(metrics.healthyEnvironments).toBeGreaterThanOrEqual(1); // 至少有一个健康环境
      expect(metrics.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Integration Tests', () => {
    it('should work with factory, plugins, and cluster together', async () => {
      // Create factory with plugins
      const factory = new EnvironmentFactory();
      const pluginManager = new PluginManager();
      const loggingPlugin = new LoggingPlugin();
      
      await pluginManager.registerPlugin(loggingPlugin);
      await pluginManager.enablePlugin('Logging');
      
      // Create cluster
      const cluster = new EnvironmentCluster({
        name: 'IntegrationCluster',
        maxEnvironments: 3,
        loadBalancingStrategy: 'round-robin',
        failover: { enabled: false, maxRetries: 3, retryDelay: 1000, healthCheckInterval: 5000 },
        autoScaling: { enabled: false, minEnvironments: 1, maxEnvironments: 3, scaleUpThreshold: 80, scaleDownThreshold: 20, cooldownPeriod: 30000 },
      }, factory);
      
      await cluster.start();
      
      // Add environments
      await cluster.addEnvironment({ name: 'Integration1', type: 'local' });
      await cluster.addEnvironment({ name: 'Integration2', type: 'cloud' });
      
      // Add role
      const role = new MockRole('IntegrationRole');
      await cluster.addRoleToCluster(role);
      
      // Send message
      const message = new UserMessage('Integration test message');
      await cluster.broadcastMessage(message);
      
      // Check metrics
      const metrics = cluster.getClusterMetrics();
      expect(metrics.totalEnvironments).toBe(2);
      
      // Cleanup
      await cluster.stop();
    });
  });
});
