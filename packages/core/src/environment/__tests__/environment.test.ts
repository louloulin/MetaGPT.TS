/**
 * 环境系统测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Environment, EnvironmentConfig, EnvironmentState, createEnvironmentId } from '../environment';
import { Message, UserMessage } from '../../types/message';
import { Role } from '../../types/role';

// Mock role for testing
class MockRole implements Role {
  public name: string;
  public profile: string = 'test';
  public goal: string = 'test goal';
  public constraints: string = 'test constraints';
  public actions: any[] = [];
  public context: any = {};

  private _isIdle: boolean = true;

  constructor(name: string) {
    this.name = name;
  }

  async observe(): Promise<boolean> {
    return true;
  }

  async think(): Promise<boolean> {
    return true;
  }

  async act(): Promise<Message> {
    return new UserMessage('test action result');
  }

  async react(message?: Message): Promise<Message> {
    return new UserMessage('test reaction');
  }

  async run(message?: Message): Promise<Message> {
    return new UserMessage('test run result');
  }

  isIdle(): boolean {
    return this._isIdle;
  }

  setIdle(idle: boolean): void {
    this._isIdle = idle;
  }

  setEnvironment(env: Environment): void {
    // Mock implementation
  }
}

describe('Environment', () => {
  let environment: Environment;
  let config: Partial<EnvironmentConfig>;

  beforeEach(() => {
    config = {
      name: 'TestEnvironment',
      type: 'local',
      description: 'Test environment for unit tests',
      maxRoles: 10,
      maxHistorySize: 100,
      enableMonitoring: true,
      enableAutoRecovery: false,
      messageRouting: {
        enabled: false, // Disable for simpler testing
        maxConcurrency: 5,
        enableMetrics: true,
      },
      stateManagement: {
        enabled: false, // Disable for simpler testing
        persistence: false,
        debug: false,
      },
    };

    environment = new Environment(config);
  });

  afterEach(async () => {
    if (environment) {
      await environment.destroy();
    }
  });

  describe('Environment Creation', () => {
    it('should create environment with default config', () => {
      const env = new Environment();
      expect(env).toBeDefined();
      expect(env.getInfo().name).toBe('DefaultEnvironment');
      expect(env.getInfo().type).toBe('local');
    });

    it('should create environment with custom config', () => {
      const info = environment.getInfo();
      expect(info.name).toBe('TestEnvironment');
      expect(info.type).toBe('local');
      expect(info.state).toBe(EnvironmentState.CREATED);
    });

    it('should generate unique environment ID', () => {
      const env1 = new Environment({ name: 'Env1' });
      const env2 = new Environment({ name: 'Env2' });
      
      expect(env1.getInfo().id).not.toBe(env2.getInfo().id);
    });
  });

  describe('Environment Lifecycle', () => {
    it('should start environment successfully', async () => {
      await environment.start();
      expect(environment.getInfo().state).toBe(EnvironmentState.RUNNING);
      expect(environment.getInfo().startedAt).toBeDefined();
    });

    it('should stop environment successfully', async () => {
      await environment.start();
      await environment.stop();
      expect(environment.getInfo().state).toBe(EnvironmentState.STOPPED);
      expect(environment.getInfo().stoppedAt).toBeDefined();
    });

    it('should pause and resume environment', async () => {
      await environment.start();
      await environment.pause();
      expect(environment.getInfo().state).toBe(EnvironmentState.PAUSED);

      await environment.resume();
      expect(environment.getInfo().state).toBe(EnvironmentState.RUNNING);
    });

    it('should destroy environment', async () => {
      await environment.start();
      await environment.destroy();
      expect(environment.getInfo().state).toBe(EnvironmentState.DESTROYED);
    });

    it('should handle lifecycle errors', async () => {
      await environment.start();
      
      // Try to start again - should throw error
      await expect(environment.start()).rejects.toThrow();
    });
  });

  describe('Role Management', () => {
    let role1: MockRole;
    let role2: MockRole;

    beforeEach(() => {
      role1 = new MockRole('TestRole1');
      role2 = new MockRole('TestRole2');
    });

    it('should add single role', () => {
      environment.addRole(role1);
      expect(environment.getRoles()).toHaveLength(1);
      expect(environment.getRole('TestRole1')).toBe(role1);
    });

    it('should add multiple roles', () => {
      environment.addRoles([role1, role2]);
      expect(environment.getRoles()).toHaveLength(2);
      expect(environment.getRole('TestRole1')).toBe(role1);
      expect(environment.getRole('TestRole2')).toBe(role2);
    });

    it('should remove role', () => {
      environment.addRole(role1);
      expect(environment.removeRole('TestRole1')).toBe(true);
      expect(environment.getRoles()).toHaveLength(0);
      expect(environment.getRole('TestRole1')).toBeUndefined();
    });

    it('should handle duplicate role names', () => {
      environment.addRole(role1);
      
      // Adding same role again should warn but not add
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      environment.addRole(role1);
      expect(environment.getRoles()).toHaveLength(1);
      consoleSpy.mockRestore();
    });

    it('should enforce role limit', () => {
      const smallConfig = { ...config, maxRoles: 1 };
      const smallEnv = new Environment(smallConfig);
      
      smallEnv.addRole(role1);
      expect(() => smallEnv.addRole(role2)).toThrow();
    });
  });

  describe('Message Management', () => {
    let message: Message;

    beforeEach(() => {
      message = new UserMessage('Test message content');
    });

    it('should publish message', () => {
      environment.publishMessage(message);
      expect(environment.history).toHaveLength(1);
      expect(environment.history[0]).toBe(message);
    });

    it('should get messages for recipient', () => {
      const targetedMessage = new UserMessage('Targeted message');
      targetedMessage.sendTo = new Set(['TestRole1']);
      
      const broadcastMessage = new UserMessage('Broadcast message');
      broadcastMessage.sendTo = new Set(['ALL']);

      environment.publishMessage(targetedMessage);
      environment.publishMessage(broadcastMessage);

      const messagesForRole1 = environment.getMessages('TestRole1');
      expect(messagesForRole1).toHaveLength(2); // Both targeted and broadcast

      const messagesForRole2 = environment.getMessages('TestRole2');
      expect(messagesForRole2).toHaveLength(1); // Only broadcast
    });

    it('should trim message history when limit exceeded', () => {
      const smallConfig = { ...config, maxHistorySize: 2 };
      const smallEnv = new Environment(smallConfig);

      smallEnv.publishMessage(new UserMessage('Message 1'));
      smallEnv.publishMessage(new UserMessage('Message 2'));
      smallEnv.publishMessage(new UserMessage('Message 3'));

      expect(smallEnv.history).toHaveLength(2);
      expect(smallEnv.history[0].content).toBe('Message 2');
      expect(smallEnv.history[1].content).toBe('Message 3');
    });

    it('should send message to specific role', async () => {
      const role = new MockRole('TestRole');
      environment.addRole(role);

      await environment.sendMessageToRole(message, 'TestRole');
      
      const messages = environment.getMessages('TestRole');
      expect(messages).toHaveLength(1);
      expect(messages[0].sendTo.has('TestRole')).toBe(true);
    });

    it('should broadcast message to all roles', async () => {
      const role1 = new MockRole('Role1');
      const role2 = new MockRole('Role2');
      environment.addRoles([role1, role2]);

      await environment.broadcastMessage(message);
      
      const messagesForRole1 = environment.getMessages('Role1');
      const messagesForRole2 = environment.getMessages('Role2');
      
      expect(messagesForRole1).toHaveLength(1);
      expect(messagesForRole2).toHaveLength(1);
      expect(messagesForRole1[0].sendTo.has('ALL')).toBe(true);
    });

    it('should get message statistics', () => {
      const message1 = new UserMessage('Message from user');
      message1.role = 'user';
      
      const message2 = new UserMessage('Message from assistant');
      message2.role = 'assistant';
      
      environment.publishMessage(message1);
      environment.publishMessage(message2);
      environment.publishMessage(message1); // Another user message

      const stats = environment.getMessageStats();
      expect(stats.total).toBe(3);
      expect(stats.byRole.user).toBe(2);
      expect(stats.byRole.assistant).toBe(1);
      expect(stats.recent).toBe(3); // All messages are recent
    });
  });

  describe('Environment State', () => {
    it('should check if environment is idle with no roles', () => {
      expect(environment.isIdle).toBe(true);
    });

    it('should check if environment is idle with idle roles', () => {
      const role = new MockRole('TestRole');
      role.setIdle(true);
      environment.addRole(role);
      
      expect(environment.isIdle).toBe(true);
    });

    it('should check if environment is not idle with active roles', () => {
      const role = new MockRole('TestRole');
      role.setIdle(false);
      environment.addRole(role);
      
      expect(environment.isIdle).toBe(false);
    });
  });

  describe('Environment Serialization', () => {
    it('should provide serialization path', () => {
      const path = environment.getSerializationPath();
      expect(path).toContain('.json');
      expect(path).toContain('environments');
    });

    it('should archive environment data', async () => {
      const role = new MockRole('TestRole');
      environment.addRole(role);
      environment.publishMessage(new UserMessage('Test message'));

      // Test that archive method can be called without errors
      await expect(async () => {
        await environment.archive('./test-storage');
      }).not.toThrow();
    });
  });
});
