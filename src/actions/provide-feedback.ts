import type { Action, ActionOutput, ActionContext } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { logger } from '../utils/logger';
import { handleLLMResponse } from '../utils/stream-helper';

export interface ProvideFeedbackArgs {
  question: string;
  answer: string;
  style?: string;
}

export class ProvideFeedback implements Action {
  name = 'ProvideFeedback';
  context: ActionContext = {
    name: 'provide_feedback',
    description: 'Provide constructive feedback on student answers',
    args: {
      question: 'The original question',
      answer: 'The student\'s answer',
      style: 'Optional feedback style'
    },
    memory: null,
    workingMemory: null,
    llm: null
  };
  prefix = 'feedback';
  llm: LLMProvider;

  constructor({ llm }: { llm: LLMProvider }) {
    this.llm = llm;
    this.context.llm = llm;
  }

  async run(args?: ProvideFeedbackArgs): Promise<ActionOutput> {
    if (!args?.question || !args?.answer) {
      return {
        status: 'failed',
        content: 'Question and answer are required'
      };
    }

    logger.info(`[ProvideFeedback] Providing feedback for answer to: ${args.question}`);

    try {
      const prompt = `你是一位专业的教育专家。请为以下学生的回答提供建设性反馈：

问题：${args.question}
学生回答：${args.answer}
反馈风格：${args.style || 'supportive'}

请从以下几个方面提供反馈：
1. 正确的观点
2. 需要改进的地方
3. 具体的改进建议
4. 鼓励性的总结

请使用积极和建设性的语言，帮助学生理解并改进。`;

      const content = await handleLLMResponse(this.llm, prompt, this.name, {
        timeout: 45000, // 45秒超时
        debug: true
      });

      return {
        status: 'completed',
        content
      };
    } catch (error) {
      logger.error(`[ProvideFeedback] Error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        status: 'failed',
        content: `Failed to provide feedback: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 