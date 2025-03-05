import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { logger, LogLevel } from '../src/utils/logger';

// Set log level
logger.setLevel(LogLevel.DEBUG);

/**
 * Example of using the VercelLLMProvider with streaming
 */
async function main() {
  try {
    logger.info('Starting VercelLLM streaming example...');
    
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY;
    logger.info('✓ 检查环境变量');
    
    if (!apiKey) {
      logger.error('❌ 错误: 请设置环境变量: DASHSCOPE_API_KEY 或 OPENAI_API_KEY');
      process.exit(1);
    }
    logger.info('✓ 环境变量已设置');
    
    // 初始化Vercel LLM提供商
    logger.info('⚙️ 配置LLM提供商...');
    
    // 根据可用的API密钥选择提供商
    const providerType = process.env.DASHSCOPE_API_KEY ? 'qwen' : 'openai';
    const model = providerType === 'qwen' ? 'qwen-plus' : 'gpt-3.5-turbo';
    const baseURL = providerType === 'qwen' 
      ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' 
      : undefined;
    
    const llmProvider = new VercelLLMProvider({
      providerType,
      apiKey,
      model,
      baseURL,
      extraConfig: {
        generateOptions: {
          system: '你是一位专业的教程编写专家，擅长生成高质量、结构清晰的教程文档。'
        }
      }
    });
    
    // 设置系统提示
    llmProvider.setSystemPrompt('你是一位专业的教程编写专家，擅长生成高质量、结构清晰的教程文档。');
    logger.info(`✓ 模型配置完成: ${llmProvider.getName()} - ${llmProvider.getModel()}`);
    
    // 准备提示词
    const prompt = '请写一个关于如何使用TypeScript实现一个简单的聊天机器人的教程，包括代码示例。';
    
    logger.info('开始生成流式响应...');
    logger.info('\n--- 流式响应开始 ---\n');
    
    // 使用generateStream方法获取流式响应
    let fullResponse = '';
    for await (const chunk of llmProvider.generateStream(prompt)) {
      process.stdout.write(chunk); // 实时输出每个文本块
      fullResponse += chunk;
    }
    
    logger.info('\n\n--- 流式响应结束 ---');
    logger.info(`总共生成了 ${fullResponse.length} 个字符`);
    
    // 使用chatStream方法
    logger.info('\n\n开始聊天流式响应...');
    logger.info('\n--- 聊天流式响应开始 ---\n');
    
    const chatPrompt = '请用简单的语言解释什么是异步编程？';
    
    // 使用chatStream方法获取流式响应
    let chatResponse = '';
    for await (const chunk of llmProvider.chatStream(chatPrompt)) {
      process.stdout.write(chunk); // 实时输出每个文本块
      chatResponse += chunk;
    }
    
    logger.info('\n\n--- 聊天流式响应结束 ---');
    logger.info(`总共生成了 ${chatResponse.length} 个字符`);
    
  } catch (error) {
    logger.error('Error in VercelLLM streaming example:', error);
    if (error instanceof Error) {
      logger.error(`Error type: ${error.name}`);
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
    }
  }
}

// Run the example
if (require.main === module) {
  main().catch(error => logger.error('Unhandled error:', error));
} 