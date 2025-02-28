import { describe, expect, test, mock } from 'bun:test';
import { BaseSkill } from '../src/skills/base-skill';
import { CodeReviewSkill } from '../src/skills/code-review';
import type { SkillConfig, SkillResult } from '../src/types/skill';
import type { Action, ActionOutput } from '../src/types/action';
import type { LLMProvider } from '../src/types/llm';
import { Skill } from '../src/skills/base';
import { createTestLLMProvider } from './utils/test-llm-provider';
import { Action as BaseAction } from '../src/actions/base';

// 创建测试技能类
class TestSkill extends Skill {
  constructor(name: string, llm: LLMProvider) {
    super(name, llm);
  }
}

// 创建测试动作类
class TestAction extends BaseAction {
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

describe('Skill System', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    llmProvider = createTestLLMProvider();
  });

  describe('BaseSkill', () => {
    test('should initialize correctly', () => {
      const skill = new TestSkill('test_skill', llmProvider);

      expect(skill.name).toBe('test_skill');
      expect(skill.llm).toBe(llmProvider);
    });

    test('should handle args correctly', async () => {
      const skill = new TestSkill('test_skill', llmProvider);

      const result = await skill.run();
      expect(result.status).toBe('completed');
      expect(result.content).toBe('Test action completed');
    });

    test('should validate skill availability', async () => {
      const skill = new TestSkill('test_skill', llmProvider);

      const isValid = await skill.validate();
      expect(isValid).toBe(false); // No actions added

      const action = new TestAction('test_action', llmProvider);
      skill.addAction(action);
      const isValidWithAction = await skill.validate();
      expect(isValidWithAction).toBe(true);
    });
  });

  describe('CodeReviewSkill', () => {
    test('should review code correctly', async () => {
      const skill = new CodeReviewSkill({
        name: 'code_review',
        description: 'Code review skill',
        llm: llmProvider,
      });

      const result = await skill.execute({
        code: `
function add(a, b) {
  return a + b;
}`,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Code review completed successfully');
    });

    test('should handle missing code', async () => {
      const skill = new CodeReviewSkill({
        name: 'code_review',
        description: 'Code review skill',
        llm: llmProvider,
      });

      const result = await skill.execute();
      expect(result.success).toBe(false);
      expect(result.message).toBe('No code provided for review');
    });

    test('should extract suggestions', async () => {
      const skill = new CodeReviewSkill({
        name: 'code_review',
        description: 'Code review skill',
        llm: llmProvider,
      });

      llmProvider.generate = mock(() => Promise.resolve(`
Analysis:
Some analysis text...

Suggested Improvements:
1. Add type annotations
2. Include error handling
3. Improve documentation
`));

      const result = await skill.execute({ code: 'test code' });
      expect(result.success).toBe(true);
      expect((result.data as any).suggestions).toEqual([
        'Add type annotations',
        'Include error handling',
        'Improve documentation',
      ]);
    });

    test.skip('should handle LLM errors', async () => {
      const errorLLM: LLMProvider = {
        ...llmProvider,
        generate: mock(() => Promise.reject(new Error('LLM failed'))),
      };

      const skill = new CodeReviewSkill({
        name: 'code_review',
        description: 'Code review skill',
        llm: errorLLM,
      });

      const result = await skill.execute({ code: 'test code' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Code review failed');
    });
  });
}); 