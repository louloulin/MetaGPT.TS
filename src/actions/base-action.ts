import { z } from 'zod';
import type { Action, ActionContext, ActionOutput, ActionConfig } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { ActionContextSchema, ActionOutputSchema } from '../types/action';

/**
 * 动作基类
 * 提供动作系统的基础功能实现
 */
export abstract class BaseAction implements Action {
  name: string;
  context: ActionContext;
  llm: LLMProvider;

  constructor(config: ActionConfig) {
    // 验证配置
    const validConfig = z.object({
      name: z.string(),
      description: z.string().optional(),
      args: z.record(z.any()).optional(),
      llm: z.any(),
      memory: z.any().optional(),
      workingMemory: z.any().optional(),
    }).parse(config);

    this.name = validConfig.name;
    this.llm = validConfig.llm;

    // 构建上下文
    this.context = ActionContextSchema.parse({
      name: validConfig.name,
      description: validConfig.description || '',
      args: validConfig.args || {},
      llm: validConfig.llm,
      memory: validConfig.memory,
      workingMemory: validConfig.workingMemory,
    });
  }

  /**
   * 执行动作
   * 子类必须实现此方法
   */
  abstract run(): Promise<ActionOutput>;

  /**
   * 处理异常
   * @param error 错误对象
   */
  async handleException(error: Error): Promise<void> {
    console.error(`Action ${this.name} failed:`, error);
    // 子类可以覆盖此方法以提供自定义错误处理
  }

  /**
   * 验证动作输出
   * @param output 动作输出
   * @returns 验证后的输出
   */
  protected validateOutput(output: ActionOutput): ActionOutput {
    return ActionOutputSchema.parse(output);
  }

  /**
   * 生成动作输出
   * @param content 输出内容
   * @param status 动作状态
   * @param instructContent 指令内容（可选）
   * @returns 动作输出
   */
  protected createOutput(
    content: string,
    status: 'completed' | 'failed' | 'blocked' = 'completed',
    instructContent?: any
  ): ActionOutput {
    return this.validateOutput({
      content,
      status,
      instructContent,
    });
  }

  /**
   * 获取动作参数
   * @param key 参数键
   * @returns 参数值
   */
  protected getArg<T>(key: string): T | undefined {
    return this.context.args?.[key] as T;
  }

  /**
   * 设置动作参数
   * @param key 参数键
   * @param value 参数值
   */
  protected setArg<T>(key: string, value: T): void {
    if (!this.context.args) {
      this.context.args = {};
    }
    this.context.args[key] = value;
  }
} 