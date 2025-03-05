import type { Action, ActionOutput, ActionContext } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { logger } from '../utils/logger';
import { handleLLMResponse } from '../utils/stream-helper';

export interface CreateLessonArgs {
  topic: string;
  style?: string;
}

export class CreateLesson implements Action {
  name = 'CreateLesson';
  context: ActionContext = {
    name: 'create_lesson',
    description: 'Create a detailed lesson plan',
    args: {
      topic: 'The topic to teach',
      style: 'Optional teaching style'
    },
    memory: null,
    workingMemory: null,
    llm: null
  };
  prefix = 'create';
  llm: LLMProvider;

  constructor({ llm }: { llm: LLMProvider }) {
    this.llm = llm;
    this.context.llm = llm;
  }

  async run(args?: CreateLessonArgs): Promise<ActionOutput> {
    if (!args?.topic) {
      return {
        status: 'failed',
        content: 'Topic is required'
      };
    }

    logger.info(`[CreateLesson] Creating lesson plan for topic: ${args.topic}`);

    try {
      const prompt = `你是一位专业的教育专家。请为以下主题创建一个详细的课程计划：
主题：${args.topic}
教学风格：${args.style || 'adaptive'}

请包含以下内容：
1. 学习目标
2. 课程大纲
3. 教学活动
4. 评估方法

请用简洁的方式组织内容，重点突出关键信息。`;

      const content = await handleLLMResponse(this.llm, prompt, this.name, {
        timeout: 60000, // 增加到60秒
        debug: true
      });

      return {
        status: 'completed',
        content
      };
    } catch (error) {
      logger.error(`[CreateLesson] Error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        status: 'failed',
        content: `Failed to create lesson plan: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 