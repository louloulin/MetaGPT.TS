import { describe, expect, test, mock } from 'bun:test';
import { BaseAction } from '../src/actions/base-action';
import { AnalyzeTask } from '../src/actions/analyze-task';
import type { ActionOutput, ActionConfig } from '../src/types/action';
import type { LLMProvider } from '../src/types/llm';

// 创建测试动作类
class TestAction extends BaseAction {
  async run(): Promise<ActionOutput> {
    const input = this.getArg<string>('input');
    return this.createOutput(`Processed: ${input}`);
  }
}

describe('Action System', () => {
  // 模拟 LLM 提供商
  const mockLLM: LLMProvider = {
    generate: mock(() => Promise.resolve('Analysis: The task requires...')),
    generateStream: mock(async function* () { yield 'test'; }),
    embed: mock(() => Promise.resolve([0.1, 0.2, 0.3])),
  };

  describe('BaseAction', () => {
    test('should initialize correctly', () => {
      const action = new TestAction({
        name: 'test_action',
        description: 'Test action',
        llm: mockLLM,
      });

      expect(action.name).toBe('test_action');
      expect(action.llm).toBe(mockLLM);
    });

    test.skip('should handle args correctly', async () => {
      const action = new TestAction({
        name: 'test_action',
        llm: mockLLM,
        args: { input: 'test input' },
      });

      const output = await action.run();
      expect(output.content).toBe('Processed: test input');
      expect(output.status).toBe('completed');
    });

    test('should validate output', () => {
      const action = new TestAction({
        name: 'test_action',
        llm: mockLLM,
      });

      expect(() => 
        action['validateOutput']({
          content: 'test',
          status: 'invalid_status' as any,
        })
      ).toThrow();
    });
  });

  describe('AnalyzeTask', () => {
    test.skip('should analyze task correctly', async () => {
      const action = new AnalyzeTask({
        name: 'analyze_task',
        llm: mockLLM,
        args: { task: 'Implement feature X' },
      });

      const output = await action.run();
      expect(output.status).toBe('completed');
      expect(output.content).toContain('Analysis:');
      expect(mockLLM.generate).toHaveBeenCalled();
    });

    test('should handle missing task', async () => {
      const action = new AnalyzeTask({
        name: 'analyze_task',
        llm: mockLLM,
      });

      const output = await action.run();
      expect(output.status).toBe('failed');
      expect(output.content).toBe('No task provided');
    });

    test.skip('should handle LLM errors', async () => {
      const errorLLM: LLMProvider = {
        ...mockLLM,
        generate: mock(() => Promise.reject(new Error('LLM failed'))),
      };

      const action = new AnalyzeTask({
        name: 'analyze_task',
        llm: errorLLM,
        args: { task: 'test task' },
      });

      const output = await action.run();
      expect(output.status).toBe('failed');
      expect(output.content).toContain('Failed to analyze task');
      expect(action.getArg('lastError')).toBe('LLM failed');
    });
  });
}); 