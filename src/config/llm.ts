import { z } from 'zod';

/**
 * LLM API types
 */
export enum LLMType {
  OPENAI = 'openai',
  AZURE = 'azure',
  ANTHROPIC = 'anthropic',
  HUGGINGFACE = 'huggingface',
  CUSTOM = 'custom',
}

/**
 * LLM configuration schema
 */
export const LLMConfigSchema = z.object({
  apiType: z.nativeEnum(LLMType).default(LLMType.OPENAI),
  apiKey: z.string().default(''),
  apiBase: z.string().optional(),
  apiVersion: z.string().optional(),
  model: z.string().default('gpt-4'),
  maxTokens: z.number().default(2000),
  temperature: z.number().default(0.7),
  topP: z.number().default(0.95),
  n: z.number().default(1),
  stop: z.array(z.string()).optional(),
  presencePenalty: z.number().default(0.0),
  frequencyPenalty: z.number().default(0.0),
  logitBias: z.record(z.number()).optional(),
  proxy: z.string().optional(),
  timeout: z.number().default(60),
  maxRetries: z.number().default(3),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>; 