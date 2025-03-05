import { z } from 'zod';
import type { LLMProvider } from './llm';

/**
 * 向量存储配置
 */
export const VectorStoreConfigSchema = z.object({
  /** 服务器URL */
  url: z.string(),
  /** 集合名称 */
  collectionName: z.string(),
  /** 向量维度 */
  dimension: z.number(),
  /** 距离度量方式 */
  distance: z.enum(['Cosine', 'Euclidean', 'Dot']),
  /** API密钥 */
  apiKey: z.string().optional(),
});

export type VectorStoreConfig = z.infer<typeof VectorStoreConfigSchema>;

/**
 * RAG系统配置
 */
export const RAGConfigSchema = z.object({
  /** LLM提供商 */
  llm: z.any(), // LLMProvider
  /** 向量存储配置 */
  vectorStore: VectorStoreConfigSchema,
  /** 分块大小 */
  chunkSize: z.number().default(1000),
  /** 分块重叠大小 */
  chunkOverlap: z.number().default(200),
  /** 检索结果数量 */
  topK: z.number().default(5),
  /** 最小相似度分数 */
  minScore: z.number().default(0.7),
});

export type RAGConfig = z.infer<typeof RAGConfigSchema>;

/**
 * 文档块结构
 */
export const ChunkSchema = z.object({
  /** 块ID */
  id: z.string(),
  /** 块内容 */
  content: z.string(),
  /** 块向量 */
  embedding: z.array(z.number()),
  /** 块元数据 */
  metadata: z.record(z.any()),
});

export type Chunk = z.infer<typeof ChunkSchema>;

/**
 * 搜索结果结构
 */
export const SearchResultSchema = z.object({
  /** 匹配的文档块 */
  chunk: ChunkSchema,
  /** 相似度分数 */
  score: z.number(),
  /** 结果元数据 */
  metadata: z.record(z.any()),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * RAG系统接口
 */
export interface RAGSystem {
  /** 添加文档 */
  addDocument(content: string, metadata?: Record<string, any>): Promise<Chunk[]>;
  /** 删除文档块 */
  deleteChunks(ids: string[]): Promise<void>;
  /** 更新文档块 */
  updateChunk(chunk: Chunk): Promise<void>;
  /** 搜索相关文档 */
  search(query: string, topK?: number): Promise<SearchResult[]>;
  /** 生成回答 */
  generate(query: string): Promise<string>;
} 