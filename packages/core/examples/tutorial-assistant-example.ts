import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { TutorialAssistant } from '../src/roles/tutorial-assistant';
import { v4 as uuidv4 } from 'uuid';
import { logger, LogLevel } from '../src/utils/logger';
import { UserMessage } from '../src/types/message';

/**
 * 教程助手示例
 * 
 * 该示例演示如何使用教程助手生成Markdown格式的教程文档
 */
async function main() {
  logger.setLevel(LogLevel.INFO);
  logger.info(`🚀 开始执行教程生成 [${new Date().toISOString()}]`);
  
  try {
    // 从环境变量获取API密钥
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
    logger.info(`✓ 模型配置完成: ${llmProvider.getName()} - ${llmProvider.getModel()}`);
    
    logger.info('⚙️ 初始化教程助手...');
    console.time('教程助手初始化时间');
    
    // 创建教程助手
    const tutorialAssistant = new TutorialAssistant({
      llm: llmProvider,
      language: 'Chinese', // 可选: 'English'
      outputDir: './output/tutorials', // 可选，默认为 './tutorials'
    });
    
    // 设置反应模式
    tutorialAssistant.setReactMode('react', 1);
    
    console.timeEnd('教程助手初始化时间');
    logger.info('✓ 教程助手初始化完成');
    
    // 设置要生成的教程主题
    const topic = '暨南大学数字经济学复试资料';
    logger.info(`📝 生成主题: "${topic}"`);
    
    // 生成教程
    logger.info('🔄 开始生成教程...');
    logger.info('👉 步骤 1: 生成目录结构');
    console.time('教程生成总时间');
    
    // 创建用户消息
    const userMessage = new UserMessage(topic);
    
    // 使用run方法执行教程生成
    const result = await tutorialAssistant.run(userMessage);
    
    console.timeEnd('教程生成总时间');
    logger.info('✅ 教程生成完成!');
    
    // 提取文件路径（假设结果消息中包含文件路径信息）
    const filePath = result.content.includes('saved to') 
      ? result.content.split('saved to ')[1].trim()
      : '未找到文件路径';
    
    logger.info(`📄 生成结果: ${result.content}`);
    logger.info(`📂 输出文件: ${filePath}`);
    logger.info(`🏁 教程生成完成 [${new Date().toISOString()}]`);
  } catch (error) {
    logger.error('❌ 生成教程时出错:', error);
    if (error instanceof Error) {
      logger.error(`错误类型: ${error.name}`);
      logger.error(`错误信息: ${error.message}`);
      logger.error(`错误堆栈: ${error.stack}`);
    }
  }
}

// 运行示例
logger.info('📌 教程助手示例');
main(); 