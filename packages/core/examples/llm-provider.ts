import { VercelLLMProvider } from '../src/provider/vercel-llm';
import type { LLMProvider } from '../src/types/llm';
import { logger } from '../src/utils/logger';

/**
 * 创建通用的 LLM Provider 实例
 * @param systemPrompt 系统提示词，用于设置 AI 的角色和行为
 * @returns LLM Provider 实例
 */
export function createLLMProvider(systemPrompt: string = ''): LLMProvider {
  const provider = new VercelLLMProvider({
    providerType: 'qwen',
    apiKey: process.env.DASHSCOPE_API_KEY || 'your-api-key-here',
    model: 'qwen-plus-2025-01-25',
    baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    extraConfig: {
      qwenOptions: {
        debug: true,
        stream: true,
        max_tokens: 300,
        timeout: 60000,
        retry: 2,
      },
      generateOptions: {
        system: systemPrompt || '你是一位专业的 AI 助手，擅长简洁有效地回答问题。请用简短的方式回应，重点突出关键信息。每个回答控制在200字以内。',
        temperature: 0.3,
        top_p: 0.1,
        frequency_penalty: 1.0,
        presence_penalty: 1.0,
      }
    }
  });

  // 添加响应时间日志
  const originalChat = provider.chat.bind(provider);
  provider.chat = async (prompt: string) => {
    const startTime = Date.now();
    try {
      const response = await originalChat(prompt);
      const endTime = Date.now();
      logger.info(`[LLM] Response time: ${endTime - startTime}ms for prompt length: ${prompt.length}`);
      return response;
    } catch (error) {
      const endTime = Date.now();
      logger.error(`[LLM] Error after ${endTime - startTime}ms: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  };

  // 添加流式响应日志
  const originalChatStream = provider.chatStream.bind(provider);
  provider.chatStream = (prompt: string) => originalChatStream(prompt);

  return provider;
} 