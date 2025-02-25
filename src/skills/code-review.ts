import { BaseSkill } from './base-skill';
import { AnalyzeTask } from '../actions/analyze-task';
import type { SkillConfig, SkillResult } from '../types/skill';
import type { ActionOutput } from '../types/action';

/**
 * 代码审查技能
 * 使用 LLM 进行代码审查并提供改进建议
 */
export class CodeReviewSkill extends BaseSkill {
  constructor(config: SkillConfig) {
    super({
      ...config,
      name: 'code_review',
      description: 'Review code and provide improvement suggestions',
    });

    // 添加代码分析动作
    this.actions.push(
      new AnalyzeTask({
        name: 'analyze_code',
        description: 'Analyze code structure and quality',
        llm: this.llm,
      })
    );
  }

  /**
   * 执行代码审查
   * @param args 执行参数
   * @returns 审查结果
   */
  async execute(args?: Record<string, any>): Promise<SkillResult> {
    try {
      // 验证输入
      if (!args?.code) {
        return this.createResult(false, 'No code provided for review');
      }

      // 设置分析参数
      this.actions[0].context.args = {
        task: `Review the following code and provide improvement suggestions:
${args.code}

Please analyze:
1. Code structure and organization
2. Potential bugs or issues
3. Performance considerations
4. Best practices compliance
5. Suggested improvements

Please provide specific examples and explanations for each point.`,
      };

      // 执行代码分析
      const result = await this.executeActions(this.actions);
      if (!result.success) {
        return result;
      }

      // 处理分析结果
      const analysisResults = result.data as ActionOutput[];
      const analysis = analysisResults[0].content;

      return this.createResult(
        true,
        'Code review completed successfully',
        {
          analysis,
          suggestions: this.extractSuggestions(analysis),
        }
      );
    } catch (error) {
      await this.handleError(error as Error);
      return this.createResult(
        false,
        `Code review failed: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * 从分析结果中提取建议
   * @param analysis 分析结果文本
   * @returns 建议列表
   */
  private extractSuggestions(analysis: string): string[] {
    const suggestions: string[] = [];
    const lines = analysis.split('\n');

    let inSuggestionSection = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('suggested improvements')) {
        inSuggestionSection = true;
        continue;
      }

      if (inSuggestionSection && line.trim()) {
        // 移除序号和点号
        const suggestion = line.replace(/^\d+[.)][ \t]*/, '').trim();
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions;
  }

  /**
   * 自定义错误处理
   */
  async handleError(error: Error): Promise<void> {
    await super.handleError(error);
    this.setArg('lastError', error.message);
    // 可以添加特定的错误处理逻辑，如通知代码作者等
  }
} 