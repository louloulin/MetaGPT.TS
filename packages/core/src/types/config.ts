/**
 * @module Config
 * @category Core
 */

import { z } from 'zod';
import type { LLMConfig } from './llm';

/**
 * CLI parameters configuration schema
 * Defines command line interface parameters for the application
 */
export const CLIParamsSchema = z.object({
  /** Project directory path */
  projectPath: z.string().default(''),
  /** Project name */
  projectName: z.string().default(''),
  /** Whether to use incremental mode */
  inc: z.boolean().default(false),
  /** Path to requirements file */
  reqaFile: z.string().default(''),
  /** Maximum number of auto code summarizations */
  maxAutoSummarizeCode: z.number().default(0),
  /** Whether to reinitialize Git */
  gitReinit: z.boolean().default(false),
});

export type CLIParams = z.infer<typeof CLIParamsSchema>;

/**
 * LLM configuration schema
 * Defines settings for language model operations
 */
export const LLMConfigSchema = z.object({
  /** API type (e.g., 'openai', 'azure') */
  apiType: z.string(),
  /** API key for authentication */
  apiKey: z.string(),
  /** Model name */
  model: z.string(),
  /** Maximum tokens to generate */
  maxTokens: z.number().default(4096),
  /** Temperature for sampling */
  temperature: z.number().min(0).max(2).default(0.7),
  /** Top P for nucleus sampling */
  topP: z.number().min(0).max(1).default(1),
  /** Number of completions to generate */
  n: z.number().int().positive().default(1),
  /** Presence penalty */
  presencePenalty: z.number().default(0),
  /** Frequency penalty */
  frequencyPenalty: z.number().default(0),
  /** Maximum retries on failure */
  maxRetries: z.number().int().nonnegative().default(3),
  /** Request timeout in milliseconds */
  timeout: z.number().int().positive().default(60000),
});

/**
 * Embedding configuration schema
 * Defines settings for text embedding operations
 */
export const EmbeddingConfigSchema = z.object({
  /** API type (e.g., 'openai') */
  apiType: z.string().default('openai'),
  /** API key for authentication */
  apiKey: z.string().optional(),
  /** Model name for embeddings */
  model: z.string().default('text-embedding-ada-002'),
  /** Proxy URL if needed */
  proxy: z.string().optional(),
  /** Batch size for embedding operations */
  batchSize: z.number().int().positive().default(512),
});

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

/**
 * Workspace configuration schema
 * Defines settings for the application workspace
 */
export const WorkspaceConfigSchema = z.object({
  /** Root directory for workspace */
  root: z.string().default('./workspace'),
  /** Whether to automatically clean workspace */
  autoClean: z.boolean().default(false),
  /** Path for storage */
  storagePath: z.string().default('./storage'),
});

export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

/**
 * Search configuration schema
 * Defines settings for search operations
 */
export const SearchConfigSchema = z.object({
  /** Search engine to use */
  engine: z.string().default('google'),
  /** API key for search engine */
  apiKey: z.string().optional(),
  /** Proxy URL if needed */
  proxy: z.string().optional(),
  /** Maximum results per search */
  maxResults: z.number().int().positive().default(10),
});

export type SearchConfig = z.infer<typeof SearchConfigSchema>;

/**
 * Main configuration schema
 * Combines all configuration schemas into one comprehensive configuration
 */
export const ConfigSchema = CLIParamsSchema.extend({
  /** LLM provider configuration */
  llm: LLMConfigSchema.partial().default({}),
  /** Embedding configuration */
  embedding: EmbeddingConfigSchema.default({}),
  /** Global proxy URL */
  proxy: z.string().default(''),
  /** Search configuration */
  search: SearchConfigSchema.default({}),
  /** Workspace configuration */
  workspace: WorkspaceConfigSchema.default({}),
  /** Whether to enable long-term memory */
  enableLongtermMemory: z.boolean().default(false),
  /** Number of code review iterations */
  codeReviewKTimes: z.number().int().positive().default(2),
  /** Interface language */
  language: z.string().default('English'),
  /** Additional configuration options */
  extra: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
}).strict();

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration source type
 * Defines possible sources for configuration values
 */
export type ConfigSource = 'env' | 'file' | 'default' | 'cli';

/**
 * Configuration loading options schema
 * Defines options for loading configuration
 */
export const ConfigOptionsSchema = z.object({
  /** Path to configuration file */
  configPath: z.string().optional(),
  /** Whether to load from environment variables */
  loadEnv: z.boolean().default(true),
  /** Whether to use default values */
  useDefaults: z.boolean().default(true),
  /** Priority order for configuration sources */
  sourcePriority: z.array(z.enum(['env', 'file', 'default', 'cli'])).default(['cli', 'env', 'file', 'default']),
});

export type ConfigOptions = z.infer<typeof ConfigOptionsSchema>; 