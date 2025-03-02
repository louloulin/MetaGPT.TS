import { Assistant } from '../src/roles/assistant';
import { logger } from '../src/utils/logger';
import { UserMessage } from '../src/types/message';
import { createLLMProvider } from './llm-provider';

// @ts-ignore
declare const process: any;

async function main() {
  // 创建 LLM Provider
  const provider = createLLMProvider(
    '你是一位专业的 AI 助手，擅长回答各种问题并提供帮助。请用简洁清晰的方式回应，确保答案准确且易于理解。'
  );

  // 创建 Assistant 实例
  const assistant = new Assistant({
    llm: provider,
    name: 'General Assistant',
    profile: '全能助手',
    goal: '提供准确、有用的帮助和建议',
    constraints: '保持专业、友好，确保信息准确性',
    capabilities: ['general_assistance', 'information_lookup', 'task_management'],
    specialties: ['general', 'problem_solving', 'explanation'],
    react_mode: 'plan_and_act',
    max_react_loop: 3,
    memory_limit: 100
  });

  try {
    // 示例 1: 回答一般性问题
    logger.info('=== 回答问题 ===');
    const question = new UserMessage('什么是人工智能？请用简单的话解释。');
    const answer = await assistant.run(question);
    logger.info('回答:', answer.content);

    // 示例 2: 提供建议
    logger.info('\n=== 提供建议 ===');
    const adviceRequest = new UserMessage('我想学习编程，应该从哪里开始？');
    const advice = await assistant.run(adviceRequest);
    logger.info('建议:', advice.content);

    // 示例 3: 解决问题
    logger.info('\n=== 解决问题 ===');
    const problem = new UserMessage('我的电脑运行很慢，有什么基本的排查步骤吗？');
    const solution = await assistant.run(problem);
    logger.info('解决方案:', solution.content);

    // 示例 4: 信息总结
    logger.info('\n=== 信息总结 ===');
    const text = new UserMessage(`
      人工智能(AI)是计算机科学的一个分支，致力于创建能够模仿人类智能的系统。
      机器学习是AI的一个重要组成部分，它使用数据来训练模型。
      深度学习是机器学习的一个子集，使用多层神经网络来学习数据的特征。
      请总结这段文字的要点。
    `);
    const summary = await assistant.run(text);
    logger.info('总结:', summary.content);

  } catch (error) {
    logger.error('运行出错:', error);
    process.exit(1);
  }
}

// 运行示例
main().catch(error => {
  logger.error('运行出错:', error);
  process.exit(1);
}); 