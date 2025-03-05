import { z } from 'zod';
import type { Action } from './action';
import type { LLMProvider } from './llm';

/**
 * 技能配置结构
 */
export const SkillConfigSchema = z.object({
  name: z.string(),                      // 技能名称
  description: z.string(),               // 技能描述
  llm: z.any(),                         // LLM 提供商
  actions: z.array(z.any()).optional(), // 技能包含的动作
  args: z.record(z.any()).optional(),   // 技能参数
});

export type SkillConfig = z.infer<typeof SkillConfigSchema>;

/**
 * 技能上下文结构
 */
export const SkillContextSchema = z.object({
  name: z.string(),
  description: z.string(),
  actions: z.array(z.any()),
  args: z.record(z.any()).optional(),
  llm: z.any(),
});

export type SkillContext = z.infer<typeof SkillContextSchema>;

/**
 * 技能执行结果结构
 */
export const SkillResultSchema = z.object({
  success: z.boolean(),                 // 执行是否成功
  message: z.string(),                  // 结果消息
  data: z.any().optional(),            // 执行结果数据
  error: z.any().optional(),           // 错误信息
});

export type SkillResult = z.infer<typeof SkillResultSchema>;

/**
 * 技能接口
 */
export interface Skill {
  name: string;                        // 技能名称
  description: string;                 // 技能描述
  context: SkillContext;              // 技能上下文
  llm: LLMProvider;                   // LLM 提供商
  actions: Action[];                  // 技能包含的动作

  /**
   * 执行技能
   * @param args 执行参数
   * @returns 执行结果
   */
  execute(args?: Record<string, any>): Promise<SkillResult>;

  /**
   * 验证技能是否可用
   * @returns 验证结果
   */
  validate(): Promise<boolean>;

  /**
   * 处理技能执行异常
   * @param error 错误对象
   */
  handleError(error: Error): Promise<void>;
} 