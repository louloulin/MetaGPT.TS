import { TutorialAssistant, RunMode } from '../src/roles/tutorial-assistant';
import { logger } from '../src/utils/logger';
import { UserMessage } from '../src/types/message';
import { createLLMProvider } from './llm-provider';

// @ts-ignore
declare const process: any;

async function main() {
  // 创建 LLM Provider
  const provider = createLLMProvider(
    '你是一位专业的教程助手，擅长创建清晰、易懂的教程。请使用循序渐进的方式，并提供实用的示例。'
  );

  // 创建 TutorialAssistant 实例
  const assistant = new TutorialAssistant({
    llm: provider,
    language: 'Chinese',
    outputDir: './tutorials'
  });

  // 示例 1: 创建基础教程
  logger.info('=== 创建基础教程 ===');
  const basicRequest = new UserMessage('请创建一个 React Hooks 基础教程，包括 useState 和 useEffect 的使用。');
  const basicTutorial = await assistant.run(basicRequest, {
    mode: RunMode.REGULAR
  });
  logger.info('教程内容:', basicTutorial);

  // 示例 2: 创建实践项目教程
  logger.info('\n=== 创建实践项目教程 ===');
  const projectRequest = new UserMessage(`
    请创建一个实践项目教程：
    主题：使用 React + TypeScript 创建一个待办事项应用
    要求：
    1. 包含完整的项目结构
    2. 实现基本的 CRUD 功能
    3. 使用 localStorage 存储数据
  `);
  const projectTutorial = await assistant.run(projectRequest, {
    mode: RunMode.REGULAR
  });
  logger.info('项目教程:', projectTutorial);

  // 示例 3: 创建故障排除指南（使用流式输出）
  logger.info('\n=== 创建故障排除指南 ===');
  const troubleshootRequest = new UserMessage(`
    请创建一个 Node.js 应用常见问题的故障排除指南，包括：
    1. 内存泄漏问题
    2. 性能优化
    3. 错误处理最佳实践
  `);
  const troubleshootGuide = await assistant.run(troubleshootRequest, {
    mode: RunMode.STREAMING,
    streamCallback: (chunk: string, title: string) => {
      logger.info(`[${title}] ${chunk}`);
    }
  });
  logger.info('故障排除指南:', troubleshootGuide);

  // 示例 4: 创建最佳实践指南（使用流式输出）
  logger.info('\n=== 创建最佳实践指南 ===');
  const bestPracticesRequest = new UserMessage(`
    请创建一个 TypeScript 项目的最佳实践指南，包括：
    1. 项目结构组织
    2. 类型定义最佳实践
    3. 错误处理策略
    4. 测试策略
    5. 文档规范
  `);
  const bestPractices = await assistant.run(bestPracticesRequest, {
    mode: RunMode.STREAMING,
    streamCallback: (chunk: string, title: string) => {
      logger.info(`[${title}] ${chunk}`);
    }
  });
  logger.info('最佳实践指南:', bestPractices);
}

// 运行示例
main().catch(error => {
  logger.error('运行出错:', error);
  process.exit(1);
}); 