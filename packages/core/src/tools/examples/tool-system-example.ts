/**
 * 工具系统使用示例
 * 展示增强的工具系统的完整功能
 */

import { ToolManager } from '../tool-registry';
import { SimpleBaseTool } from '../simple-base-tool';
import type { ToolConfig, ToolResult, ToolExecutionOptions } from '../../types/tool';
import { ToolPriority } from '../../types/tool';
import { logger } from '../../utils/logger';

// 示例：自定义AI工具
class AIAnalysisTool extends SimpleBaseTool {
  constructor() {
    super({
      name: 'ai_analysis',
      description: 'AI-powered text analysis tool',
      version: '1.0.0',
      category: 'ai',
      type: 'ai',
      priority: ToolPriority.NORMAL,
      tags: ['ai', 'analysis', 'nlp'],
      enabled: true,
      timeout: 30000,
      retries: 0,
      metadata: {},
    });
  }

  protected async executeInternal(
    args?: Record<string, any>,
    options?: ToolExecutionOptions
  ): Promise<ToolResult> {
    const startTime = new Date();
    const { text, analysisType = 'sentiment' } = args || {};

    if (!text) {
      return this.createResult(false, 'Text is required for analysis', undefined, {}, startTime);
    }

    // 模拟AI分析
    await this.delay(500);

    let result;
    switch (analysisType) {
      case 'sentiment':
        result = this.analyzeSentiment(text);
        break;
      case 'keywords':
        result = this.extractKeywords(text);
        break;
      case 'summary':
        result = this.generateSummary(text);
        break;
      default:
        return this.createResult(false, `Unknown analysis type: ${analysisType}`, undefined, {}, startTime);
    }

    return this.createResult(
      true,
      `${analysisType} analysis completed`,
      result,
      { analysisType, textLength: text.length },
      startTime
    );
  }

  private analyzeSentiment(text: string) {
    // 简单的情感分析模拟
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    }

    const sentiment = positiveCount > negativeCount ? 'positive' : 
                     negativeCount > positiveCount ? 'negative' : 'neutral';
    
    return {
      sentiment,
      confidence: Math.abs(positiveCount - negativeCount) / words.length,
      positiveWords: positiveCount,
      negativeWords: negativeCount,
      totalWords: words.length,
    };
  }

  private extractKeywords(text: string) {
    // 简单的关键词提取模拟
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const frequency: Record<string, number> = {};
    for (const word of words) {
      frequency[word] = (frequency[word] || 0) + 1;
    }

    const keywords = Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return { keywords, totalWords: words.length };
  }

  private generateSummary(text: string) {
    // 简单的摘要生成模拟
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const summary = sentences.slice(0, Math.min(3, Math.ceil(sentences.length / 3)))
      .map(s => s.trim())
      .join('. ') + '.';

    return {
      summary,
      originalSentences: sentences.length,
      summarySentences: Math.min(3, Math.ceil(sentences.length / 3)),
      compressionRatio: summary.length / text.length,
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 示例：代码分析工具
class CodeAnalysisTool extends SimpleBaseTool {
  constructor() {
    super({
      name: 'code_analysis',
      description: 'Code quality and complexity analysis tool',
      version: '1.0.0',
      category: 'code',
      type: 'analysis',
      priority: ToolPriority.NORMAL,
      tags: ['code', 'analysis', 'quality'],
      enabled: true,
      timeout: 30000,
      retries: 0,
      metadata: {},
    });
  }

  protected async executeInternal(
    args?: Record<string, any>,
    options?: ToolExecutionOptions
  ): Promise<ToolResult> {
    const startTime = new Date();
    const { code, language = 'javascript' } = args || {};

    if (!code) {
      return this.createResult(false, 'Code is required for analysis', undefined, {}, startTime);
    }

    // 模拟代码分析
    await this.delay(300);

    const analysis = this.analyzeCode(code, language);

    return this.createResult(
      true,
      'Code analysis completed',
      analysis,
      { language, codeLength: code.length },
      startTime
    );
  }

  private analyzeCode(code: string, language: string) {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    // 简单的复杂度分析
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(code);
    const codeSmells = this.detectCodeSmells(code);
    
    return {
      metrics: {
        totalLines: lines.length,
        codeLines: nonEmptyLines.length,
        emptyLines: lines.length - nonEmptyLines.length,
        cyclomaticComplexity,
        averageLineLength: nonEmptyLines.reduce((sum, line) => sum + line.length, 0) / nonEmptyLines.length,
      },
      quality: {
        score: Math.max(0, 100 - (cyclomaticComplexity * 5) - (codeSmells.length * 10)),
        issues: codeSmells,
        suggestions: this.generateSuggestions(codeSmells),
      },
      language,
    };
  }

  private calculateCyclomaticComplexity(code: string): number {
    // 简化的圈复杂度计算
    const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||'];
    let complexity = 1; // 基础复杂度

    for (const keyword of complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private detectCodeSmells(code: string): string[] {
    const smells: string[] = [];
    
    // 检测长行
    const lines = code.split('\n');
    if (lines.some(line => line.length > 120)) {
      smells.push('Long lines detected (>120 characters)');
    }

    // 检测深度嵌套
    const maxIndentation = Math.max(...lines.map(line => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    }));
    
    if (maxIndentation > 16) {
      smells.push('Deep nesting detected');
    }

    // 检测重复代码
    const duplicateLines = this.findDuplicateLines(lines);
    if (duplicateLines.length > 0) {
      smells.push(`Duplicate code detected: ${duplicateLines.length} duplicate lines`);
    }

    return smells;
  }

  private findDuplicateLines(lines: string[]): string[] {
    const lineCount: Record<string, number> = {};
    const duplicates: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10) { // 只检查有意义的行
        lineCount[trimmed] = (lineCount[trimmed] || 0) + 1;
      }
    }

    for (const [line, count] of Object.entries(lineCount)) {
      if (count > 1) {
        duplicates.push(line);
      }
    }

    return duplicates;
  }

  private generateSuggestions(codeSmells: string[]): string[] {
    const suggestions: string[] = [];
    
    for (const smell of codeSmells) {
      if (smell.includes('Long lines')) {
        suggestions.push('Consider breaking long lines into multiple lines');
      }
      if (smell.includes('Deep nesting')) {
        suggestions.push('Consider extracting nested code into separate functions');
      }
      if (smell.includes('Duplicate code')) {
        suggestions.push('Consider extracting duplicate code into reusable functions');
      }
    }

    return suggestions;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 简化的文件系统工具
class SimpleFileSystemTool extends SimpleBaseTool {
  constructor() {
    super({
      name: 'simple_file_system',
      description: 'Simple file system operations',
      version: '1.0.0',
      category: 'system',
      type: 'system',
      priority: ToolPriority.NORMAL,
      tags: ['filesystem', 'io'],
      enabled: true,
      timeout: 30000,
      retries: 0,
      metadata: {},
    });
  }

  protected async executeInternal(
    args?: Record<string, any>,
    options?: ToolExecutionOptions
  ): Promise<ToolResult> {
    const startTime = new Date();
    const operation = args?.operation || 'info';

    switch (operation) {
      case 'info':
        return this.createResult(
          true,
          'File system tool ready',
          { operations: ['info', 'test'] },
          {},
          startTime
        );

      case 'test':
        await this.delay(100);
        return this.createResult(
          true,
          'File system test completed',
          { result: 'ok' },
          {},
          startTime
        );

      default:
        return this.createResult(
          false,
          `Unknown operation: ${operation}`,
          undefined,
          {},
          startTime
        );
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 工具系统基础示例
 */
async function basicToolSystemExample(): Promise<void> {
  console.log('\n🔧 工具系统基础示例\n');

  const toolManager = ToolManager.getInstance();

  // 创建和注册工具
  const fileSystemTool = new SimpleFileSystemTool();
  const aiTool = new AIAnalysisTool();
  const codeTool = new CodeAnalysisTool();

  console.log('注册工具...');
  await toolManager.registerMany([fileSystemTool, aiTool, codeTool]);

  // 获取工具统计信息
  const stats = toolManager.getStatistics();
  console.log(`✅ 已注册 ${stats.totalTools} 个工具`);

  // 按类型列出工具
  const systemTools = toolManager.getToolsByType('system');
  const aiTools = toolManager.getToolsByType('ai');
  const analysisTools = toolManager.getToolsByType('analysis');

  console.log(`📁 系统工具: ${systemTools.length} 个`);
  console.log(`🤖 AI工具: ${aiTools.length} 个`);
  console.log(`📊 分析工具: ${analysisTools.length} 个`);

  // 搜索工具
  const searchResults = toolManager.searchTools('analysis');
  console.log(`🔍 搜索 "analysis": 找到 ${searchResults.length} 个工具`);

  // 清理
  await toolManager.reset();
}

/**
 * 文件系统工具示例
 */
async function fileSystemToolExample(): Promise<void> {
  console.log('\n📁 文件系统工具示例\n');

  const toolManager = ToolManager.getInstance();
  const fileSystemTool = new SimpleFileSystemTool();

  await toolManager.register(fileSystemTool);

  try {
    // 获取工具信息
    console.log('获取工具信息...');
    const infoResult = await toolManager.executeTool(fileSystemTool.id, {
      operation: 'info',
    });
    console.log(`📄 工具信息: ${infoResult.message}`);
    console.log(`📊 可用操作: ${infoResult.data?.operations.join(', ')}`);

    // 执行测试操作
    console.log('执行测试操作...');
    const testResult = await toolManager.executeTool(fileSystemTool.id, {
      operation: 'test',
    });
    console.log(`✅ 测试结果: ${testResult.message}`);

  } finally {
    console.log('✅ 文件系统工具示例完成');
  }

  await toolManager.reset();
}

/**
 * AI分析工具示例
 */
async function aiAnalysisToolExample(): Promise<void> {
  console.log('\n🤖 AI分析工具示例\n');

  const toolManager = ToolManager.getInstance();
  const aiTool = new AIAnalysisTool();
  
  await toolManager.register(aiTool);

  const sampleText = `
    This is an amazing product! I'm really impressed with the quality and features.
    The user interface is excellent and very intuitive. However, the documentation
    could be better. Overall, it's a wonderful tool that I would recommend to others.
    The performance is great and it handles complex tasks efficiently.
  `;

  // 情感分析
  console.log('执行情感分析...');
  const sentimentResult = await toolManager.executeTool(aiTool.id, {
    text: sampleText,
    analysisType: 'sentiment',
  });
  console.log(`😊 情感: ${sentimentResult.data?.sentiment} (置信度: ${(sentimentResult.data?.confidence * 100).toFixed(1)}%)`);

  // 关键词提取
  console.log('提取关键词...');
  const keywordResult = await toolManager.executeTool(aiTool.id, {
    text: sampleText,
    analysisType: 'keywords',
  });
  console.log(`🔑 关键词: ${keywordResult.data?.keywords.slice(0, 5).map((k: any) => k.word).join(', ')}`);

  // 文本摘要
  console.log('生成摘要...');
  const summaryResult = await toolManager.executeTool(aiTool.id, {
    text: sampleText,
    analysisType: 'summary',
  });
  console.log(`📝 摘要: ${summaryResult.data?.summary}`);

  await toolManager.reset();
}

/**
 * 代码分析工具示例
 */
async function codeAnalysisToolExample(): Promise<void> {
  console.log('\n📊 代码分析工具示例\n');

  const toolManager = ToolManager.getInstance();
  const codeTool = new CodeAnalysisTool();
  
  await toolManager.register(codeTool);

  const sampleCode = `
function complexFunction(data) {
  if (data && data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      if (data[i].type === 'important') {
        if (data[i].value > 100) {
          if (data[i].status === 'active') {
            console.log('Processing important active item with high value');
            processItem(data[i]);
          } else {
            console.log('Item is not active');
          }
        } else {
          console.log('Value is too low');
        }
      } else {
        console.log('Item is not important');
      }
    }
  } else {
    console.log('No data provided');
  }
}
  `;

  console.log('分析代码质量...');
  const analysisResult = await toolManager.executeTool(codeTool.id, {
    code: sampleCode,
    language: 'javascript',
  });

  const metrics = analysisResult.data?.metrics;
  const quality = analysisResult.data?.quality;

  console.log(`📏 代码行数: ${metrics?.totalLines} (有效: ${metrics?.codeLines})`);
  console.log(`🔄 圈复杂度: ${metrics?.cyclomaticComplexity}`);
  console.log(`⭐ 质量评分: ${quality?.score}/100`);
  console.log(`⚠️ 发现问题: ${quality?.issues?.length || 0} 个`);
  
  if (quality?.issues?.length > 0) {
    console.log('问题列表:');
    quality.issues.forEach((issue: string, index: number) => {
      console.log(`  ${index + 1}. ${issue}`);
    });
  }

  if (quality?.suggestions?.length > 0) {
    console.log('改进建议:');
    quality.suggestions.forEach((suggestion: string, index: number) => {
      console.log(`  ${index + 1}. ${suggestion}`);
    });
  }

  await toolManager.reset();
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('🚀 MetaGPT.TS 工具系统示例');
  console.log('=====================================');

  try {
    await basicToolSystemExample();
    await fileSystemToolExample();
    await aiAnalysisToolExample();
    await codeAnalysisToolExample();
    
    console.log('\n✅ 所有工具系统示例执行完成!');
    console.log('\n🎯 工具系统功能总结:');
    console.log('  ✅ 增强的工具基类 - 类型安全和状态管理');
    console.log('  ✅ 工具管理器 - 注册、发现和执行');
    console.log('  ✅ 文件系统工具 - 完整的文件操作');
    console.log('  ✅ AI分析工具 - 智能文本分析');
    console.log('  ✅ 代码分析工具 - 代码质量评估');
    console.log('  ✅ 系统集成 - 与核心架构无缝集成');

    // 确保程序正常退出
    console.log('\n🔄 正在清理资源并退出...');
    setTimeout(() => {
      console.log('✅ 程序已正常退出');
      process.exit(0);
    }, 100);

  } catch (error) {
    console.error('❌ 示例执行失败:', error);
    process.exit(1);
  }
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}

export {
  basicToolSystemExample,
  fileSystemToolExample,
  aiAnalysisToolExample,
  codeAnalysisToolExample,
  AIAnalysisTool,
  CodeAnalysisTool,
};
