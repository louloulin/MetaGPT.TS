/**
 * 工具推荐器接口
 */
export interface ToolRecommender {
  getRecommendedToolInfo(context: string, plan?: any): Promise<string>;
}

/**
 * BM25 工具推荐器
 */
export declare class BM25ToolRecommender implements ToolRecommender {
  constructor(tools: string[]);
  getRecommendedToolInfo(context: string, plan?: any): Promise<string>;
} 