import { describe, expect, test, mock } from 'bun:test';
import { BaseRole } from '../../src/roles/base-role';
import type { Message } from '../../src/types/message';
import type { Action, ActionOutput } from '../../src/types/action';
import { MemoryManagerImpl } from '../../src/memory/manager';

// Create a concrete implementation of BaseRole for testing
class TestRole extends BaseRole {
  constructor(
    name: string = 'test_role',
    profile: string = 'Test Profile',
    goal: string = 'Test Goal',
    constraints: string = 'Test Constraints'
  ) {
    super(name, profile, goal, constraints);
  }

  // Override abstract methods for testing
  protected async decideNextAction(): Promise<Action | null> {
    return null;
  }

  // Expose protected methods for testing
  public async testAddToMemory(message: Message): Promise<void> {
    return this.addToMemory(message);
  }

  public async testAddToWorkingMemory(message: Message): Promise<void> {
    return this.addToWorkingMemory(message);
  }

  public testCreateMessage(content: string): Message {
    return this.createMessage(content);
  }

  public testSendMessage(message: Message): void {
    return this.sendMessage(message);
  }
}

describe('BaseRole', () => {
  describe('Initialization', () => {
    test('should initialize with correct properties', () => {
      const role = new TestRole();
      
      expect(role.name).toBe('test_role');
      expect(role.profile).toBe('Test Profile');
      expect(role.goal).toBe('Test Goal');
      expect(role.constraints).toBe('Test Constraints');
      expect(role.context.memory).toBeInstanceOf(MemoryManagerImpl);
    });

    test('should initialize memory system', async () => {
      const role = new TestRole();
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for async init
      expect(role.context.memory).toBeDefined();
      expect(role.context.workingMemory).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    test('should add message to memory', async () => {
      // ARRANGE
      const role = new TestRole();
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for async init
      
      const message: Message = {
        id: 'test_message',
        content: 'Test content',
        role: 'user',
        causedBy: 'test',
        sentFrom: 'user',
        sendTo: new Set(['test_role']),
        timestamp: new Date().toISOString(),
        instructContent: null
      };

      // ACT
      await role.testAddToMemory(message);
      
      // ASSERT
      const memories = await role.context.memory.working.search({});
      expect(memories.length).toBe(1);
      expect(memories[0].content).toBe('Test content');
    });

    test('should add message to working memory', async () => {
      // ARRANGE
      const role = new TestRole();
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for async init
      
      const message: Message = {
        id: 'test_message',
        content: 'Test content',
        role: 'user',
        causedBy: 'test',
        sentFrom: 'user',
        sendTo: new Set(['test_role']),
        timestamp: new Date().toISOString(),
        instructContent: null
      };

      // ACT
      await role.testAddToWorkingMemory(message);
      
      // ASSERT
      const memories = await role.context.memory.working.search({});
      expect(memories.length).toBe(1);
      expect(memories[0].content).toBe('Test content');
    });
  });

  describe('State Management', () => {
    test('should start in idle state', async () => {
      // ARRANGE
      const role = new TestRole();
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for async init
      
      // ACT & ASSERT
      expect(role.getState()).toBe('idle');
    });

    test('should transition through states', async () => {
      // ARRANGE
      const role = new TestRole();
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for async init
      
      // ACT
      role.start();
      expect(role.getState()).toBe('observing');
      
      // Simulate completion of observation with no messages
      role.sendEvent({ type: 'COMPLETE' });
      
      // ASSERT
      expect(role.getState()).toBe('idle');
    });

    test('should reset state', () => {
      const role = new TestRole();
      role.reset();
      expect(role.context.state).toBe(-1);
      expect(role.context.todo).toBeNull();
    });
  });

  describe('Message Handling', () => {
    test('should create message with correct format', () => {
      const role = new TestRole();
      const message = role.testCreateMessage('Test message');
      
      expect(message.content).toBe('Test message');
      expect(message.role).toBe('test_role');
      expect(message.sendTo).toEqual(new Set(['*']));
    });

    test('should subscribe to messages', (done) => {
      const role = new TestRole();
      const testMessage = role.testCreateMessage('Test message');
      
      role.subscribeToMessages().subscribe(message => {
        expect(message).toEqual(testMessage);
        done();
      });
      
      role.testSendMessage(testMessage);
    });

    test('should filter messages by role', (done) => {
      const role = new TestRole();
      const testMessage = role.testCreateMessage('Test message');
      
      role.filterMessagesByRole('test_role').subscribe(message => {
        expect(message.role).toBe('test_role');
        done();
      });
      
      role.testSendMessage(testMessage);
    });
  });

  describe('React Mode', () => {
    test('should set react mode', () => {
      const role = new TestRole();
      role.setReactMode('by_order', 2);
      
      expect(role.context.reactMode).toBe('by_order');
      expect(role.context.maxReactLoop).toBe(2);
    });
  });
}); 