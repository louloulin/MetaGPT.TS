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

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type { LLMConfig, LLMProvider } from '../types/llm';

/**
 * 支持的模型提供商类型
 */
export type ModelProviderType = 'openai' | 'qwen' | 'anthropic' | 'mistral' | 'google' | 'custom';

/**
 * 模型提供商配置
 */
export const ModelProviderConfigSchema = z.object({
  providerType: z.enum(['openai', 'qwen', 'anthropic', 'mistral', 'google', 'custom']).default('openai'),
  apiKey: z.string(),
  baseURL: z.string().optional(),
  model: z.string().optional(),
  extraConfig: z.record(z.any()).optional(),
});

export type ModelProviderConfig = z.infer<typeof ModelProviderConfigSchema>;

/**
 * 基于 Vercel AI SDK 的通用 LLM 提供商实现
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

  constructor(config: ModelProviderConfig) {
    this.config = ModelProviderConfigSchema.parse(config);
    this.setupEnvironment();
    this.loadProviderModules();
  }

  /**
   * 设置环境变量
   */
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
              console.warn('Using legacy qwen provider. For more customization options, upgrade to newer qwen-ai-provider with createQwen support.');
            }
          }).catch(err => {
            console.warn(`Failed to load qwen provider: ${err.message}. Make sure 'qwen-ai-provider' is installed.`);
          });
          break;
        case 'anthropic':
          import('@ai-sdk/anthropic').then(module => {
            this.providerFunctions.anthropic = module.anthropic;
          }).catch(err => {
            console.warn(`Failed to load anthropic provider: ${err.message}. Make sure '@ai-sdk/anthropic' is installed.`);
          });
          break;
        case 'mistral':
          import('@ai-sdk/mistral').then(module => {
            this.providerFunctions.mistral = module.mistral;
          }).catch(err => {
            console.warn(`Failed to load mistral provider: ${err.message}. Make sure '@ai-sdk/mistral' is installed.`);
          });
          break;
        case 'google':
          import('@ai-sdk/google').then(module => {
            this.providerFunctions.google = module.google;
          }).catch(err => {
            console.warn(`Failed to load google provider: ${err.message}. Make sure '@ai-sdk/google' is installed.`);
          });
          break;
        case 'custom':
          // 自定义提供商需要在extraConfig中提供modelFunction
          if (this.config.extraConfig?.modelFunction) {
            this.providerFunctions.custom = this.config.extraConfig.modelFunction;
          } else {
            console.warn('Custom provider specified but no modelFunction provided in extraConfig');
          }
          break;
      }
    } catch (error) {
      console.error('Error loading provider modules:', error);
    }
  }

  /**
   * 获取当前提供商的模型函数
   * @param modelName 模型名称
   * @returns 模型函数调用结果
   */
  private getModelFunction(modelName?: string): any {
    const provider = this.providerFunctions[this.config.providerType];
    if (!provider) {
      throw new Error(`Provider ${this.config.providerType} not loaded or not available`);
    }
    
    return provider(modelName || this.config.model || this.getDefaultModel());
  }

  /**
   * 获取提供商的默认模型
   */
  private getDefaultModel(): string {
    switch (this.config.providerType) {
      case 'openai':
        return 'gpt-3.5-turbo';
      case 'qwen':
        return 'qwen-plus';
      case 'anthropic':
        return 'claude-3-sonnet-20240229';
      case 'mistral':
        return 'mistral-large-latest';
      case 'google':
        return 'gemini-pro';
      case 'custom':
        return this.config.extraConfig?.defaultModel || 'default-model';
      default:
        return 'gpt-3.5-turbo';
    }
  }

  /**
   * 生成文本
   * @param prompt 提示词
   * @param config 配置选项
   * @returns 生成的文本
   */
  async generate(prompt: string, config?: Partial<LLMConfig>): Promise<string> {
    try {
      // 确保提供商模块已加载完成
      if (this.config.providerType !== 'openai' && !this.providerFunctions[this.config.providerType]) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待动态导入完成
      }

      // @ts-ignore - Type compatibility issue between different versions of AI SDK
      const model = this.getModelFunction(config?.model);
      
      // 导入generateText函数
      const { generateText } = await import('ai');
      
      // 准备配置选项
      const generateOptions: any = {
        model,
        prompt,
        temperature: config?.temperature,
        maxTokens: config?.maxTokens,
        topP: config?.topP,
        frequencyPenalty: config?.frequencyPenalty,
        presencePenalty: config?.presencePenalty,
        ...this.config.extraConfig?.generateOptions,
      };
      
      // 如果有系统提示，添加到配置中
      if (this.systemPrompt && !generateOptions.system) {
        generateOptions.system = this.systemPrompt;
      }
      
      const result = await generateText(generateOptions);

      return result.text;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 生成文本流
   * @param prompt 提示词
   * @param config 配置选项
   * @returns 生成的文本流
   */
  async *generateStream(prompt: string, config?: Partial<LLMConfig>): AsyncGenerator<string> {
    try {
      // 确保提供商模块已加载完成
      if (this.config.providerType !== 'openai' && !this.providerFunctions[this.config.providerType]) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待动态导入完成
      }

      // @ts-ignore - Type compatibility issue between different versions of AI SDK
      const model = this.getModelFunction(config?.model);
      
      // 导入streamText函数
      const { streamText } = await import('ai');
      
      // 准备配置选项
      const streamOptions: any = {
        model,
        prompt,
        temperature: config?.temperature,
        maxTokens: config?.maxTokens,
        topP: config?.topP,
        frequencyPenalty: config?.frequencyPenalty,
        presencePenalty: config?.presencePenalty,
        ...this.config.extraConfig?.generateOptions,
      };
      
      // 如果有系统提示，添加到配置中
      if (this.systemPrompt && !streamOptions.system) {
        streamOptions.system = this.systemPrompt;
      }
      
      // 创建流式响应
      const streamResult = await streamText(streamOptions);
      
      // 获取文本流
      const textStream = streamResult.textStream;
      
      // 逐个返回流式响应的文本块
      for await (const chunk of textStream) {
        yield chunk;
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Chat with the LLM using streaming
   * @param message - Message to send
   * @returns LLM response stream
   */
  async *chatStream(message: string): AsyncGenerator<string> {
    try {
      // 导入streamText函数
      const { streamText } = await import('ai');
      
      // 确保提供商模块已加载完成
      if (this.config.providerType !== 'openai' && !this.providerFunctions[this.config.providerType]) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待动态导入完成
      }
      
      // @ts-ignore - Type compatibility issue between different versions of AI SDK
      const model = this.getModelFunction();
      
      // 准备配置选项
      const streamOptions: any = {
        model,
        prompt: message,
        ...this.config.extraConfig?.generateOptions,
      };
      
      // 如果有系统提示，添加到配置中
      if (this.systemPrompt && !streamOptions.system) {
        streamOptions.system = this.systemPrompt;
      }
      
      // 创建流式响应
      const streamResult = await streamText(streamOptions);
      
      // 获取文本流
      const textStream = streamResult.textStream;
      
      // 逐个返回流式响应的文本块
      for await (const chunk of textStream) {
        yield chunk;
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 嵌入文本
   * @param text 要嵌入的文本
   * @returns 嵌入向量
   */
  async embed(text: string): Promise<number[]> {
    try {
      // Note: For embeddings in the newer Vercel AI SDK, we'd typically use:
      // import { generateEmbedding } from 'ai/embedding';
      
      // This is a temporary implementation - in a real application,
      // you would implement this based on the AI SDK's embedding functionality
      console.warn(`Embedding functionality not yet implemented for ${this.config.providerType} provider`);
      
      // Placeholder implementation
      return new Array(1536).fill(0).map(() => Math.random());
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 错误处理
   * @param error 原始错误
   * @returns 标准化的错误
   */
  private handleError(error: unknown): Error {
    console.error(`${this.config.providerType} provider error:`, error);
    if (error instanceof Error) {
      return error;
    }
    return new Error(`Unknown ${this.config.providerType} provider error`);
  }

  /**
   * Chat with the LLM
   * @param message - Message to send
   * @returns LLM response
   */
  async chat(message: string): Promise<string> {
    try {
      // 导入generateText函数
      const { generateText } = await import('ai');
      
      // 确保提供商模块已加载完成
      if (this.config.providerType !== 'openai' && !this.providerFunctions[this.config.providerType]) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待动态导入完成
      }
      
      // @ts-ignore - Type compatibility issue between different versions of AI SDK
      const model = this.getModelFunction();
      
      // 准备配置选项
      const chatOptions: any = {
        model,
        prompt: message,
        ...this.config.extraConfig?.generateOptions,
      };
      
      // 如果有系统提示，添加到配置中
      if (this.systemPrompt && !chatOptions.system) {
        chatOptions.system = this.systemPrompt;
      }
      
      const result = await generateText(chatOptions);
      
      return result.text;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Set the system prompt
   * @param prompt - System prompt to set
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Get the current system prompt
   * @returns Current system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Get the name of the LLM provider
   * @returns Provider name
   */
  getName(): string {
    return this.config.providerType;
  }

  /**
   * Get the model being used
   * @returns Model name
   */
  getModel(): string {
    return this.config.model || this.getDefaultModel();
  }
} 