/**
 * 增强型RAG示例
 * 
 * 这个示例展示了MetaGPT中增强的RAG功能:
 * 1. 混合搜索 (语义+关键词)
 * 2. 语义分块
 * 3. 结果重排序
 * 
 * @module examples/enhanced-rag
 */

import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { config } from 'dotenv';

import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { RAGSystem, SearchMode } from '../src/rag/rag-system';
import { ChunkingStrategy } from '../src/rag/chunker';

// 加载环境变量
config();

// 彩色输出工具函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function printTitle(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}\n`);
}

function printSubtitle(subtitle: string) {
  console.log(`\n${colors.bright}${colors.yellow}>>> ${subtitle} ${colors.reset}\n`);
}

function printInfo(key: string, value: string) {
  console.log(`${colors.bright}${key}:${colors.reset} ${value}`);
}

function printResult(result: string) {
  console.log(`\n${colors.green}${result}${colors.reset}\n`);
}

function printError(error: string) {
  console.error(`\n${colors.red}错误: ${error}${colors.reset}\n`);
}

function printSearchResult(index: number, result: any) {
  console.log(`\n${colors.yellow}[结果 ${index + 1}] ${colors.bright}得分: ${result.score.toFixed(3)}${colors.reset}`);
  
  // 打印元数据
  if (result.metadata && result.metadata.scoreDetails) {
    const details = result.metadata.scoreDetails;
    console.log(`${colors.dim}语义得分: ${details.semantic.toFixed(3)}, 关键词得分: ${details.keyword.toFixed(3)}${colors.reset}`);
  }
  
  // 打印内容预览
  if (result.chunk && result.chunk.content) {
    const preview = result.chunk.content.length > 150
      ? result.chunk.content.substring(0, 150) + '...'
      : result.chunk.content;
    console.log(preview);
  }
}

/**
 * 加载示例文档
 */
async function loadExampleDocuments(): Promise<string[]> {
  try {
    // 如果没有提供示例文档，创建一些测试文档
    printInfo('加载示例文档', '创建示例文本');
    
    return [
      `# MetaGPT架构概述
      
      MetaGPT是一个面向大型语言模型(LLM)的应用开发框架，专注于构建复杂、可扩展的AI系统。
      
      ## 核心组件
      
      MetaGPT的核心组件包括：
      
      1. **角色系统** - 基于LLM的自主代理，可以执行特定职责
      2. **工作流引擎** - 协调多个角色完成复杂任务
      3. **环境** - 代理交互的上下文和工具集
      4. **记忆系统** - 短期和长期记忆管理
      5. **工具集成** - 允许代理使用外部工具和API
      
      ## 技术特点
      
      * 基于思维链(Chain-of-Thought)的推理
      * 思维树(Tree-of-Thought)结构化决策
      * 多代理协作框架
      * 可扩展的插件系统`,
      
      `# MetaGPT的RAG系统
      
      检索增强生成(Retrieval Augmented Generation, RAG)是MetaGPT的关键功能之一，它通过结合外部知识增强LLM的回答。
      
      ## RAG的关键组件
      
      * **文档加载器** - 支持多种格式的文档导入
      * **文档分块器** - 将文档切分为可管理的小块
      * **嵌入生成器** - 创建文本的向量表示
      * **向量存储** - 高效存储和检索嵌入向量
      * **查询处理器** - 优化用户查询以提高检索质量
      
      ## 最佳实践
      
      * 使用语义分块而非简单的固定大小分块
      * 结合关键词和语义搜索以提高准确性
      * 实现结果重排序以优化相关性
      * 定期更新向量数据库以保持最新信息`,
      
      `# TypeScript中的MetaGPT实现
      
      MetaGPT-TS是MetaGPT的TypeScript实现版本，专为Web环境和Node.js应用程序优化。
      
      ## 主要特性
      
      * 完全类型化的API，提供优秀的开发体验
      * 与现代前端框架(React, Vue, Angular)集成
      * 轻量级架构，可在浏览器和服务器端运行
      * 内置流式响应支持
      * 支持主流的LLM提供商
      
      ## 与Python版本的差异
      
      TypeScript版本专注于Web环境的优化，而Python版本更适合数据科学和研究场景。两者共享核心设计理念，但在实现细节和生态系统集成方面有所不同。
      
      TypeScript版本额外提供了与前端框架的深度集成能力，而Python版本则在数据处理和科学计算方面具有优势。`
    ];
  } catch (error) {
    printError(`加载示例文档失败: ${error}`);
    return [];
  }
}

/**
 * 运行示例
 */
async function main() {
  printTitle('MetaGPT 增强型RAG示例');
  
  try {
    // 创建LLM提供商
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('未设置OPENAI_API_KEY环境变量');
    }
    
    const llmProvider = new VercelLLMProvider({
      providerType: 'openai',
      apiKey,
      model: 'gpt-3.5-turbo'
    });
    
    printInfo('LLM提供商', 'OpenAI (通过Vercel AI SDK)');
    printInfo('模型', 'gpt-3.5-turbo');
    
    // 创建RAG系统，启用高级功能
    const ragSystem = RAGSystem.create(llmProvider, {
      // 搜索配置
      searchMode: SearchMode.HYBRID,
      topK: 3,
      minScore: 0.6,
      
      // 混合搜索配置
      hybridSearch: {
        semanticWeight: 0.7,
        keywordWeight: 0.3,
        applyReranking: true,
        minScore: 0.5,
        maxResults: 10,
        maxKeywordDistance: 3
      },
      
      // 分块配置
      chunkingStrategy: ChunkingStrategy.SEMANTIC
    });
    
    printInfo('RAG配置', '混合搜索 + 语义分块 + 结果重排序');
    
    // 加载示例文档
    const documents = await loadExampleDocuments();
    
    // 将文档添加到RAG系统
    printSubtitle('添加文档到RAG系统');
    for (let i = 0; i < documents.length; i++) {
      await ragSystem.addDocument({
        content: documents[i],
        metadata: { 
          source: `example-${i+1}`,
          title: `示例文档 ${i+1}`,
          updatedAt: new Date().toISOString()
        }
      });
      printInfo(`文档 ${i+1}`, '已添加');
    }
    
    // 混合搜索示例
    printSubtitle('混合搜索示例 (语义 + 关键词)');
    const hybridQuery = 'TypeScript版本的RAG系统有什么特性？';
    printInfo('查询', hybridQuery);
    
    const hybridResults = await ragSystem.search(hybridQuery);
    printInfo('找到结果', `${hybridResults.length}个`);
    
    // 显示搜索结果
    hybridResults.forEach((result, index) => {
      printSearchResult(index, result);
    });
    
    // 生成回答
    printSubtitle('基于检索结果生成回答');
    const answer = await ragSystem.generate(hybridQuery);
    printResult(answer);
    
    // 比较不同搜索模式
    printSubtitle('比较不同搜索模式');
    
    // 切换到纯语义搜索
    ragSystem.updateConfig({ searchMode: SearchMode.SEMANTIC });
    const semanticResults = await ragSystem.search(hybridQuery);
    printInfo('语义搜索结果', `${semanticResults.length}个`);
    
    // 切换回混合搜索
    ragSystem.updateConfig({ searchMode: SearchMode.HYBRID });
    
    // 尝试不同的查询
    printSubtitle('多样化查询示例');
    
    const queries = [
      '什么是MetaGPT的思维树？',
      'TypeScript版本和Python版本的区别',
      'MetaGPT的RAG系统如何进行文档分块？'
    ];
    
    for (const query of queries) {
      printInfo('查询', query);
      const results = await ragSystem.search(query);
      printInfo('结果数量', `${results.length}个`);
      
      if (results.length > 0) {
        printSearchResult(0, results[0]); // 只显示最相关的结果
      }
      
      const answer = await ragSystem.generate(query);
      printResult(answer);
    }
    
  } catch (error) {
    printError(`运行示例时出错: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 运行示例
main().catch(error => {
  console.error('示例运行失败:', error);
}); 