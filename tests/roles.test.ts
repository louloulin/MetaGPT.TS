import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Engineer } from '../src/roles/engineer';
import { createTestLLMProvider } from './utils/test-llm-provider';
import type { LLMProvider } from '../src/types/llm';
import { Action } from '../src/actions/base';

class TestAction extends Action {
  constructor(name: string, llm: LLMProvider) {
    super({
      name,
      description: 'Test action',
      llm
    });
  }

  async run() {
    return {
      status: 'completed',
      content: 'Test action completed'
    };
  }
}

describe('Roles', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    llmProvider = createTestLLMProvider();
  });

  it('should initialize engineer with correct properties', () => {
    const mockAction = new TestAction('test_action', llmProvider);
    const engineer = new Engineer('test_engineer', llmProvider, [mockAction]);

    expect(engineer.name).toBe('test_engineer');
    expect(engineer.llm).toBe(llmProvider);
    expect(engineer.actions).toContain(mockAction);
  });

  it('should execute actions in sequence', async () => {
    const mockAction = new TestAction('test_action', llmProvider);
    const engineer = new Engineer('test_engineer', llmProvider, [mockAction]);

    const result = await engineer.run();
    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
  });

  it('should handle action failures', async () => {
    const mockAction = new TestAction('test_action', llmProvider);
    mockAction.run = async () => ({
      status: 'failed',
      content: 'Action failed'
    });

    const engineer = new Engineer('test_engineer', llmProvider, [mockAction]);
    const result = await engineer.run();

    expect(result.status).toBe('failed');
    expect(result.content).toContain('failed');
  });

  it('should handle multiple actions', async () => {
    const action1 = new TestAction('action1', llmProvider);
    const action2 = new TestAction('action2', llmProvider);
    const engineer = new Engineer('test_engineer', llmProvider, [action1, action2]);

    const result = await engineer.run();
    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
  });

  it('should handle empty action list', async () => {
    const engineer = new Engineer('test_engineer', llmProvider, []);
    const result = await engineer.run();

    expect(result.status).toBe('failed');
    expect(result.content).toContain('No actions');
  });
}); 