import { Sales } from '../src/roles/sales';
import { logger } from '../src/utils/logger';
import { UserMessage } from '../src/types/message';
import { createLLMProvider } from '../../examples/utils/llm-provider';
import { SearchProviderType } from '../src/config/search';

// @ts-ignore
declare const process: any;

async function main() {
  // 创建 LLM Provider
  const provider = createLLMProvider(
    '你是一位专业的销售代表，擅长介绍产品特性和解答客户疑问。请保持专业、友好，并提供准确的信息。'
  );

  // 创建 Sales 实例
  const sales = new Sales({
    llm: provider,
    name: 'Product Sales',
    profile: '产品销售代表',
    goal: '介绍产品特性，解答疑问，促进销售',
    constraints: '保持专业、诚实，不夸大产品功能',
    searchProvider: SearchProviderType.SERPAPI,
    productKnowledgeBase: `
      产品信息库：
      
      1. 基础版功能：
      - 用户管理
      - 数据分析
      - 基本报表
      - 邮件通知
      价格：$99/月
      
      2. 专业版功能：
      - 包含基础版所有功能
      - API 访问
      - 高级报表
      - 自定义仪表盘
      - 优先技术支持
      价格：$199/月
      
      3. 企业版功能：
      - 包含专业版所有功能
      - 专属服务器
      - 24/7 技术支持
      - 自定义开发
      - SLA 保障
      价格：联系销售
    `
  });

  // 示例 1: 产品介绍
  logger.info('=== 产品介绍 ===');
  const inquiry = new UserMessage('请介绍一下你们的产品有哪些版本？各自有什么特点？');
  const introduction = await sales.handleMessage(inquiry);
  logger.info('产品介绍:', introduction);

  // 示例 2: 价格咨询
  logger.info('\n=== 价格咨询 ===');
  const pricing = new UserMessage('专业版的具体价格是多少？包含哪些服务？');
  const priceInfo = await sales.handleMessage(pricing);
  logger.info('价格信息:', priceInfo);

  // 示例 3: 功能对比
  logger.info('\n=== 功能对比 ===');
  const comparison = new UserMessage('基础版和专业版的主要区别是什么？值得升级吗？');
  const comparisonInfo = await sales.handleMessage(comparison);
  logger.info('功能对比:', comparisonInfo);

  // 示例 4: 技术咨询
  logger.info('\n=== 技术咨询 ===');
  const technical = new UserMessage('API 访问有什么限制吗？支持哪些编程语言？');
  const technicalInfo = await sales.handleMessage(technical);
  logger.info('技术信息:', technicalInfo);
}

// 运行示例
main().catch(error => {
  logger.error('运行出错:', error);
  process.exit(1);
}); 