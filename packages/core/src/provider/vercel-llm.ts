/**
 * 使用示例:
 * 
 * ```typescript
 * // 使用 qwen-plus 模型示例
 * import { VercelLLMProvider } from './vercel-llm';
 * import { generateText } from 'ai';
 * 
 * async function main() {
 *   // 初始化 Qwen 提供商
 *   const qwenProvider = new VercelLLMProvider({
 *     providerType: 'qwen',
 *     apiKey: process.env.DASHSCOPE_API_KEY || 'your-qwen-api-key',
 *     model: 'qwen-plus',
 *     baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', // 可选，自定义URL
 *     extraConfig: {
 *       qwenOptions: {
 *         // 其他Qwen配置选项
 *       }
 *     }
 *   });
 *   
 *   // 使用 qwen-plus 生成文本
 *   const result = await qwenProvider.generate(
 *     '写一个4人份的素食千层面食谱。',
 *     { temperature: 0.7 }
 *   );
 *   
 *   console.log(result);
 *   
 *   // 或者直接使用 Vercel AI SDK
 *   // 需要先安装: bun add qwen-ai-provider
 *   // import { createQwen } from 'qwen-ai-provider';
 *   // const qwen = createQwen({ baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' });
 *   // const { text } = await generateText({
 *   //   model: qwen('qwen-plus'),
 *   //   prompt: '写一个4人份的素食千层面食谱。',
 *   // });
 *   // console.log(text);
 * }
 * ```
 */

import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type { LLMConfig, LLMProvider } from '../types/llm';
import { createRetryMiddleware } from './vercel-retry-middleware';
import type { RetryMiddlewareOptions } from './vercel-retry-middleware';
import winston from 'winston';

// 设置记录器
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
  ]
});

/**
 * 支持的模型提供商类型
 */
export type ModelProviderType = 'openai' | 'qwen' | 'anthropic' | 'mistral' | 'google' | 'custom';

/**
 * 提供商配置模式
 */
export const ModelProviderConfigSchema = z.object({
  providerType: z.enum(['openai', 'qwen', 'anthropic', 'mistral', 'google', 'custom']),
  apiKey: z.string(),
  model: z.string().optional(),
  baseURL: z.string().optional(),
  extraConfig: z.record(z.any()).optional(),
  retryOptions: z.object({
    maxRetries: z.number().optional(),
    baseDelay: z.number().optional(),
    maxDelay: z.number().optional(),
    factor: z.number().optional(),
  }).optional(),
});

/**
 * LLM配置扩展类型，用于支持额外配置
 */
interface ExtendedLLMConfig extends LLMConfig {
  extraConfig?: {
    abortSignal?: AbortSignal;
    [key: string]: any;
  };
}

export type ModelProviderConfig = z.infer<typeof ModelProviderConfigSchema>;

/**
 * Vercel LLM 提供者实现
 */
export class VercelLLMProvider implements LLMProvider {
  private config: ModelProviderConfig;
  private systemPrompt: string = '';
  private providerFunctions: Record<ModelProviderType, any> = {
    openai: openai,
    qwen: null,
    anthropic: null,
    mistral: null,
    google: null,
    custom: null,
  };
  private retryMiddleware: ReturnType<typeof createRetryMiddleware>;
  
  /**
   * 构造函数
   * @param config 提供商配置
   */
  constructor(config: ModelProviderConfig) {
    this.config = ModelProviderConfigSchema.parse(config);
    this.setupEnvironment();
    this.loadProviderModules();
    
    // 初始化重试中间件
    const retryOptions: RetryMiddlewareOptions = {
      maxRetries: this.config.retryOptions?.maxRetries ?? 3,
      baseDelay: this.config.retryOptions?.baseDelay ?? 1000,
      maxDelay: this.config.retryOptions?.maxDelay ?? 10000,
      factor: this.config.retryOptions?.factor ?? 2,
      onRetry: (error, attempt) => {
        logger.warn(`Retrying LLM call (${attempt}/${this.config.retryOptions?.maxRetries ?? 3}) due to: ${error.message}`);
      }
    };
    
    this.retryMiddleware = createRetryMiddleware(retryOptions);
  }

  private setupEnvironment(): void {
    // 根据不同提供商设置对应的环境变量
    switch (this.config.providerType) {
      case 'openai':
        if (process.env.OPENAI_API_KEY !== this.config.apiKey) {
          process.env.OPENAI_API_KEY = this.config.apiKey;
        }
        if (this.config.baseURL) {
          process.env.OPENAI_API_HOST = this.config.baseURL;
        }
        break;
      case 'qwen':
        if (process.env.DASHSCOPE_API_KEY !== this.config.apiKey) {
          process.env.DASHSCOPE_API_KEY = this.config.apiKey;
        }
        // 注意: baseURL会在createQwen时设置，不需要设置环境变量
        break;
      case 'anthropic':
        if (process.env.ANTHROPIC_API_KEY !== this.config.apiKey) {
          process.env.ANTHROPIC_API_KEY = this.config.apiKey;
        }
        if (this.config.baseURL) {
          process.env.ANTHROPIC_API_URL = this.config.baseURL;
        }
        break;
      case 'mistral':
        if (process.env.MISTRAL_API_KEY !== this.config.apiKey) {
          process.env.MISTRAL_API_KEY = this.config.apiKey;
        }
        if (this.config.baseURL) {
          process.env.MISTRAL_API_URL = this.config.baseURL;
        }
        break;
      case 'google':
        if (process.env.GOOGLE_API_KEY !== this.config.apiKey) {
          process.env.GOOGLE_API_KEY = this.config.apiKey;
        }
        if (this.config.baseURL) {
          process.env.GOOGLE_API_URL = this.config.baseURL;
        }
        break;
      // 其他提供商的环境变量设置...
      default:
        // 自定义提供商可能需要在extraConfig中指定环境变量
        if (this.config.extraConfig?.environmentVars) {
          const envVars = this.config.extraConfig.environmentVars as Record<string, string>;
          for (const [key, value] of Object.entries(envVars)) {
            process.env[key] = value;
          }
        }
    }
  }

  /**
   * 动态加载提供商模块
   */
  private loadProviderModules(): void {
    try {
      // 根据配置动态加载需要的提供商模块
      switch (this.config.providerType) {
        case 'qwen':
          // 动态导入提供商，避免在不需要时加载所有依赖
          import('qwen-ai-provider').then(module => {
            // 使用createQwen创建自定义配置的qwen提供商
            const createQwen = module.createQwen;
            if (createQwen) {
              // 准备Qwen配置选项
              const qwenOptions: Record<string, any> = {
                ...(this.config.extraConfig?.qwenOptions || {})
              };
              
              // 如果提供了baseURL，添加到配置中
              if (this.config.baseURL) {
                qwenOptions.baseURL = this.config.baseURL;
              }
              
              // 创建并存储qwen提供商函数
              this.providerFunctions.qwen = createQwen(qwenOptions);
            } else {
              // 回退到传统方式
              this.providerFunctions.qwen = module.qwen;
              logger.warn('Using legacy qwen provider. For more customization options, upgrade to newer qwen-ai-provider with createQwen support.');
            }
          }).catch(err => {
            logger.warn(`Failed to load qwen provider: ${err.message}. Make sure 'qwen-ai-provider' is installed.`);
          });
          break;
        case 'anthropic':
          import('@ai-sdk/anthropic').then(module => {
            this.providerFunctions.anthropic = module.anthropic;
          }).catch(err => {
            logger.warn(`Failed to load anthropic provider: ${err.message}. Make sure '@ai-sdk/anthropic' is installed.`);
          });
          break;
        case 'mistral':
          import('@ai-sdk/mistral').then(module => {
            this.providerFunctions.mistral = module.mistral;
          }).catch(err => {
            logger.warn(`Failed to load mistral provider: ${err.message}. Make sure '@ai-sdk/mistral' is installed.`);
          });
          break;
        case 'google':
          import('@ai-sdk/google').then(module => {
            this.providerFunctions.google = module.google;
          }).catch(err => {
            logger.warn(`Failed to load google provider: ${err.message}. Make sure '@ai-sdk/google' is installed.`);
          });
          break;
        case 'custom':
          // 自定义提供商需要在extraConfig中提供modelFunction
          if (this.config.extraConfig?.modelFunction) {
            this.providerFunctions.custom = this.config.extraConfig.modelFunction;
          } else {
            logger.warn('Custom provider specified but no modelFunction provided in extraConfig');
          }
          break;
      }
    } catch (error) {
      logger.error('Error loading provider modules:', error);
    }
  }

  /**
   * 获取当前提供商的模型函数
   * @param modelName 模型名称
   * @returns 模型函数调用结果
   */
  private getModelFunction(modelName?: string): any {
    const providerFunction = this.providerFunctions[this.config.providerType];
    
    if (!providerFunction) {
      throw new Error(`Provider function for ${this.config.providerType} not loaded. Check if the required package is installed.`);
    }
    
    // 使用指定的模型名称或默认模型
    const model = modelName || this.getDefaultModel();
    
    // 调用提供商函数获取特定模型
    return providerFunction(model);
  }

  /**
   * 获取默认的模型名称
   * @returns 默认模型名称
   */
  private getDefaultModel(): string {
    // 如果配置中指定了模型，则使用配置中的模型
    if (this.config.model) {
      return this.config.model;
    }
    
    // 否则根据提供商类型返回默认模型
    switch (this.config.providerType) {
      case 'openai':
        return 'gpt-3.5-turbo';
      case 'qwen':
        return 'qwen-plus';
      case 'anthropic':
        return 'claude-3-sonnet-20240229';
      case 'mistral':
        return 'mistral-small-latest';
      case 'google':
        return 'gemini-pro';
      case 'custom':
        // 自定义提供商应在extraConfig中提供默认模型
        return this.config.extraConfig?.defaultModel || 'default';
      default:
        return 'gpt-3.5-turbo';
    }
  }

  /**
   * 生成文本
   * @param prompt 提示词
   * @param config 可选配置
   * @returns 生成的文本
   */
  async generate(prompt: string, config?: Partial<ExtendedLLMConfig>): Promise<string> {
    try {
      logger.debug(`Generating text with ${this.config.providerType}/${config?.model || this.getDefaultModel()}`);
      
      // 确保提供商模块已加载完成
      if (this.config.providerType !== 'openai' && !this.providerFunctions[this.config.providerType]) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待动态导入完成
      }
      
      // 获取模型函数
      const model = this.getModelFunction(config?.model);
      
      // 准备配置选项
      const generateOptions: any = {
        model,
        prompt,
        temperature: config?.temperature,
        maxTokens: config?.maxTokens,
        topP: config?.topP,
        frequencyPenalty: config?.frequencyPenalty,
        presencePenalty: config?.presencePenalty,
        headers: this.config.extraConfig?.headers || {},
        middleware: [this.retryMiddleware],
        ...this.config.extraConfig?.generateOptions,
      };
      
      // 如果有系统提示，添加到配置中
      if (this.systemPrompt && !generateOptions.system) {
        generateOptions.system = this.systemPrompt;
      }
      
      // 调用AI SDK生成文本
      const result = await generateText(generateOptions);
      
      return result.text;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 生成文本流
   * @param prompt 提示词
   * @param config 可选配置
   * @returns 文本流
   */
  async *generateStream(prompt: string, config?: Partial<ExtendedLLMConfig>): AsyncGenerator<string> {
    try {
      logger.debug(`Streaming text with ${this.config.providerType}/${config?.model || this.getDefaultModel()}`);
      
      // 确保提供商模块已加载完成
      if (this.config.providerType !== 'openai' && !this.providerFunctions[this.config.providerType]) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待动态导入完成
      }

      // 获取模型函数
      const model = this.getModelFunction(config?.model);
      
      // 准备配置选项
      const streamOptions: any = {
        model,
        prompt,
        temperature: config?.temperature,
        maxTokens: config?.maxTokens,
        topP: config?.topP,
        frequencyPenalty: config?.frequencyPenalty,
        presencePenalty: config?.presencePenalty,
        headers: this.config.extraConfig?.headers || {},
        abortSignal: config?.extraConfig?.abortSignal, // 支持中断请求
        ...this.config.extraConfig?.generateOptions,
      };
      
      // 如果有系统提示，添加到配置中
      if (this.systemPrompt && !streamOptions.system) {
        streamOptions.system = this.systemPrompt;
      }
      
      // 创建流式响应并支持错误处理
      let streamResult;
      try {
        streamResult = await streamText(streamOptions);
      } catch (error) {
        throw this.handleError(error);
      }
      
      // 使用fullStream以支持处理流中的错误事件
      const fullStream = streamResult.fullStream;
      
      // 逐个返回流式响应的文本块或处理错误
      for await (const part of fullStream) {
        if (part.type === 'error') {
          throw part.error;
        } else if (part.type === 'text-delta') {
          yield part.textDelta;
        }
      }
    } catch (error) {
      // 在流处理过程中发生错误时抛出
      throw this.handleError(error);
    }
  }

  /**
   * 聊天流式返回
   * @param message 消息
   * @returns LLM响应流
   */
  async *chatStream(message: string): AsyncGenerator<string> {
    try {
      // 调用生成文本流
      for await (const chunk of this.generateStream(message)) {
        yield chunk;
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 生成文本嵌入向量
   * @param text 输入文本
   * @returns 嵌入向量
   */
  async embed(text: string): Promise<number[]> {
    try {
      // 目前仅支持OpenAI和某些特定提供商的嵌入功能
      if (this.config.providerType !== 'openai' && !this.config.extraConfig?.embeddingFunction) {
        throw new Error(`Embedding not supported for provider: ${this.config.providerType}`);
      }
      
      // 使用OpenAI或自定义嵌入函数
      if (this.config.providerType === 'openai') {
        // 动态导入所需模块
        const { openai } = await import('@ai-sdk/openai');
        
        try {
          // 尝试使用generateEmbedding API (新版本)
          const ai = await import('ai');
          if ('generateEmbedding' in ai) {
            // 使用类型断言解决类型问题
            const generateEmbedding = ai.generateEmbedding as any;
            const embeddingResult = await generateEmbedding({
              model: openai('text-embedding-3-small'),
              text,
              middleware: [this.retryMiddleware],
            });
            return embeddingResult.embedding;
          }
        } catch (error) {
          logger.warn('Failed to use generateEmbedding API, falling back to custom implementation');
        }
        
        // 旧版本或自定义实现
        // TODO: 实现OpenAI嵌入功能的备用方案
        throw new Error('Advanced embedding API not available. Please upgrade AI SDK.');
      } else if (this.config.extraConfig?.embeddingFunction) {
        // 使用自定义嵌入函数
        return await this.config.extraConfig.embeddingFunction(text);
      }
      
      throw new Error(`Embedding function not available for provider: ${this.config.providerType}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 处理错误
   * @param error 错误对象
   * @returns 格式化的错误
   */
  private handleError(error: unknown): never {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error';
      
    logger.error(`${this.config.providerType} provider error: ${errorMessage}`, error);
    
    if (error instanceof Error) {
      // 保留原始错误栈跟踪
      throw error;
    }
    
    throw new Error(`${this.config.providerType} provider error: ${errorMessage}`);
  }

  /**
   * 聊天
   * @param message 消息
   * @returns LLM响应
   */
  async chat(message: string): Promise<string> {
    try {
      // 使用generate方法实现chat功能
      return await this.generate(message);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 设置系统提示
   * @param prompt 系统提示
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * 获取系统提示
   * @returns 系统提示
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * 获取提供商名称
   * @returns 提供商名称
   */
  getName(): string {
    return this.config.providerType;
  }

  /**
   * 获取模型名称
   * @returns 模型名称
   */
  getModel(): string {
    return this.config.model || this.getDefaultModel();
  }
} 