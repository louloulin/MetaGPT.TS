import { Teacher } from '../src/roles/teacher';
import { logger } from '../src/utils/logger';
import { UserMessage } from '../src/types/message';
import { createLLMProvider } from './llm-provider';

async function main() {
  // 创建 LLM Provider
  const provider = createLLMProvider(
    '你是一位专业的教育专家，擅长简洁有效地回答教育相关问题。请用简短的方式回应，重点突出关键信息。每个回答控制在200字以内。'
  );

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