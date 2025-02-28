import { VercelLLMProvider } from '../../src/llms/vercel';
import type { LLMProvider } from '../../src/types/llm';

export function createTestLLMProvider(): LLMProvider {
  const apiKey = process.env.QWEN_API_KEY || 'your-api-key-here';
  
  return new VercelLLMProvider({
    providerType: 'qwen',
    apiKey,
    model: process.env.QWEN_MODEL || 'qwen-plus-2025-01-25',
    baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    extraConfig: {
      qwenOptions: {
        debug: true,
      },
      generateOptions: {
        system: '你是一位专业的助手，擅长编写高质量的代码和文档。请用简洁清晰的方式回答问题。'
      }
    }
  });
} 