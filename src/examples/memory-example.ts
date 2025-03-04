/**
 * 增强型分层记忆系统示例
 * 
 * 这个示例展示了如何使用MetaGPT-TS的分层记忆系统（短期记忆、工作记忆和长期记忆）
 * 进行高效的记忆管理、检索和知识积累。
 */

import { MemoryManagerImpl } from '../memory/memory-manager';
import type { Message } from '../types/message';
import { UserMessage, AIMessage } from '../types/message';
import type { VercelLLMProvider } from '../provider/vercel-llm';
import { logger } from '../utils/logger';
import path from 'path';

async function runMemoryExample() {
  logger.info('启动分层记忆系统示例...');

  // 初始化LLM提供者（用于记忆重要性评分和摘要生成）
  // 注意：这里使用mock提供者，实际使用时请替换为真实的LLM提供者
  const llmProvider = {
    chat: async (message: string) => `Mock response to: ${message}`,
    getName: () => 'MockProvider',
    getModel: () => 'mock-model',
    generate: async (prompt: string) => `Mock generation for: ${prompt}`
  };

  // 创建记忆管理器，指定存储路径
  const memoryManager = new MemoryManagerImpl(
    llmProvider as any, 
    path.join(process.cwd(), 'memory-storage')
  );

  // 初始化记忆系统
  await memoryManager.init();
  logger.info('记忆系统已初始化');

  // 模拟对话消息
  const messages: Message[] = [
    new UserMessage('我的猫叫小花，是一只三岁的橘猫'),
    new AIMessage('小花是一个很可爱的名字！三岁的橘猫正是活泼好动的时候。'),
    new UserMessage('小花喜欢吃鱼和鸡肉，但不喜欢蔬菜'),
    new AIMessage('很多猫咪都喜欢鱼和鸡肉，不喜欢蔬菜也很正常。确保小花的饮食均衡很重要。'),
    new UserMessage('昨天我带小花去了宠物医院做年度体检'),
    new UserMessage('如何训练猫咪使用猫砂盆？'),
    new AIMessage('训练猫咪使用猫砂盆通常需要以下步骤：1.选择合适的猫砂盆和猫砂；2.放在安静、容易到达的位置；3.饭后或睡醒时将猫咪轻放在猫砂盆中；4.当成功使用时，立即给予奖励和表扬；5.保持猫砂盆清洁。大多数猫咪有天然的掩埋排泄物习性，所以训练通常不会太困难。'),
    new UserMessage('医生说小花有点超重，建议我控制她的饮食'),
    new AIMessage('医生的建议很重要。猫咪超重可能导致多种健康问题，如糖尿病、关节问题等。可以通过控制食量、增加活动量、选择低脂猫粮等方式帮助小花减重。建议遵循兽医的具体指导制定饮食计划。'),
    new UserMessage('你还记得我的猫叫什么名字吗？'),
  ];

  // 将消息处理到记忆系统中
  logger.info('处理对话消息...');
  for (const message of messages.slice(0, -1)) {
    await memoryManager.processMessage(message);
  }

  // 使用最后一条消息进行记忆检索测试
  const queryMessage = messages[messages.length - 1];
  logger.info(`记忆检索查询: "${queryMessage.content}"`);
  
  // 获取相关记忆作为上下文
  const relevantMemories = await memoryManager.getContext(queryMessage);
  
  logger.info(`找到 ${relevantMemories.length} 条相关记忆`);
  
  // 显示检索到的记忆
  relevantMemories.forEach((memory, index) => {
    logger.info(`记忆 ${index + 1} [重要性: ${memory.importance.toFixed(2)}]:`);
    logger.info(`内容: ${memory.content}`);
    if (memory.summary) {
      logger.info(`摘要: ${memory.summary}`);
    }
    logger.info(`类型: ${memory.type}`);
    logger.info(`访问次数: ${memory.accessCount}`);
    logger.info('---');
  });

  // 回答问题
  const catNameMemory = relevantMemories.find(memory => 
    memory.content.toLowerCase().includes('叫小花')
  );
  
  const answer = catNameMemory 
    ? `基于我的记忆，您的猫咪叫小花，是一只三岁的橘猫。` 
    : `抱歉，我似乎不记得您的猫咪的名字。能请您提醒我一下吗？`;
  
  logger.info(`回答: ${answer}`);

  // 模拟一些长期记忆的操作
  logger.info('\n测试长期记忆操作...');
  
  // 添加一些额外记忆到长期记忆
  await memoryManager.longTerm.add(
    '小花是一只橘色的猫，今年三岁。她喜欢吃鱼和鸡肉，但不喜欢蔬菜。最近的体检显示她有点超重，需要控制饮食。',
    'summary',
    { importance: 0.85 }
  );
  
  // 进行记忆维护
  logger.info('执行记忆维护...');
  await memoryManager.cleanup();
  
  logger.info('记忆示例完成');
}

// 运行示例
runMemoryExample().catch(error => {
  logger.error('记忆示例运行错误:', error);
});

export { runMemoryExample }; 