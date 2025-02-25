import { describe, expect, test, mock } from 'bun:test';
import { Engineer } from '../src/roles/engineer';
import type { Message } from '../src/types/message';
import type { Action, ActionOutput } from '../src/types/action';
import type { LLMProvider } from '../src/types/llm';

describe('Role System', () => {
  // 模拟 LLM 提供商
  const mockLLM: LLMProvider = {
    generate: mock(() => Promise.resolve('Analysis: The task requires...')),
    generateStream: mock(async function* () { yield 'test'; }),
    embed: mock(() => Promise.resolve([0.1, 0.2, 0.3])),
  };

  // 模拟动作
  const mockAction: Action = {
    name: 'test_action',
    context: {} as any,
    llm: mockLLM,
    run: mock(() => Promise.resolve({
      content: 'Action completed',
      status: 'completed',
    } as ActionOutput)),
    handleException: mock(() => Promise.resolve()),
  };

  describe('Engineer Role', () => {
    test('should initialize correctly', () => {
      const engineer = new Engineer('test_engineer', mockLLM, [mockAction]);
      expect(engineer.name).toBe('test_engineer');
      expect(engineer.profile).toBe('Software Engineer');
      expect(engineer.state).toBe(-1);
    });

    test('should observe and analyze tasks', async () => {
      const engineer = new Engineer('test_engineer', mockLLM, [mockAction]);
      
      // 模拟一条消息
      const message: Message = {
        id: 'test_message',
        content: 'Implement feature X',
        role: 'user',
        causedBy: 'user_request',
        sentFrom: 'user',
        sendTo: new Set(['test_engineer']),
      };

      // 添加消息到内存
      engineer.context.memory.add(message);

      // 执行观察
      const state = await engineer.observe();
      expect(state).toBeGreaterThanOrEqual(-1);
      expect(mockLLM.generate).toHaveBeenCalled();
    });

    test('should think and select action', async () => {
      const engineer = new Engineer('test_engineer', mockLLM, [mockAction]);
      
      // 执行思考
      const hasAction = await engineer.think();
      expect(hasAction).toBe(true);
      expect(engineer.context.todo).toBe(mockAction);
    });

    test('should execute actions', async () => {
      const engineer = new Engineer('test_engineer', mockLLM, [mockAction]);
      
      // 设置动作并执行
      await engineer.think();
      const result = await engineer.act();
      
      expect(result.content).toBe('Action completed');
      expect(mockAction.run).toHaveBeenCalled();
    });

    test('should handle action errors', async () => {
      const engineer = new Engineer('test_engineer', mockLLM, [mockAction]);
      
      // 模拟动作执行失败
      mockAction.run = mock(() => Promise.reject(new Error('Action failed')));
      
      await engineer.think();
      await expect(engineer.act()).rejects.toThrow('Action failed');
      expect(mockAction.handleException).toHaveBeenCalled();
    });
  });
}); 