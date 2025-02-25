import type { LLMProvider } from '../types/llm';

/**
 * 工具推荐器接口
 */
export interface ToolRecommender {
  getRecommendedToolInfo(context: string, plan?: any): Promise<string>;
}

/**
 * BM25 工具推荐器
 */
export class BM25ToolRecommender implements ToolRecommender {
  private tools: string[];

  constructor(tools: string[]) {
    this.tools = tools;
  }

  /**
   * 基于上下文和计划获取推荐工具信息
   */
  async getRecommendedToolInfo(context: string, plan?: any): Promise<string> {
    if (!context || this.tools.length === 0) {
      return '';
    }

    // Simple implementation returning all tools
    return `Available tools: ${this.tools.join(', ')}`;
  }
} 