import { Searcher } from '../src/roles/searcher';
import { logger } from '../src/utils/logger';
import { UserMessage } from '../src/types/message';
import { createLLMProvider } from '../../examples/utils/llm-provider';
import { SearchProviderType } from '../src/config/search';

// @ts-ignore
declare const process: any;

async function main() {
  // 创建 LLM Provider
  const provider = createLLMProvider(
    '你是一位专业的搜索专家，擅长查找和总结信息。请保持客观、准确，并提供有价值的信息摘要。'
  );

  // 创建 Searcher 实例
  const searcher = new Searcher({
    llm: provider,
    name: 'Info Searcher',
    profile: '信息搜索专家',
    searchProvider: SearchProviderType.SERPAPI,
    maxResults: 5
  });

  // 示例 1: 技术搜索
  logger.info('=== 技术搜索 ===');
  const techQuery = new UserMessage('最新的 TypeScript 5.0 有哪些重要特性？');
  searcher.addToMemory(techQuery);
  await searcher.think();
  const todo = searcher.context.todo;
  if (todo) {
    const results = await todo.run();
    logger.info('搜索结果:', results);
  }

  // 示例 2: 新闻搜索
  logger.info('\n=== 新闻搜索 ===');
  const newsQuery = new UserMessage('2024年人工智能领域最新的突破性进展有哪些？');
  searcher.addToMemory(newsQuery);
  await searcher.think();
  const newsTodo = searcher.context.todo;
  if (newsTodo) {
    const news = await newsTodo.run();
    logger.info('新闻摘要:', news);
  }

  // 示例 3: 产品比较
  logger.info('\n=== 产品比较 ===');
  const comparison = new UserMessage('比较主流的三个云服务提供商（AWS、Azure、GCP）的优缺点');
  searcher.addToMemory(comparison);
  await searcher.think();
  const comparisonTodo = searcher.context.todo;
  if (comparisonTodo) {
    const analysis = await comparisonTodo.run();
    logger.info('比较分析:', analysis);
  }

  // 示例 4: 趋势分析
  logger.info('\n=== 趋势分析 ===');
  const trend = new UserMessage(`
    分析以下技术趋势：
    1. Web Assembly 的发展前景
    2. 边缘计算的应用场景
    3. 量子计算的商业化进程
  `);
  searcher.addToMemory(trend);
  await searcher.think();
  const trendTodo = searcher.context.todo;
  if (trendTodo) {
    const trendAnalysis = await trendTodo.run();
    logger.info('趋势分析:', trendAnalysis);
  }
}

// 运行示例
main().catch(error => {
  logger.error('运行出错:', error);
  process.exit(1);
}); 