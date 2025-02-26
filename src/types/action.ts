import { z } from 'zod';
import type { Message } from './message';
import type { LLMProvider } from './llm';

export const ActionStatusSchema = z.enum([
  'created',
  'running',
  'completed',
  'failed',
  'blocked'
]);

export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const ActionOutputSchema = z.object({
  content: z.string(),
  status: ActionStatusSchema,
  instructContent: z.any().optional(),
});

export type ActionOutput = z.infer<typeof ActionOutputSchema>;

export const ActionContextSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  args: z.record(z.any()).optional(),
  memory: z.any(),
  workingMemory: z.any(),
  llm: z.any(),
});

export type ActionContext = z.infer<typeof ActionContextSchema>;

export interface ActionConfig {
  name: string;
  description?: string;
  prefix?: string;
  args?: Record<string, any>;
  llm: LLMProvider;
  memory?: any;
  workingMemory?: any;
}

export interface Action {
  name: string;
  context: ActionContext;
  llm: LLMProvider;
  prefix: string;
  desc: string;
  
  run(): Promise<ActionOutput>;
  handleException(error: Error): Promise<void>;
  setPrefix(prefix: string): Action;
} 