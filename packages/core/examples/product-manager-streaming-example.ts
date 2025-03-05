import { ProductManager } from '../src/roles/product-manager';
import { WritePRD } from '../src/actions/write-prd';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { UserMessage } from '../src/types/message';
import { logger, LogLevel } from '../src/utils/logger';
import { BaseAction } from '../src/actions/base-action';
import type { ActionOutput } from '../src/types/action';

// Set log level
logger.setLevel(LogLevel.DEBUG);

/**
 * Extended ProductManager class with streaming support
 */
class StreamingProductManager extends ProductManager {
  /**
   * Run the role with streaming support
   * @param message - Input message
   * @param streamCallback - Callback for streaming chunks
   * @returns Final response message
   */
  async runWithStreaming(
    message: UserMessage, 
    streamCallback?: (chunk: string, actionName: string) => void
  ) {
    try {
      // Process the message
      logger.info(`[${this.name}] Processing message: ${message.content.substring(0, 50)}...`);
      
      // Decide which action to take
      const action = await this.decideNextAction(message);
      
      if (!action) {
        logger.warn(`[${this.name}] No suitable action found for message`);
        return this.createMessage('I don\'t know how to respond to that message.');
      }
      
      logger.info(`[${this.name}] Selected action: ${action.name}`);
      
      // Check if the action supports streaming
      if ('runStream' in action && typeof action.runStream === 'function') {
        // Run the action with streaming
        let fullResponse = '';
        const result = await (action as any).runStream((chunk: string) => {
          fullResponse += chunk;
          if (streamCallback) {
            streamCallback(chunk, action.name);
          }
        });
        
        // Create a message from the action result
        const responseMessage = this.createMessage(
          result.content || 'No output from action'
        );
        
        // Add the response to memory
        this.addToMemory(responseMessage);
        
        return responseMessage;
      } else {
        // Fall back to non-streaming for actions that don't support it
        const result = await action.run();
        
        // Create a message from the action result
        const responseMessage = this.createMessage(
          result.content || 'No output from action'
        );
        
        // Add the response to memory
        this.addToMemory(responseMessage);
        
        return responseMessage;
      }
    } catch (error) {
      logger.error(`[${this.name}] Error in runWithStreaming:`, error);
      return this.createMessage(`Error: ${error}`);
    }
  }
}

/**
 * Example of using the ProductManager role with streaming support
 */
async function main() {
  try {
    logger.info('Starting ProductManager streaming example...');
    
    const apiKey = process.env.DASHSCOPE_API_KEY;
    logger.info('✓ 检查环境变量');
    
    if (!apiKey) {
      logger.error('❌ 错误: 请设置环境变量: DASHSCOPE_API_KEY');
      process.exit(1);
    }
    logger.info('✓ 环境变量已设置');
    
    // 初始化Vercel LLM提供商 - 使用百炼大模型(qwen)
    logger.info('⚙️ 配置百炼大模型...');
    const llmProvider = new VercelLLMProvider({
      providerType: 'qwen',
      apiKey,
      model: 'qwen-plus-2025-01-25',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', // 自定义API端点
      extraConfig: {
        qwenOptions: {
          debug: true, // 启用调试日志
        },
        generateOptions: {
          system: '你是一位专业的产品经理，擅长编写高质量的产品需求文档。'
        }
      }
    });
    
    // Create WritePRD action
    const writePRDAction = new WritePRD({
      name: 'WritePRD',
      description: 'Writes a Product Requirements Document',
      llm: llmProvider,
    });
    
    // Create StreamingProductManager role with the WritePRD action
    const productManager = new StreamingProductManager(
      'ProductOwner',
      'Product Manager',
      'Define clear product requirements',
      'Focus on user needs and business goals',
      [writePRDAction]
    );
    
    // Create a user message with product requirements
    const userMessage = new UserMessage(
      'We need a mobile app for task management. It should allow users to create, edit, and delete tasks, ' +
      'set due dates, add labels, and receive notifications. The app should sync across devices and work offline.'
    );
    
    logger.info('Sending request to ProductManager with streaming...');
    
    // 使用公共方法设置需求参数
    writePRDAction.setRequirements(userMessage.content);
    logger.info('Requirements set for WritePRD action');
    
    // 使用流式方法运行ProductManager
    logger.info('\n--- Streaming PRD Generation ---');
    process.stdout.write('\n');
    
    // 创建一个计数器来跟踪接收到的字符数
    let chunkCount = 0;
    
    const response = await productManager.runWithStreaming(
      userMessage,
      (chunk, actionName) => {
        // 实时输出每个文本块
        process.stdout.write(chunk);
        chunkCount++;
        
        // 每接收100个字符块打印一次进度信息
        if (chunkCount % 100 === 0) {
          process.stdout.write(`\n[已接收 ${chunkCount} 个字符块]\n`);
        }
      }
    );
    
    logger.info('\n\n--- Streaming Complete ---');
    logger.info(`Total chunks received: ${chunkCount}`);
    logger.info('------------------------\n');
    
  } catch (error) {
    logger.error('Error in ProductManager streaming example:', error);
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