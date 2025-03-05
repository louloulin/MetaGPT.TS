/**
 * @module Config
 * @category Core
 */

import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import { merge } from 'lodash';
import { LLMType, LLMConfigSchema } from './llm';
import type { LLMConfig } from './llm';
import type { EmbeddingConfig } from './embedding';
import { EmbeddingConfigSchema } from './embedding';
import type { OmniParseConfig } from './omniparse';
import { OmniParseConfigSchema } from './omniparse';
import type { SearchConfig } from './search';
import { SearchConfigSchema } from './search';
import type { BrowserConfig } from './browser';
import { BrowserConfigSchema } from './browser';
import type { MermaidConfig } from './mermaid';
import { MermaidConfigSchema } from './mermaid';
import type { S3Config } from './s3';
import { S3ConfigSchema } from './s3';
import type { RedisConfig } from './redis';
import { RedisConfigSchema } from './redis';
import type { WorkspaceConfig } from './workspace';
import { WorkspaceConfigSchema } from './workspace';
import { YamlModel } from '../utils/yaml';

/**
 * CLI parameters schema
 */
export const CLIParamsSchema = z.object({
  projectPath: z.string().default(''),
  projectName: z.string().default(''),
  inc: z.boolean().default(false),
  reqaFile: z.string().default(''),
  maxAutoSummarizeCode: z.number().default(0),
  gitReinit: z.boolean().default(false),
}).transform((data) => {
  if (data.projectPath) {
    data.inc = true;
    data.projectName = data.projectName || path.basename(data.projectPath);
  }
  return data;
});

/**
 * Main configuration schema for MetaGPT
 */
export const ConfigSchema = z.object({
  // CLI Parameters
  projectPath: z.string().default(''),
  projectName: z.string().default(''),
  inc: z.boolean().default(false),
  reqaFile: z.string().default(''),
  maxAutoSummarizeCode: z.number().default(0),
  gitReinit: z.boolean().default(false),

  // Key Parameters
  llm: LLMConfigSchema.default({
    apiType: LLMType.OPENAI,
    apiKey: '',
    model: 'gpt-4',
    maxTokens: 4096,
    temperature: 0.7,
    topP: 1,
    n: 1,
    presencePenalty: 0,
    frequencyPenalty: 0,
    maxRetries: 3,
    timeout: 60000,
  }),

  // RAG Embedding
  embedding: EmbeddingConfigSchema.default({}),

  // Omniparse
  omniparse: OmniParseConfigSchema.default({}),

  // Global Proxy
  proxy: z.string().default(''),

  // Tool Parameters
  search: SearchConfigSchema.default({}),
  browser: BrowserConfigSchema.default({}),
  mermaid: MermaidConfigSchema.default({}),

  // Storage Parameters
  s3: S3ConfigSchema.optional(),
  redis: RedisConfigSchema.optional(),

  // Misc Parameters
  repairLlmOutput: z.boolean().default(false),
  promptSchema: z.enum(['json', 'markdown', 'raw']).default('json'),
  workspace: WorkspaceConfigSchema.default({}),
  enableLongtermMemory: z.boolean().default(false),
  codeReviewKTimes: z.number().default(2),
  agentopsApiKey: z.string().default(''),

  // Legacy Parameters (to be removed)
  metagptTtiUrl: z.string().default(''),
  language: z.string().default('English'),
  redisKey: z.string().default('placeholder'),
  iflytekAppId: z.string().default(''),
  iflytekApiSecret: z.string().default(''),
  iflytekApiKey: z.string().default(''),
  azureTtsSubscriptionKey: z.string().default(''),
  azureTtsRegion: z.string().default(''),
  extra: z.record(z.any()).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration manager class for MetaGPT
 */
export class ConfigManager {
  private config: Config;
  private static instance: ConfigManager;

  private constructor(config: Config) {
    this.config = config;
  }

  /**
   * Get singleton instance of ConfigManager
   */
  public static getInstance(options: { configPath?: string; loadEnv?: boolean; useDefaults?: boolean } = {}): ConfigManager {
    if (!ConfigManager.instance) {
      const config = ConfigSchema.parse({});
      ConfigManager.instance = new ConfigManager(config);
      
      if (options.loadEnv) {
        ConfigManager.instance.updateConfig(process.env as Partial<Config>);
      }
      
      if (options.configPath) {
        try {
          const content = readFileSync(options.configPath, 'utf-8');
          const fileConfig = YamlModel.parse(content) as Partial<Config>;
          ConfigManager.instance.updateConfig(fileConfig);
        } catch (e) {
          // Ignore file read errors
        }
      }
    }
    return ConfigManager.instance;
  }

  /**
   * Get current configuration
   */
  public getConfig(): Config {
    return this.config;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<Config>): void {
    this.config = ConfigSchema.parse({
      ...this.config,
      ...config,
    });
  }

  /**
   * Load configuration from home directory
   */
  public static async fromHome(configPath: string): Promise<ConfigManager | null> {
    const homePath = process.env.HOME || process.env.USERPROFILE;
    if (!homePath) return null;

    const configFile = path.join(homePath, '.metagpt', configPath);
    try {
      const content = await fs.readFile(configFile, 'utf-8');
      const config = YamlModel.parse(content);
      return new ConfigManager(ConfigSchema.parse(config));
    } catch {
      return null;
    }
  }

  /**
   * Load default configuration
   */
  public static async default(): Promise<ConfigManager> {
    const defaultPaths = [
      path.join(process.cwd(), 'config/config.yaml'),
      path.join(process.env.HOME || '', '.metagpt/config.yaml'),
    ];

    const configs = [process.env];
    for (const configPath of defaultPaths) {
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        configs.push(YamlModel.parse(content));
      } catch {
        continue;
      }
    }

    const mergedConfig = merge({}, ...configs);
    return new ConfigManager(ConfigSchema.parse(mergedConfig));
  }

  /**
   * Create configuration from LLM config
   */
  public static fromLLMConfig(llmConfig: Partial<LLMConfig>): ConfigManager {
    const config = merge({}, process.env, { llm: llmConfig });
    return new ConfigManager(ConfigSchema.parse(config));
  }

  /**
   * Create configuration from environment variables
   */
  public static fromEnvironment(): ConfigManager {
    const envConfig: Partial<Config> = {};
    
    // Parse OpenAI configuration from environment
    if (process.env.OPENAI_API_KEY) {
      envConfig.llm = {
        apiType: LLMType.OPENAI,
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4',
        maxTokens: 4096,
        temperature: 0.7,
        topP: 1,
        n: 1,
        presencePenalty: 0,
        frequencyPenalty: 0,
        maxRetries: 3,
        timeout: 60000,
      };
    }
    
    // Parse Azure configuration from environment
    if (process.env.AZURE_API_KEY) {
      envConfig.llm = {
        apiType: LLMType.AZURE,
        apiKey: process.env.AZURE_API_KEY || '',
        model: process.env.AZURE_MODEL || 'gpt-4',
        maxTokens: 4096,
        temperature: 0.7,
        topP: 1,
        n: 1,
        presencePenalty: 0,
        frequencyPenalty: 0,
        maxRetries: 3,
        timeout: 60000,
        endpoint: process.env.AZURE_ENDPOINT,
        apiVersion: process.env.AZURE_API_VERSION,
        deploymentName: process.env.AZURE_DEPLOYMENT_NAME,
      };
    }
    
    // Parse proxy configuration
    if (process.env.METAGPT_PROXY) {
      envConfig.proxy = process.env.METAGPT_PROXY;
    }
    
    // Parse other common environment variables
    if (process.env.METAGPT_PROJECT_PATH) {
      envConfig.projectPath = process.env.METAGPT_PROJECT_PATH;
    }
    
    if (process.env.METAGPT_PROJECT_NAME) {
      envConfig.projectName = process.env.METAGPT_PROJECT_NAME;
    }
    
    return new ConfigManager(ConfigSchema.parse(envConfig));
  }

  /**
   * Merge configurations according to priority
   */
  public static async mergeConfigs(fileConfig: ConfigManager, cliConfig: Partial<Config>): Promise<ConfigManager> {
    // Priority: CLI > File config > Environment variables
    const envConfig = ConfigManager.fromEnvironment();
    
    // Merge in order of priority
    const mergedConfig = merge(
      {}, 
      envConfig.getConfig(), 
      fileConfig.getConfig(), 
      cliConfig as Record<string, unknown>
    );
    
    return new ConfigManager(ConfigSchema.parse(mergedConfig));
  }

  /**
   * Update configuration via CLI parameters
   */
  public updateViaCLI(params: Partial<z.infer<typeof CLIParamsSchema>>): void {
    const { projectPath, projectName, inc, reqaFile, maxAutoSummarizeCode } = params;
    
    this.config = ConfigSchema.parse({
      ...this.config,
      projectPath,
      projectName: projectName || (projectPath ? path.basename(projectPath) : ''),
      inc: inc || !!projectPath,
      reqaFile,
      maxAutoSummarizeCode,
    });
  }

  /**
   * Get OpenAI LLM configuration
   */
  public getOpenAILLM(): LLMConfig | null {
    return this.config.llm.apiType === LLMType.OPENAI ? this.config.llm as LLMConfig : null;
  }

  /**
   * Get Azure LLM configuration
   */
  public getAzureLLM(): LLMConfig | null {
    return this.config.llm.apiType === LLMType.AZURE ? this.config.llm as LLMConfig : null;
  }

  /**
   * Get extra configuration
   */
  public get extra(): Record<string, any> {
    return this.config.extra as Record<string, any>;
  }

  /**
   * Set extra configuration
   */
  public set extra(value: Record<string, any>) {
    this.config.extra = value;
  }
}

/**
 * Get default configuration instance
 */
export async function getConfig(): Promise<ConfigManager> {
  return ConfigManager.default();
} 