import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { Actor, ActorSystem } from '../../src/actor/actor';
import type { ActorMessage, MessageHandler } from '../../src/actor/actor';

// Create a concrete Actor class for testing
class TestActor extends Actor {
  public testState: { value: number } = { value: 0 };

  constructor(id?: string) {
    super('TestActor', id);
  }

  public async increment(): Promise<void> {
    this.testState.value += 1;
  }

  public getValue(): number {
    return this.testState.value;
  }
}

describe('Actor', () => {
  let actor: TestActor;
  let actorSystem: ActorSystem;

  beforeEach(async () => {
    actorSystem = ActorSystem.getInstance();
    actor = new TestActor();
    await actorSystem.registerActor(actor);
    await actor.start();
  });

  afterEach(async () => {
    await actor.stop();
    await actorSystem.unregisterActor(actor.getId());
  });

  describe('Basic Properties', () => {
    test('should have unique ID', () => {
      const actor1 = new TestActor();
      const actor2 = new TestActor();
      expect(actor1.getId()).not.toBe(actor2.getId());
    });

    test('should use provided ID if given', () => {
      const customId = 'custom-id';
      const actor = new TestActor(customId);
      expect(actor.getId()).toBe(customId);
    });

    test('should have correct type', () => {
      expect(actor.getType()).toBe('TestActor');
    });
  });

  describe('Message Handling', () => {
    test('should handle messages with registered handlers', async () => {
      const messageType = 'TEST_MESSAGE';
      const handler: MessageHandler = jest.fn().mockResolvedValue(undefined);
      actor.addHandler(messageType, handler);

      const message: ActorMessage = {
        id: 'test-id',
        from: 'sender',
        to: actor.getId(),
        type: messageType,
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      await actor.receive(message, actor);
      expect(handler).toHaveBeenCalledWith(message, actor);
    });

    test('should ignore messages without handlers', async () => {
      const message: ActorMessage = {
        id: 'test-id',
        from: 'sender',
        to: actor.getId(),
        type: 'UNKNOWN_TYPE',
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      // Should not throw error
      await expect(actor.receive(message, actor)).resolves.toBeUndefined();
    });

    test('should remove message handlers', () => {
      const messageType = 'TEST_MESSAGE';
      const handler: MessageHandler = jest.fn().mockResolvedValue(undefined);
      actor.addHandler(messageType, handler);
      actor.removeHandler(messageType);

      expect(actor['handlers'].has(messageType)).toBe(false);
    });
  });

  describe('State Management', () => {
    test('should maintain internal state', async () => {
      expect(actor.getValue()).toBe(0);
      await actor.increment();
      expect(actor.getValue()).toBe(1);
    });

    test('should get and set state', () => {
      const newState = { value: 42 };
      actor.setState(newState);
      expect(actor.getState()).toEqual(newState);
    });
  });

  describe('Message Communication', () => {
    let actor1: TestActor;
    let actor2: TestActor;

    beforeEach(async () => {
      actor1 = new TestActor('actor1');
      actor2 = new TestActor('actor2');
      await actorSystem.registerActor(actor1);
      await actorSystem.registerActor(actor2);
      await actor1.start();
      await actor2.start();
    });

    afterEach(async () => {
      await actor1.stop();
      await actor2.stop();
      await actorSystem.unregisterActor(actor1.getId());
      await actorSystem.unregisterActor(actor2.getId());
    });

    test('should send and receive messages', async () => {
      const messageType = 'TEST_MESSAGE';
      const messagePayload = { data: 'test' };
      const receivedMessages: ActorMessage[] = [];

      actor2.addHandler(messageType, async (message) => {
        receivedMessages.push(message);
      });

      await actor1.send(actor2.getId(), messageType, messagePayload);

      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].type).toBe(messageType);
      expect(receivedMessages[0].payload).toEqual(messagePayload);
      expect(receivedMessages[0].from).toBe(actor1.getId());
      expect(receivedMessages[0].to).toBe(actor2.getId());
    });

    test('should handle request-response pattern', async () => {
      const requestType = 'GET_VALUE';
      const responseValue = 42;

      actor2.addHandler(requestType, async (message) => {
        await actor2.send(
          message.replyTo!,
          'response',
          responseValue,
          { correlationId: message.correlationId }
        );
      });

      const response = await actor1.request(actor2.getId(), requestType, null);
      expect(response).toBe(responseValue);
    });

    test('should timeout on request with no response', async () => {
      const requestType = 'TIMEOUT_TEST';
      const timeout = 100;

      await expect(
        actor1.request(actor2.getId(), requestType, null, timeout)
      ).rejects.toThrow('timed out');
    });
  });

  describe('Lifecycle', () => {
    test('should not process messages when stopped', async () => {
      await actor.stop();
      const handler: MessageHandler = jest.fn().mockResolvedValue(undefined);
      actor.addHandler('TEST', handler);

      const message: ActorMessage = {
        id: 'test-id',
        from: 'sender',
        to: actor.getId(),
        type: 'TEST',
        payload: null,
        timestamp: Date.now(),
      };

      await actor.receive(message, actor);
      expect(handler).not.toHaveBeenCalled();
    });

    test('should not send messages when stopped', async () => {
      await actor.stop();
      await expect(
        actor.send('target', 'TEST', null)
      ).rejects.toThrow('not started');
    });

    test('should not make requests when stopped', async () => {
      await actor.stop();
      await expect(
        actor.request('target', 'TEST', null)
      ).rejects.toThrow('not started');
    });
  });
}); 