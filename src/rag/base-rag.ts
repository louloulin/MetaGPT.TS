import { QdrantClient } from '@qdrant/js-client-rest';
import type { RAGConfig, RAGSystem, Chunk, SearchResult } from '../types/rag';
import { v4 as uuidv4 } from 'uuid';

/**
 * 基础RAG系统实现
 */
export class BaseRAG implements RAGSystem {
  protected config: RAGConfig;
  protected llm: any; // LLMProvider
  protected vectorStore: QdrantClient;

  constructor(config: RAGConfig) {
    this.config = config;
    this.llm = config.llm;
    this.vectorStore = new QdrantClient({
      url: config.vectorStore.url,
      apiKey: config.vectorStore.apiKey,
    });
  }

  /**
   * 添加文档
   * @param content 文档内容
   * @param metadata 文档元数据
   */
  public async addDocument(
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<Chunk[]> {
    // 分块
    const chunks = await this.chunkText(content);

    // 生成嵌入向量
    const embeddings = await Promise.all(
      chunks.map(chunk => this.llm.generateEmbedding(chunk))
    );

    // 创建文档块
    const chunkObjects = chunks.map((chunk, i) => ({
      id: uuidv4(),
      content: chunk,
      embedding: embeddings[i],
      metadata: {
        ...metadata,
        timestamp: Date.now(),
      },
    }));

    // 存储向量
    await this.vectorStore.upsert(this.config.vectorStore.collectionName, {
      points: chunkObjects.map(chunk => ({
        id: chunk.id,
        vector: chunk.embedding,
        payload: {
          content: chunk.content,
          metadata: chunk.metadata,
        },
      })),
    });

    return chunkObjects;
  }

  /**
   * 删除文档块
   * @param ids 块ID列表
   */
  public async deleteChunks(ids: string[]): Promise<void> {
    await this.vectorStore.delete(this.config.vectorStore.collectionName, {
      points: ids,
    });
  }

  /**
   * 更新文档块
   * @param chunk 文档块
   */
  public async updateChunk(chunk: Chunk): Promise<void> {
    await this.vectorStore.upsert(this.config.vectorStore.collectionName, {
      points: [
        {
          id: chunk.id,
          vector: chunk.embedding,
          payload: {
            content: chunk.content,
            metadata: chunk.metadata,
          },
        },
      ],
    });
  }

  /**
   * 搜索相关文档
   * @param query 查询文本
   * @param topK 返回结果数量
   */
  public async search(
    query: string,
    topK: number = this.config.topK
  ): Promise<SearchResult[]> {
    // 生成查询向量
    const queryEmbedding = await this.llm.generateEmbedding(query);

    // 搜索相似向量
    const results = await this.vectorStore.search(
      this.config.vectorStore.collectionName,
      {
        vector: queryEmbedding,
        limit: topK,
        with_payload: true,
      }
    );

    // 转换结果格式
    return results
      .filter(result => result.payload && typeof result.payload === 'object')
      .map(result => ({
        chunk: {
          id: result.id as string,
          content: result.payload!.content as string,
          embedding: queryEmbedding as number[],
          metadata: result.payload!.metadata as Record<string, any>,
        },
        score: result.score,
        metadata: result.payload!.metadata as Record<string, any>,
      }));
  }

  /**
   * 生成回答
   * @param query 查询文本
   */
  public async generate(query: string): Promise<string> {
    // 搜索相关文档
    const results = await this.search(query);
    if (results.length === 0) {
      return 'No relevant information found.';
    }

    // 构建提示词
    const prompt = this.buildPrompt(query, results);

    // 生成回答
    return await this.llm.generate(prompt);
  }

  /**
   * 分块文本
   * @param text 文本内容
   */
  protected async chunkText(text: string): Promise<string[]> {
    // 简单按长度分块，子类可以重写此方法实现更智能的分块
    const chunks: string[] = [];
    let currentChunk = '';

    const words = text.split(/\s+/);
    for (const word of words) {
      if (
        currentChunk.length + word.length + 1 <= this.config.chunkSize ||
        currentChunk.length === 0
      ) {
        currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
      } else {
        chunks.push(currentChunk);
        currentChunk = word;
      }
    }

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
Based on the following passages, please answer the question.

Question: ${query}

Relevant passages:
${results.map(r => r.chunk.content).join('\n\n')}

Answer:`.trim();
  }
} 