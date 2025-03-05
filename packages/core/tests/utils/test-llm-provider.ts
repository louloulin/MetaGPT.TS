import { VercelLLMProvider } from '../../src/provider/vercel-llm';
import type { LLMProvider } from '../../src/types/llm';
import { logger } from '../../src/utils/logger';

export function createTestLLMProvider(): LLMProvider {
  const apiKey = process.env.QWEN_API_KEY || 'sk-bc977c4e31e542f1a34159cb42478198';
  
  const provider = new VercelLLMProvider({
    providerType: 'qwen',
    apiKey,
    model: process.env.QWEN_MODEL || 'qwen-plus',
    baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    extraConfig: {
      qwenOptions: {
        debug: true,
        stream: true,
        max_tokens: 300,  // 增加token限制以确保完整响应
        timeout: 60000,   // 设置60秒超时
        retry: 2,         // 添加重试次数
      },
      generateOptions: {
        system: '你是一位专业的教育专家，擅长简洁有效地回答教育相关问题。请用简短的方式回应，重点突出关键信息。每个回答控制在200字以内。',
        temperature: 0.3,  // 降低随机性
        top_p: 0.1,       // 提高输出的确定性
        frequency_penalty: 1.0,  // 增加输出多样性
        presence_penalty: 1.0,   // 避免重复内容
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