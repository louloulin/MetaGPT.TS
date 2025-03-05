import { BaseAction } from './base-action';
import type { StreamActionOutput, ActionConfig } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { logger } from '../utils/logger';
import { handleLLMResponse } from '../utils/stream-helper';

export interface AssessUnderstandingConfig extends ActionConfig {
  topic?: string;
  level?: string;
}

/**
 * Action for generating assessment questions to evaluate understanding
 */
export class AssessUnderstanding extends BaseAction {
  private topic: string;
  private level: string;

  constructor(config: AssessUnderstandingConfig) {
    super({
      ...config,
      name: config.name || 'AssessUnderstanding',
      description: config.description || 'Generate assessment questions to evaluate understanding'
    });

    this.topic = config.topic || '';
    this.level = config.level || 'intermediate';
  }

  protected async prompt(): Promise<string> {
    const topic = this.getArg<string>('topic') || this.topic;
    const level = this.getArg<string>('level') || this.level;

    if (!topic) {
      throw new Error('Topic is required');
    }

    return `你是一位专业的教育专家。请为以下主题创建评估问题：
主题：${topic}
难度级别：${level}

请创建以下类型的问题：
1. 2-3个选择题
2. 2个简答题
3. 1个应用题

每个问题都应该：
- 清晰明确
- 有明确的评分标准
- 能够测试对概念的真正理解

请确保问题难度适中，符合指定的难度级别。`;
  }

  public async run(): Promise<StreamActionOutput> {
    try {
      const prompt = await this.prompt();
      const response = await this.ask(prompt);

      return this.createOutput(
        response,
        'completed',
        {
          topic: this.getArg<string>('topic') || this.topic,
          level: this.getArg<string>('level') || this.level
        }
      );
    } catch (error) {
      logger.error(`[${this.name}] Error:`, error);
      return this.createOutput(
        `Failed to generate assessment: ${error instanceof Error ? error.message : String(error)}`,
        'failed'
      );
    }
  }
} 