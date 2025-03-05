import { z } from 'zod';
import type { Skill, SkillConfig, SkillContext, SkillResult } from '../types/skill';
import type { Action } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { SkillContextSchema, SkillResultSchema } from '../types/skill';

/**
 * 技能基类
 * 提供技能系统的基础功能实现
 */
export abstract class BaseSkill implements Skill {
  name: string;
  description: string;
  context: SkillContext;
  llm: LLMProvider;
  actions: Action[];

  constructor(config: SkillConfig) {
    // 验证配置
    const validConfig = z.object({
      name: z.string(),
      description: z.string(),
      llm: z.any(),
      actions: z.array(z.any()).optional(),
      args: z.record(z.any()).optional(),
    }).parse(config);

    this.name = validConfig.name;
    this.description = validConfig.description;
    this.llm = validConfig.llm;
    this.actions = validConfig.actions || [];

    // 构建上下文
    this.context = SkillContextSchema.parse({
      name: validConfig.name,
      description: validConfig.description,
      actions: this.actions,
      args: validConfig.args || {},
      llm: validConfig.llm,
    });
  }

  /**
   * 执行技能
   * 子类必须实现此方法
   */
  abstract execute(args?: Record<string, any>): Promise<SkillResult>;

  /**
   * 验证技能是否可用
   * 子类可以覆盖此方法以提供自定义验证
   */
  async validate(): Promise<boolean> {
    return this.actions.length > 0;
  }

  /**
   * 处理技能执行异常
   * @param error 错误对象
   */
  async handleError(error: Error): Promise<void> {
    console.error(`Skill ${this.name} failed:`, error);
    // 子类可以覆盖此方法以提供自定义错误处理
  }

  /**
   * 创建技能执行结果
   * @param success 是否成功
   * @param message 结果消息
   * @param data 结果数据
   * @param error 错误信息
   */
  protected createResult(
    success: boolean,
    message: string,
    data?: any,
    error?: any
  ): SkillResult {
    return SkillResultSchema.parse({
      success,
      message,
      data,
      error,
    });
  }

  /**
   * 获取技能参数
   * @param key 参数键
   * @returns 参数值
   */
  protected getArg<T>(key: string): T | undefined {
    return this.context.args?.[key] as T;
  }

  /**
   * 设置技能参数
   * @param key 参数键
   * @param value 参数值
   */
  protected setArg<T>(key: string, value: T): void {
    if (!this.context.args) {
      this.context.args = {};
    }
    this.context.args[key] = value;
  }

  /**
   * 执行动作序列
   * @param actions 要执行的动作
   * @returns 执行结果
   */
  protected async executeActions(actions: Action[]): Promise<SkillResult> {
    try {
      const results = [];
      for (const action of actions) {
        const result = await action.run();
        results.push(result);
        
        if (result.status === 'failed') {
          return this.createResult(
            false,
            `Action ${action.name} failed: ${result.content}`,
            results
          );
        }
      }
      
      return this.createResult(
        true,
        'All actions completed successfully',
        results
      );
    } catch (error) {
      await this.handleError(error as Error);
      return this.createResult(
        false,
        `Failed to execute actions: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }
} 