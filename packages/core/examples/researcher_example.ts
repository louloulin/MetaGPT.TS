import { Researcher } from '../src/roles/researcher';
import { logger } from '../src/utils/logger';
import { UserMessage } from '../src/types/message';
import { createLLMProvider } from './llm-provider';
import { ResearchTopicType, ReliabilityRating } from '../src/actions/research';

// @ts-ignore
declare const process: any;

async function main() {
  // 创建 LLM Provider
  const provider = createLLMProvider(
    '你是一位专业的研究员，擅长收集和分析信息，生成深入的研究报告。请保持客观、准确，并提供详实的参考依据。'
  );

  // 创建 Researcher 实例
  const researcher = new Researcher({
    llm: provider,
    defaultTopicType: ResearchTopicType.TECHNICAL,
    minReliability: ReliabilityRating.HIGH,
    maxSources: 5,
    react_mode: 'plan_and_act',
    max_react_loop: 3
  });

  // 示例 1: 研究主题概述
  logger.info('=== 研究主题概述 ===');
  const topic = new UserMessage('请研究量子计算的基本原理和最新发展。');
  researcher.context.memory.add(topic);
  await researcher.think();
  const todo = researcher.context.todo;
  if (todo) {
    const overview = await todo.run();
    logger.info('研究概述:', overview);
  }

  // 示例 2: 技术趋势分析
  logger.info('\n=== 技术趋势分析 ===');
  const trend = new UserMessage('分析2024年人工智能领域的主要发展趋势。');
  researcher.context.memory.add(trend);
  await researcher.think();
  const trendTodo = researcher.context.todo;
  if (trendTodo) {
    const analysis = await trendTodo.run();
    logger.info('趋势分析:', analysis);
  }

  // 示例 3: 比较研究
  logger.info('\n=== 比较研究 ===');
  const comparison = new UserMessage('比较不同类型的数据库系统（关系型、文档型、图数据库）的优缺点。');
  researcher.context.memory.add(comparison);
  await researcher.think();
  const comparisonTodo = researcher.context.todo;
  if (comparisonTodo) {
    const study = await comparisonTodo.run();
    logger.info('比较结果:', study);
  }

  // 示例 4: 技术评估
  logger.info('\n=== 技术评估 ===');
  const evaluation = new UserMessage(`
    评估以下技术栈的优缺点：
    - 前端：React + TypeScript
    - 后端：Node.js + Express
    - 数据库：MongoDB
    - 部署：Docker + Kubernetes
  `);
  researcher.context.memory.add(evaluation);
  await researcher.think();
  const evaluationTodo = researcher.context.todo;
  if (evaluationTodo) {
    const assessment = await evaluationTodo.run();
    logger.info('技术评估:', assessment);
  }
}

// 运行示例
main().catch(error => {
  logger.error('运行出错:', error);
  process.exit(1);
}); 