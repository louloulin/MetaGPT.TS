import { z } from 'zod';
import type { Message } from './message';

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
  // TODO: Define action context properties
  memory: z.any(),
  workingMemory: z.any(),
  llm: z.any(),
});

export type ActionContext = z.infer<typeof ActionContextSchema>;

export interface Action {
  name: string;
  context: ActionContext;
  llm: any; // TODO: Define LLMProvider type
  
  run(): Promise<ActionOutput>;
  handleException(error: Error): Promise<void>;
} 