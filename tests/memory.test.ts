import { describe, expect, test } from 'bun:test';
import { ArrayMemory, MemoryConfigSchema } from '../src/types/memory';
import type { Message } from '../src/types/message';

describe('Memory System', () => {
  test('MemoryConfig validation', () => {
    expect(() => MemoryConfigSchema.parse({})).not.toThrow();
    expect(() => MemoryConfigSchema.parse({ maxSize: 100 })).not.toThrow();
    expect(() => MemoryConfigSchema.parse({ maxSize: 'invalid' })).toThrow();
  });

  describe('ArrayMemory', () => {
    const testMessage: Message = {
      id: '1',
      content: 'test',
      role: 'user',
      causedBy: 'action1',
      sentFrom: 'user',
      sendTo: new Set(['assistant']),
    };

    test('should add and get messages', () => {
      const memory = new ArrayMemory();
      memory.add(testMessage);
      expect(memory.get()).toEqual([testMessage]);
    });

    test('should respect maxSize limit', () => {
      const memory = new ArrayMemory({ maxSize: 2 });
      const msg1 = { ...testMessage, id: '1' };
      const msg2 = { ...testMessage, id: '2' };
      const msg3 = { ...testMessage, id: '3' };

      memory.add(msg1);
      memory.add(msg2);
      memory.add(msg3);

      const messages = memory.get();
      expect(messages).toHaveLength(2);
      expect(messages).toEqual([msg2, msg3]);
    });

    test('should filter by actions', () => {
      const memory = new ArrayMemory();
      const msg1 = { ...testMessage, causedBy: 'action1' };
      const msg2 = { ...testMessage, causedBy: 'action2' };

      memory.add(msg1);
      memory.add(msg2);

      const filtered = memory.getByActions(new Set(['action1']));
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toEqual(msg1);
    });

    test('should clear all messages', () => {
      const memory = new ArrayMemory();
      memory.add(testMessage);
      memory.clear();
      expect(memory.get()).toHaveLength(0);
    });
  });
}); 