import { z } from 'zod';

/**
 * Embedding model types
 */
export enum EmbeddingModelType {
  OPENAI = 'text-embedding-ada-002',
  HUGGINGFACE = 'sentence-transformers/all-mpnet-base-v2',
  CUSTOM = 'custom',
}

/**
 * Embedding configuration schema
 */
export const EmbeddingConfigSchema = z.object({
  modelType: z.nativeEnum(EmbeddingModelType).default(EmbeddingModelType.OPENAI),
  modelName: z.string().optional(),
  dimensions: z.number().default(1536),
  apiKey: z.string().optional(),
  apiBase: z.string().optional(),
  batchSize: z.number().default(512),
  timeout: z.number().default(60),
  maxRetries: z.number().default(3),
});

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>; 