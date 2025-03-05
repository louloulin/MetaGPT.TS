import { BaseRAG } from './base-rag';
import type { RAGConfig, SearchResult } from '../types/rag';

/**
 * 文档问答系统
 * 基于RAG的文档智能问答
 */
export class DocumentQA extends BaseRAG {
  constructor(config: RAGConfig) {
    super(config);
  }

  /**
   * 生成带引用的回答
   * @param query 查询文本
   */
  public async generateWithCitations(
    query: string
  ): Promise<{ answer: string; citations: SearchResult[] }> {
    // 搜索相关文档
    const results = await this.search(query);
    if (results.length === 0) {
      return {
        answer: 'No relevant information found.',
        citations: [],
      };
    }

    // 构建提示词
    const prompt = this.buildPrompt(query, results);

    // 生成回答
    const answer = await this.llm.generate(prompt);

    return {
      answer,
      citations: results,
    };
  }

  /**
   * 智能分块
   * @param text 文本内容
   */
  protected async chunkText(text: string): Promise<string[]> {
    // 按段落分块
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // 如果当前块加上新段落不超过最大大小，则合并
      if (
        currentChunk.length + paragraph.length + 1 <= this.config.chunkSize ||
        currentChunk.length === 0
      ) {
        currentChunk = currentChunk
          ? `${currentChunk}\n\n${paragraph}`
          : paragraph;
      } else {
        // 否则保存当前块并开始新块
        chunks.push(currentChunk);
        currentChunk = paragraph;
      }
    }

    // 添加最后一个块
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * 构建提示词
   * @param query 查询文本
   * @param results 搜索结果
   */
  protected buildPrompt(query: string, results: SearchResult[]): string {
    return `
You are a helpful assistant that provides accurate answers based on the given reference passages.
Please answer the question and cite the relevant passages using [1], [2], etc.

Question: ${query}

Reference passages:
${results.map((r, i) => `[${i + 1}] ${r.chunk.content}`).join('\n\n')}

Instructions:
1. Use information from the reference passages to answer the question
2. Cite sources using [1], [2], etc.
3. If the passages don't contain enough information, say so
4. Keep the answer concise and relevant

Answer:`.trim();
  }
} 