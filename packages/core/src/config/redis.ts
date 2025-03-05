import { z } from 'zod';

/**
 * Redis configuration schema
 */
export const RedisConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().default(6379),
  db: z.number().default(0),
  password: z.string().optional(),
  username: z.string().optional(),
  tls: z.boolean().default(false),
  sentinel: z.object({
    enabled: z.boolean().default(false),
    masterName: z.string().optional(),
    nodes: z.array(z.object({
      host: z.string(),
      port: z.number(),
    })).optional(),
  }).default({}),
  cluster: z.object({
    enabled: z.boolean().default(false),
    nodes: z.array(z.object({
      host: z.string(),
      port: z.number(),
    })).optional(),
  }).default({}),
  maxRetries: z.number().default(3),
  retryDelay: z.number().default(1000),
  connectTimeout: z.number().default(10000),
  keyPrefix: z.string().default('metagpt:'),
});

export type RedisConfig = z.infer<typeof RedisConfigSchema>; 