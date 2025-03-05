import { Teacher } from '../src/roles/teacher';
import type { TeacherRunOptions, TeacherStreamCallback } from '../src/roles/teacher';
import { logger, LogLevel } from '../src/utils/logger';
import { UserMessage } from '../src/types/message';
import { createLLMProvider } from './llm-provider';

// 设置日志级别
logger.setLevel(LogLevel.INFO);

/**
 * 教师角色运行模式
 */
export enum TeacherRunMode {
  REGULAR = 'regular',
  STREAMING = 'streaming'
}

/**
 * 教师角色示例，支持流式和普通模式
 */
async function main() {
  // 检查环境变量
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY;
  logger.info('✓ 检查环境变量');
  
  if (!apiKey) {
    logger.error('❌ 错误: 请设置环境变量: DASHSCOPE_API_KEY 或 OPENAI_API_KEY');
    process.exit(1);
  }
  logger.info('✓ 环境变量已设置');
  
  // 创建 LLM Provider
  const provider = createLLMProvider(
    '你是一位专业的教育专家，擅长简洁有效地回答教育相关问题。请用简短的方式回应，使用中文，重点突出关键信息。每个回答控制在200字以内。'
  );

  // 创建 Teacher 实例
  const teacher = new Teacher('Math Teacher', provider, {
    teachingStyle: 'interactive',
    subjectExpertise: ['mathematics', 'physics'],
    difficultyLevels: ['beginner', 'intermediate', 'advanced']
  });
  logger.info('✓ Teacher 角色已初始化');

  // 确定运行模式（默认为流式）
  const runMode = TeacherRunMode.STREAMING;
  logger.info(`运行模式: ${runMode}`);

  // 创建用户消息
  const topic = '三角函数基础';
  const message = new UserMessage(topic);
  logger.info(`主题: "${topic}"`);

  if (runMode === TeacherRunMode.STREAMING) {
    logger.info('开始流式响应...');
    logger.info('\n--- 流式响应开始 ---\n');
    
    // 跟踪当前部分
    let currentSection = '';
    
    // 使用流式模式
    const result = await teacher.run(message, {
      streaming: true,
      streamCallback: (chunk: string, section: string) => {
        // 如果部分发生变化，显示新部分标题
        if (currentSection !== section) {
          if (currentSection !== '') {
            process.stdout.write('\n\n');
          }
          process.stdout.write(`\n--- 正在生成: ${section} ---\n\n`);
          currentSection = section;
        }
        
        // 实时输出文本块
        process.stdout.write(chunk);
      }
    });
    
    logger.info('\n\n--- 流式响应完成 ---');
    logger.info(`总字数: ${result.content.length}`);
  } else {
    logger.info('开始普通响应...');
    
    // 使用普通模式
    const startTime = Date.now();
    const result = await teacher.run(message);
    const endTime = Date.now();
    
    logger.info('--- 普通响应完成 ---');
    logger.info(`结果: ${result.content}`);
    logger.info(`生成耗时: ${(endTime - startTime) / 1000} 秒`);
  }
}

// 运行示例
main().catch(error => {
  logger.error('运行出错:', error);
  process.exit(1);
}); 