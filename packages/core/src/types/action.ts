import { z } from 'zod';
import type { Message } from './message';
import type { LLMProvider } from './llm';
import type { MemoryManager } from './memory';
import type { Role } from './role';

export const ActionStatusSchema = z.enum([
  'created',
  'running',
  'completed',
  'failed',
  'blocked'
]);

export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export interface StreamActionOutput {
  content: string;
  status: ActionStatus;
  metadata?: Record<string, any>;
}

export interface ActionContext {
  name: string;
  description: string;
  args?: Record<string, any>;
  memory?: MemoryManager;
  workingMemory?: MemoryManager;
  role?: Role;
}

export const ActionContextSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  args: z.record(z.any()).optional(),
  memory: z.any(),
  workingMemory: z.any(),
  role: z.any().optional(),
});

export interface ActionConfig {
  name: string;
  description?: string;
  prefix?: string;
  args?: Record<string, any>;
  llm: LLMProvider;
  memory?: any;
  workingMemory?: any;
  useStream?: boolean;
  streamOptions?: {
    timeout?: number;
    debug?: boolean;
  };
}

export interface Action {
  name: string;
  desc: string;
  context: ActionContext;
  prefix: string;
  run(options?: any): Promise<StreamActionOutput>;
  toString(): string;
} 