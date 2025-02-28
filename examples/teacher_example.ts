import { Teacher } from '../src/roles/teacher';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { logger } from '../src/utils/logger';
import { UserMessage } from '../src/types/message';

async function main() {
  const apiKey = process.env.DASHSCOPE_API_KEY ? process.env.DASHSCOPE_API_KEY : "sk-bc977c4e31e542f1a34159cb42478198";

  // 创建 LLM Provider
  const provider = new VercelLLMProvider({
    providerType: 'qwen',
    apiKey :apiKey,
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
        system: '你是一位专业的教育专家，擅长简洁有效地回答教育相关问题。请用简短的方式回应，重点突出关键信息。每个回答控制在200字以内。',
        temperature: 0.3,
        top_p: 0.1,
        frequency_penalty: 1.0,
        presence_penalty: 1.0,
      }
    }
  });

  // 创建 Teacher 实例
  const teacher = new Teacher('Math Teacher', provider, {
    teachingStyle: 'interactive',
    subjectExpertise: ['mathematics', 'physics'],
    difficultyLevels: ['beginner', 'intermediate', 'advanced']
  });

  // 示例 1: 创建课程计划
  logger.info('=== 创建课程计划 ===');
  const lessonPlan = await teacher.createLessonPlan('三角函数基础');
  logger.info('课程计划:', lessonPlan);

  // 示例 2: 解释概念
  logger.info('\n=== 解释概念 ===');
  const message = new UserMessage('请解释什么是正弦函数？');
  teacher.context.memory.add(message);
  await teacher.think();
  const todo = teacher.getTodo();
  if (todo) {
    const explanation = await todo.run({ concept: '正弦函数' });
    logger.info('概念解释:', explanation);
  }

  // 示例 3: 生成测验题
  logger.info('\n=== 生成测验题 ===');
  const quiz = await teacher.generateQuiz('三角函数');
  logger.info('测验题:', quiz);

  // 示例 4: 评估答案
  logger.info('\n=== 评估答案 ===');
  const evaluation = await teacher.evaluateAnswer(
    '什么是正弦函数？',
    '正弦函数是一个三角函数，它表示直角三角形中对边与斜边的比值。'
  );
  logger.info('评估结果:', evaluation);
}

// 运行示例
main().catch(error => {
  logger.error('运行出错:', error);
  process.exit(1);
}); 