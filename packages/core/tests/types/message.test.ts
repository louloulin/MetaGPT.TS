import { describe, test, expect } from 'bun:test';
import type { Message } from '../../src/types/message';
import {
  MessageSchema,
  UserMessage,
  SystemMessage,
  AIMessage,
  AsyncMessageQueue,
  MESSAGE_ROUTE,
} from '../../src/types/message';

describe('Message System', () => {
  describe('MessageSchema', () => {
    test('validates and transforms valid message data', () => {
      const data = {
        content: 'test message',
        role: 'user',
        sendTo: ['user1', 'user2'],
      };
      const message = MessageSchema.parse(data);
      expect(message.content).toBe('test message');
      expect(message.role).toBe('user');
      expect(message.id).toBeDefined();
      expect(message.sendTo instanceof Set).toBe(true);
      expect(Array.from(message.sendTo)).toEqual(['user1', 'user2']);
    });

    test('provides default values for optional fields', () => {
      const data = {
        content: 'test message',
      };
      const message = MessageSchema.parse(data);
      expect(message.role).toBe('user');
      expect(message.causedBy).toBe(MESSAGE_ROUTE.CAUSE_BY);
      expect(message.sentFrom).toBe(MESSAGE_ROUTE.FROM);
      expect(message.sendTo instanceof Set).toBe(true);
      expect(Array.from(message.sendTo)).toEqual([MESSAGE_ROUTE.TO_ALL]);
    });
  });

  describe('Message Classes', () => {
    test('UserMessage creates message with user role', () => {
      const msg = new UserMessage('test content');
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('test content');
      expect(msg.id).toBeDefined();
    });

    test('SystemMessage creates message with system role', () => {
      const msg = new SystemMessage('test content');
      expect(msg.role).toBe('system');
      expect(msg.content).toBe('test content');
      expect(msg.id).toBeDefined();
    });

    test('AIMessage creates message with assistant role', () => {
      const msg = new AIMessage('test content');
      expect(msg.role).toBe('assistant');
      expect(msg.content).toBe('test content');
      expect(msg.id).toBeDefined();
    });
  });

  describe('AsyncMessageQueue', () => {
    test('push and pop messages', async () => {
      const queue = new AsyncMessageQueue();
      const msg = new UserMessage('test message');
      queue.push(msg);
      expect(queue.empty()).toBe(false);
      
      const popped = await queue.pop();
      expect(popped).toEqual(msg);
      expect(queue.empty()).toBe(true);
    });

    test('pop returns null for empty queue', async () => {
      const queue = new AsyncMessageQueue();
      const msg = await queue.pop();
      expect(msg).toBeNull();
    });

    test('popAll returns all messages', async () => {
      const queue = new AsyncMessageQueue();
      const msgs = [
        new UserMessage('msg1'),
        new SystemMessage('msg2'),
        new AIMessage('msg3'),
      ];
      msgs.forEach(msg => queue.push(msg));
      
      const popped = await queue.popAll();
      expect(popped).toEqual(msgs);
      expect(queue.empty()).toBe(true);
    });

    test('dump and load queue state', async () => {
      const queue = new AsyncMessageQueue();
      const msgs = [
        new UserMessage('msg1'),
        new SystemMessage('msg2'),
        new AIMessage('msg3'),
      ];
      msgs.forEach(msg => queue.push(msg));
      
      const dumped = await queue.dump();
      const loaded = AsyncMessageQueue.load(dumped);
      
      expect(loaded.empty()).toBe(false);
      const loadedMsgs = await loaded.popAll();
      expect(loadedMsgs.length).toBe(msgs.length);
      loadedMsgs.forEach((msg, i) => {
        expect(msg.content).toBe(msgs[i].content);
        expect(msg.role).toBe(msgs[i].role);
      });
    });

    test('handles invalid JSON when loading', () => {
      const queue = AsyncMessageQueue.load('invalid json');
      expect(queue.empty()).toBe(true);
    });
  });
}); 