import type { Action, ActionOutput, ActionContext } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { logger } from '../utils/logger';
import { handleLLMResponse } from '../utils/stream-helper';

export interface ExplainConceptArgs {
  concept: string;
  level?: string;
}

export class ExplainConcept implements Action {
  name = 'ExplainConcept';
  context: ActionContext = {
    name: 'explain_concept',
    description: 'Explain concepts clearly and thoroughly',
    args: {
      concept: 'The concept to explain',
      level: 'Optional difficulty level'
    },
    memory: null,
    workingMemory: null,
    llm: null
  };
  prefix = 'explain';
  llm: LLMProvider;

  constructor({ llm }: { llm: LLMProvider }) {
    this.llm = llm;
    this.context.llm = llm;
  }

  async run(args?: ExplainConceptArgs): Promise<ActionOutput> {
    if (!args?.concept) {
      return {
        status: 'failed',
        content: 'Concept is required'
      };
    }

    logger.info(`[ExplainConcept] Explaining concept: ${args.concept}`);

    try {
      const prompt = `你是一位专业的教育专家。请解释以下概念：
概念：${args.concept}
难度级别：${args.level || 'intermediate'}

请从以下几个方面进行解释：
1. 基本定义
2. 关键特点
3. 实际应用
4. 相关概念

请用清晰简洁的语言解释，确保易于理解。`;

      const content = await handleLLMResponse(this.llm, prompt, this.name, {
        timeout: 45000, // 45秒超时
        debug: true
      });

      return {
        status: 'completed',
        content
      };
    } catch (error) {
      logger.error(`[ExplainConcept] Error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        status: 'failed',
        content: `Failed to explain concept: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 