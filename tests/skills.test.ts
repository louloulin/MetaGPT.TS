import { describe, expect, test, mock } from 'bun:test';
import { BaseSkill } from '../src/skills/base-skill';
import { CodeReviewSkill } from '../src/skills/code-review';
import type { SkillConfig, SkillResult } from '../src/types/skill';
import type { Action, ActionOutput } from '../src/types/action';
import type { LLMProvider } from '../src/types/llm';

// 创建测试技能类
class TestSkill extends BaseSkill {
  async execute(args?: Record<string, any>): Promise<SkillResult> {
    const input = args?.input || 'default';
    return this.createResult(true, `Processed: ${input}`);
  }
}

// 创建测试动作类
class TestAction implements Action {
  name: string;
  context: any;
  llm: LLMProvider;

  constructor(name: string, llm: LLMProvider) {
    this.name = name;
    this.llm = llm;
    this.context = { args: {} };
  }

  async run(): Promise<ActionOutput> {
    return {
      content: 'Test action completed',
      status: 'completed',
    };
  }

  async handleException(error: Error): Promise<void> {
    console.error(error);
  }
}

describe('Skill System', () => {
  // 模拟 LLM 提供商
  const mockLLM: LLMProvider = {
    generate: mock(() => Promise.resolve('Analysis: The code needs improvement...')),
    generateStream: mock(async function* () { yield 'test'; }),
    embed: mock(() => Promise.resolve([0.1, 0.2, 0.3])),
  };

  describe('BaseSkill', () => {
    test('should initialize correctly', () => {
      const skill = new TestSkill({
        name: 'test_skill',
        description: 'Test skill',
        llm: mockLLM,
      });

      expect(skill.name).toBe('test_skill');
      expect(skill.description).toBe('Test skill');
      expect(skill.llm).toBe(mockLLM);
    });

    test('should handle args correctly', async () => {
      const skill = new TestSkill({
        name: 'test_skill',
        description: 'Test skill',
        llm: mockLLM,
        args: { input: 'test input' },
      });

      const result = await skill.execute({ input: 'test input' });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Processed: test input');
    });

    test('should validate skill availability', async () => {
      const skill = new TestSkill({
        name: 'test_skill',
        description: 'Test skill',
        llm: mockLLM,
      });

      const isValid = await skill.validate();
      expect(isValid).toBe(false); // No actions added

      skill.actions.push(new TestAction('test_action', mockLLM));
      const isValidWithAction = await skill.validate();
      expect(isValidWithAction).toBe(true);
    });
  });

  describe('CodeReviewSkill', () => {
    test('should review code correctly', async () => {
      const skill = new CodeReviewSkill({
        name: 'code_review',
        description: 'Code review skill',
        llm: mockLLM,
      });

      const result = await skill.execute({
        code: `
function add(a, b) {
  return a + b;
}`,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Code review completed successfully');
      expect(mockLLM.generate).toHaveBeenCalled();
    });

    test('should handle missing code', async () => {
      const skill = new CodeReviewSkill({
        name: 'code_review',
        description: 'Code review skill',
        llm: mockLLM,
      });

      const result = await skill.execute();
      expect(result.success).toBe(false);
      expect(result.message).toBe('No code provided for review');
    });

    test('should extract suggestions', async () => {
      const skill = new CodeReviewSkill({
        name: 'code_review',
        description: 'Code review skill',
        llm: mockLLM,
      });

      mockLLM.generate = mock(() => Promise.resolve(`
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
        ...mockLLM,
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
      expect(skill.getArg('lastError')).toBe('LLM failed');
    });
  });
}); 