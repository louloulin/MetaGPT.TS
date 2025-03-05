import type { Action, ActionOutput, ActionContext } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { logger } from '../utils/logger';
import { handleLLMResponse } from '../utils/stream-helper';

export interface AssessUnderstandingArgs {
  topic: string;
  level?: string;
}

export class AssessUnderstanding implements Action {
  name = 'AssessUnderstanding';
  context: ActionContext = {
    name: 'assess_understanding',
    description: 'Generate assessment questions to evaluate understanding',
    args: {
      topic: 'The topic to assess',
      level: 'Optional difficulty level'
    },
    memory: null,
    workingMemory: null,
    llm: null
  };
  prefix = 'assess';
  llm: LLMProvider;

  constructor({ llm }: { llm: LLMProvider }) {
    this.llm = llm;
    this.context.llm = llm;
  }

  async run(args?: AssessUnderstandingArgs): Promise<ActionOutput> {
    if (!args?.topic) {
      return {
        status: 'failed',
        content: 'Topic is required'
      };
    }

    logger.info(`[AssessUnderstanding] Generating assessment for topic: ${args.topic}`);

    try {
      const prompt = `你是一位专业的教育专家。请为以下主题创建评估问题：
主题：${args.topic}
难度级别：${args.level || 'intermediate'}

请创建以下类型的问题：
1. 2-3个选择题
2. 2个简答题
3. 1个应用题

每个问题都应该：
- 清晰明确
- 有明确的评分标准
- 能够测试对概念的真正理解

请确保问题难度适中，符合指定的难度级别。`;

      const content = await handleLLMResponse(this.llm, prompt, this.name, {
        timeout: 45000, // 45秒超时
        debug: true
      });

      return {
        status: 'completed',
        content
      };
    } catch (error) {
      logger.error(`[AssessUnderstanding] Error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        status: 'failed',
        content: `Failed to generate assessment: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 