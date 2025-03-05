/**
 * Vercel AI SDK 重试中间件
 * 为LLM调用添加自动重试功能
 */

import type { LanguageModelV1Middleware } from 'ai';

export interface RetryMiddlewareOptions {
  /**
   * 最大重试次数
   * @default 3
   */
  maxRetries?: number;
  
  /**
   * 重试延迟的基础时间（毫秒）
   * @default 1000 (1秒)
   */
  baseDelay?: number;
  
  /**
   * 重试延迟的最大时间（毫秒）
   * @default 10000 (10秒)
   */
  maxDelay?: number;
  
  /**
   * 指数退避因子，用于计算重试延迟
   * @default 2
   */
  factor?: number;
  
  /**
   * 判断错误是否可重试的函数
   * @default 默认处理网络错误、限流错误和特定API错误
   */
  retryCondition?: (error: Error) => boolean;
  
  /**
   * 重试前的回调函数
   */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * 自定义重试错误
 */
export class RetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * 默认判断错误是否可重试的函数
 * @param error 错误对象
 * @returns 是否可重试
 */
function defaultRetryCondition(error: Error): boolean {
  // 如果是网络错误或超时，可以重试
  if (
    error.message.includes('network') ||
    error.message.includes('timeout') ||
    error.message.includes('socket') ||
    error.message.includes('ECONNRESET') ||
    error.message.includes('ETIMEDOUT')
  ) {
    return true;
  }
  
  // 如果是限流错误，可以重试
  if (
    error.message.includes('rate limit') ||
    error.message.includes('too many requests') ||
    error.message.includes('429')
  ) {
    return true;
  }
  
  // 如果是服务器错误，可以重试
  if (
    error.message.includes('server error') ||
    error.message.includes('500') ||
    error.message.includes('502') ||
    error.message.includes('503') ||
    error.message.includes('504')
  ) {
    return true;
  }
  
  return false;
}

/**
 * 延迟指定时间
 * @param ms 延迟时间（毫秒）
 * @returns Promise
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 计算重试延迟时间（带抖动）
 * @param attempt 当前尝试次数
 * @param options 重试选项
 * @returns 延迟时间（毫秒）
 */
function calculateDelay(attempt: number, options: Required<RetryMiddlewareOptions>): number {
  // 基本指数退避: baseDelay * (factor ^ attempt)
  const baseDelay = options.baseDelay * Math.pow(options.factor, attempt);
  
  // 添加一些随机抖动（最大 ±30%）以避免同时重试
  const jitter = baseDelay * 0.3 * (Math.random() * 2 - 1);
  
  // 计算最终延迟时间，但不超过最大延迟
  return Math.min(options.maxDelay, baseDelay + jitter);
}

/**
 * 创建重试中间件
 * @param customOptions 自定义重试选项
 * @returns Vercel AI SDK中间件
 */
export function createRetryMiddleware(
  customOptions: RetryMiddlewareOptions = {}
): LanguageModelV1Middleware {
  const options: Required<RetryMiddlewareOptions> = {
    maxRetries: customOptions.maxRetries ?? 3,
    baseDelay: customOptions.baseDelay ?? 1000,
    maxDelay: customOptions.maxDelay ?? 10000,
    factor: customOptions.factor ?? 2,
    retryCondition: customOptions.retryCondition ?? defaultRetryCondition,
    onRetry: customOptions.onRetry ?? (() => {}),
  };

  // 通用重试逻辑
  async function retryOperation<T>(
    operation: () => Promise<T>,
    context: string = 'operation'
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        // 首次尝试或重试操作
        return await operation();
      } catch (error) {
        const typedError = error as Error;
        lastError = typedError;
        
        // 如果已经达到最大重试次数，或者错误不满足重试条件，则抛出错误
        if (
          attempt >= options.maxRetries ||
          !options.retryCondition(typedError)
        ) {
          throw typedError;
        }
        
        // 计算延迟时间并通知重试
        const delayMs = calculateDelay(attempt, options);
        options.onRetry(typedError, attempt + 1);
        
        // 等待后重试
        await delay(delayMs);
      }
    }
    
    // 这里不应该到达，但TypeScript需要一个返回值
    // 如果达到此处，抛出最后捕获的错误
    throw lastError || new RetryError(`All ${options.maxRetries} retries failed for ${context}`);
  }
  
  return {
    // 拦截常规生成
    wrapGenerate: async ({ doGenerate }) => {
      return await retryOperation(async () => doGenerate(), 'generate text');
    },

    // 仅支持通过wrapGenerate进行重试
    // 其他功能如流式输出和嵌入向量暂不直接支持
  };
} 