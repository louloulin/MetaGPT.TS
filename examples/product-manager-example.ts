import { ProductManager } from '../src/roles/product-manager';
import { WritePRD } from '../src/actions/write-prd';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { UserMessage } from '../src/types/message';
import { logger, LogLevel } from '../src/utils/logger';

// Set log level
logger.setLevel(LogLevel.DEBUG);

/**
 * Example of using the ProductManager role with WritePRD action
 */
async function main() {
  try {
    logger.info('Starting ProductManager example...');
    
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
          system: '你是一位专业的教程编写专家，擅长生成高质量、结构清晰的教程文档。'
        }
      }
    });
    
    // Create WritePRD action
    const writePRDAction = new WritePRD({
      name: 'WritePRD',
      description: 'Writes a Product Requirements Document',
      llm: llmProvider,
    });
    
    // Create ProductManager role with the WritePRD action
    const productManager = new ProductManager(
      'ProductOwner',
      'Product Manager',
      'Define clear product requirements',
      'Focus on user needs and business goals',
      [writePRDAction]
    );
    
    // Set react mode
    productManager.setReactMode('react', 1);
    
    // Create a user message with product requirements
    const userMessage = new UserMessage(
      'We need a mobile app for task management. It should allow users to create, edit, and delete tasks, ' +
      'set due dates, add labels, and receive notifications. The app should sync across devices and work offline.'
    );
    
    logger.info('Sending request to ProductManager...');
    
    // 使用公共方法设置需求参数
    writePRDAction.setRequirements(userMessage.content);
    logger.info('Requirements set for WritePRD action');
    
    // Run the product manager role with the user message
    const response = await productManager.run(userMessage);
    
    // Display the response
    logger.info('\n--- ProductManager Response ---');
    logger.info(response.content);
    logger.info('------------------------\n');
    
  } catch (error) {
    logger.error('Error in ProductManager example:', error);
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