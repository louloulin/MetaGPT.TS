import { describe, test, expect, beforeEach } from 'bun:test';
import { MemoryManagerImpl } from '../../src/memory/manager';
import { WorkingMemoryImpl } from '../../src/memory/working';
import { LongTermMemoryImpl } from '../../src/memory/longterm';
import { UserMessage, SystemMessage } from '../../src/types/message';

describe('Memory System', () => {
  let manager: MemoryManagerImpl;
  let working: WorkingMemoryImpl;
  let longTerm: LongTermMemoryImpl;

  beforeEach(async () => {
    manager = new MemoryManagerImpl();
    working = manager.working;
    longTerm = manager.longTerm;
    await manager.init();
  });

  describe('Working Memory', () => {
    test('adds and retrieves memories', async () => {
      const memory = await working.add('test content', 'test', { key: 'value' });
      expect(memory.content).toBe('test content');
      expect(memory.type).toBe('test');
      expect(memory.metadata.key).toBe('value');

      const retrieved = await working.get(memory.id);
      expect(retrieved).toEqual(memory);
    });

    test('searches memories with filters', async () => {
      const mem1 = await working.add('memory 1', 'type1', { importance: 0.8 });
      const mem2 = await working.add('memory 2', 'type2', { importance: 0.3 });
      const mem3 = await working.add('memory 3', 'type1', { importance: 0.6 });

      const results = await working.search({
        type: 'type1',
        minImportance: 0.5,
      });

      expect(results).toHaveLength(2);
      // Results should be sorted by importance
      expect(results[0].content).toBe('memory 1'); // Higher importance (0.8)
      expect(results[1].content).toBe('memory 3'); // Lower importance (0.6)
    });

    test('manages focus of attention', async () => {
      const memory = await working.add('focus test', 'test');
      await working.setFocus(memory.id);

      const focused = await working.getFocus();
      expect(focused).toEqual(memory);

      await working.clearFocus();
      expect(await working.getFocus()).toBeNull();
    });
  });

  describe('Long-term Memory', () => {
    test('consolidates working memory', async () => {
      // Add memories to working memory
      await working.add('important memory', 'test', { importance: 0.9 });
      await working.add('unimportant memory', 'test', { importance: 0.2 });

      // Consolidate memories
      await longTerm.consolidate(working);

      // Check working memory is cleared
      expect(await working.search({})).toHaveLength(0);

      // Check important memory was consolidated
      const consolidated = await longTerm.search({
        content: 'important memory',
      });
      expect(consolidated).toHaveLength(1);
    });

    test('forgets old unimportant memories', async () => {
      const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago

      // Add old memories
      const mem1 = await longTerm.add('old important', 'test', {
        importance: 0.9,
        timestamp: oldTime,
      });
      const mem2 = await longTerm.add('old unimportant', 'test', {
        importance: 0.3,
        timestamp: oldTime,
      });

      console.log('Before forgetting:', await longTerm.search({}));

      // Forget old memories
      await longTerm.forget({
        endTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        minImportance: 0.8,
      });

      const remaining = await longTerm.search({});
      console.log('After forgetting:', remaining);

      expect(remaining).toHaveLength(1);
      expect(remaining[0].content).toBe('old important');
    });
  });

  describe('Memory Manager', () => {
    test('processes messages with appropriate importance', async () => {
      const systemMsg = new SystemMessage('system message');
      const userMsg = new UserMessage('user message');

      await manager.processMessage(systemMsg);
      await manager.processMessage(userMsg);

      const memories = await working.search({});
      expect(memories).toHaveLength(2);

      const [systemMemory, userMemory] = memories;
      expect(systemMemory.importance).toBeGreaterThan(userMemory.importance);
    });

    test('retrieves relevant context', async () => {
      // Add some memories
      await manager.processMessage(new UserMessage('context test 1'));
      await manager.processMessage(new UserMessage('context test 2'));
      await manager.processMessage(new UserMessage('unrelated message'));

      console.log('Working memories before consolidation:', await working.search({}));

      // Consolidate to long-term memory
      await longTerm.consolidate(working);

      console.log('Long-term memories after consolidation:', await longTerm.search({}));

      // Add new working memory
      await manager.processMessage(new UserMessage('current context'));

      console.log('Working memories after new message:', await working.search({}));

      // Get context for a related message - use "context" which matches existing memories
      const context = await manager.getContext(new UserMessage('context test'));
      
      console.log('Retrieved context:', context);

      expect(context.length).toBeGreaterThan(0);
      expect(context.some(m => m.content.includes('context'))).toBe(true);
    });

    test('handles cleanup properly', async () => {
      // Add memories
      await manager.processMessage(new UserMessage('test message 1'));
      await manager.processMessage(new UserMessage('test message 2'));

      // Perform cleanup
      await manager.cleanup();

      // Check working memory is cleared
      expect(await working.search({})).toHaveLength(0);

      // Check memories were consolidated
      const consolidated = await longTerm.search({});
      expect(consolidated.length).toBeGreaterThan(0);
    });
  });
}); 