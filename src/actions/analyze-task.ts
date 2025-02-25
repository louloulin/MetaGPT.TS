import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';

/**
 * 任务分析动作
 * 使用 LLM 分析任务需求并生成结构化输出
 */
export class AnalyzeTask extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: 'analyze_task',
      description: 'Analyze task requirements and generate structured output',
    });
  }

  /**
   * 执行任务分析
   * @returns 分析结果
   */
  async run(): Promise<ActionOutput> {
    try {
      // 获取任务内容
      const task = this.getArg<string>('task');
      if (!task) {
        return this.createOutput('No task provided', 'failed');
      }

      // 构建提示词
      const prompt = `
Please analyze the following task and provide a structured response:
Task: ${task}

Please provide:
1. Task objective
2. Key requirements
3. Potential challenges
4. Suggested approach
5. Required resources

Format your response in a clear, structured manner.
`;

      // 调用 LLM 进行分析
      const analysis = await this.llm.generate(prompt);

      return this.createOutput(analysis);
    } catch (error) {
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to analyze task: ${(error as Error).message}`,
        'failed'
      );
    }
  }

  /**
   * 自定义错误处理
   */
  async handleException(error: Error): Promise<void> {
    await super.handleException(error);
    // 可以添加特定的错误处理逻辑
    this.setArg('lastError', error.message);
  }
} 