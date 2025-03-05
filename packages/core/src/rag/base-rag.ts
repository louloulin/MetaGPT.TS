import { QdrantClient } from '@qdrant/js-client-rest';
import type { RAGConfig, RAGSystem, Chunk, SearchResult } from '../types/rag';
import { v4 as uuidv4 } from 'uuid';
import type { Document } from '../types/document';
import { TextNormalizerTransformer } from '../document/document-store';
import { DocumentImpl } from '../types/document';

/**
 * 基础RAG系统实现
 */
export class BaseRAG implements RAGSystem {
  protected config: RAGConfig;
  protected llm: any; // LLMProvider
  protected vectorStore: QdrantClient;
  
  /**
   * 创建一个基础RAG系统
   * @param config RAG系统配置
   */
  constructor(config: RAGConfig) {
    this.config = config;
    this.llm = config.llm;
    this.vectorStore = new QdrantClient({
      url: config.vectorStore.url,
      apiKey: config.vectorStore.apiKey,
    });
    
    this.initializeCollection();
  }
  
  /**
   * 初始化向量存储集合
   */
  protected async initializeCollection(): Promise<void> {
    try {
      // 检查集合是否存在
      const collections = await this.vectorStore.getCollections();
      const exists = collections.collections.some(
        c => c.name === this.config.vectorStore.collectionName
      );
      
      if (!exists) {
        // 将距离类型映射到Qdrant支持的类型
        let distanceType: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan';
        
        // 处理可能的距离类型
        switch(this.config.vectorStore.distance) {
          case 'Cosine':
            distanceType = 'Cosine';
            break;
          case 'Euclidean':
            distanceType = 'Euclid';
            break;
          case 'Dot':
            distanceType = 'Dot';
            break;
          default:
            distanceType = 'Cosine'; // 默认使用余弦相似度
        }
        
        // 创建新集合
        await this.vectorStore.createCollection(
          this.config.vectorStore.collectionName,
          {
            vectors: {
              size: this.config.vectorStore.dimension,
              distance: distanceType,
            }
          }
        );
        
        console.log(`Created vector collection: ${this.config.vectorStore.collectionName}`);
      }
    } catch (error) {
      console.error('Failed to initialize vector collection:', error);
      throw error;
    }
  }
  
  /**
   * 添加文档到RAG系统
   * @param content 文档内容
   * @param metadata 文档元数据
   * @returns 创建的文档块
   */
  public async addDocument(content: string, metadata: Record<string, any> = {}): Promise<Chunk[]> {
    try {
      // 创建文档对象
      const document = new DocumentImpl({
        content,
        name: metadata.title || `document-${Date.now()}`,
      });
      
      // 标准化文本
      const normalizer = new TextNormalizerTransformer();
      const normalizedDoc = await normalizer.transform(document);
      
      // 分块处理
      const chunks = this.chunkDocument(normalizedDoc, metadata);
      
      // 生成嵌入向量并存储
      await this.indexChunks(chunks);
      
      return chunks;
    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  }
  
  /**
   * 删除文档块
   * @param ids 文档块ID列表
   */
  public async deleteChunks(ids: string[]): Promise<void> {
    try {
      if (ids.length === 0) {
        return;
      }
      
      // 从向量存储中删除
      await this.vectorStore.delete(this.config.vectorStore.collectionName, {
        points: ids,
      });
      
      console.log(`Deleted ${ids.length} chunks from vector store`);
    } catch (error) {
      console.error('Failed to delete chunks:', error);
      throw error;
    }
  }
  
  /**
   * 更新文档块
   * @param chunk 文档块
   */
  public async updateChunk(chunk: Chunk): Promise<void> {
    try {
      // 确保块具有嵌入向量
      if (!chunk.embedding || chunk.embedding.length === 0) {
        chunk.embedding = await this.generateEmbedding(chunk.content);
      }
      
      // 更新向量存储中的块 - 使用upsert替代不存在的update方法
      await this.vectorStore.upsert(
        this.config.vectorStore.collectionName,
        {
          points: [{
            id: chunk.id,
            vector: chunk.embedding,
            payload: {
              content: chunk.content,
              metadata: chunk.metadata,
            },
          }],
        }
      );
      
      console.log(`Updated chunk ${chunk.id} in vector store`);
    } catch (error) {
      console.error('Failed to update chunk:', error);
      throw error;
    }
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
    try {
      // 生成查询向量
      const queryEmbedding = await this.generateEmbedding(query);
  
      // 搜索相似向量
      const results = await this.vectorStore.search(
        this.config.vectorStore.collectionName,
        {
          vector: queryEmbedding,
          limit: topK,
          with_payload: true,
          score_threshold: this.config.minScore,
        }
      );
  
      // 转换结果格式
      return results
        .filter(result => result.payload && typeof result.payload === 'object')
        .map(result => ({
          chunk: {
            id: result.id as string,
            content: result.payload!.content as string,
            embedding: queryEmbedding, // 使用查询向量作为替代
            metadata: result.payload!.metadata as Record<string, any>,
          },
          score: result.score,
          metadata: result.payload!.metadata as Record<string, any>,
        }));
    } catch (error) {
      console.error('Failed to search:', error);
      return [];
    }
  }
  
  /**
   * 生成回答
   * @param query 查询文本
   */
  public async generate(query: string): Promise<string> {
    try {
      // 搜索相关文档
      const results = await this.search(query);
      if (results.length === 0) {
        return 'No relevant information found.';
      }
  
      // 构建提示词
      const prompt = this.buildPrompt(query, results);
  
      // 生成回答
      return await this.llm.generate(prompt);
    } catch (error) {
      console.error('Failed to generate answer:', error);
      return `Error generating answer: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  /**
   * 分块处理文档
   * @param document 文档对象
   * @param metadata 额外元数据
   * @returns 文档块列表
   */
  protected chunkDocument(document: Document, metadata: Record<string, any> = {}): Chunk[] {
    const chunks: Chunk[] = [];
    const content = document.content;
    
    // 如果文档小于块大小，作为一个整块
    if (content.length <= this.config.chunkSize) {
      chunks.push(this.createChunk(content, metadata));
      return chunks;
    }
    
    // 分块处理
    let startIndex = 0;
    
    while (startIndex < content.length) {
      let endIndex = startIndex + this.config.chunkSize;
      
      // 如果不是文本结尾，尝试找到自然断点
      if (endIndex < content.length) {
        // 查找附近的自然断点
        const naturalBreak = content.indexOf('\n', endIndex - 20);
        
        if (naturalBreak !== -1 && naturalBreak < endIndex + 20) {
          endIndex = naturalBreak + 1;
        } else {
          const periodBreak = content.indexOf('. ', endIndex - 20);
          
          if (periodBreak !== -1 && periodBreak < endIndex + 20) {
            endIndex = periodBreak + 2;
          } else {
            const spaceBreak = content.lastIndexOf(' ', endIndex);
            
            if (spaceBreak !== -1 && spaceBreak > endIndex - 50) {
              endIndex = spaceBreak + 1;
            }
          }
        }
      } else {
        endIndex = content.length;
      }
      
      // 创建块
      const chunkContent = content.substring(startIndex, endIndex);
      const chunkMetadata = {
        ...metadata,
        start_index: startIndex,
        end_index: endIndex,
        chunk_index: chunks.length,
      };
      
      chunks.push(this.createChunk(chunkContent, chunkMetadata));
      
      // 移动到下一个块，考虑重叠
      startIndex = endIndex - this.config.chunkOverlap;
      
      // 确保我们在前进
      if (startIndex >= content.length || startIndex <= 0) {
        break;
      }
    }
    
    return chunks;
  }
  
  /**
   * 创建单个块
   * @param content 块内容
   * @param metadata 块元数据
   * @returns 块对象
   */
  protected createChunk(content: string, metadata: Record<string, any> = {}): Chunk {
    return {
      id: uuidv4(),
      content,
      embedding: [], // 稍后生成
      metadata,
    };
  }
  
  /**
   * 为块生成嵌入向量并编入索引
   * @param chunks 块列表
   */
  protected async indexChunks(chunks: Chunk[]): Promise<void> {
    try {
      if (chunks.length === 0) {
        return;
      }
      
      const points = [];
      
      // 为每个块生成嵌入向量
      for (const chunk of chunks) {
        // 生成嵌入向量
        if (!chunk.embedding || chunk.embedding.length === 0) {
          chunk.embedding = await this.generateEmbedding(chunk.content);
        }
        
        points.push({
          id: chunk.id,
          vector: chunk.embedding,
          payload: {
            content: chunk.content,
            metadata: chunk.metadata,
          },
        });
      }
      
      // 批量上传到向量存储
      await this.vectorStore.upsert(this.config.vectorStore.collectionName, {
        points,
      });
      
      console.log(`Indexed ${chunks.length} chunks to vector store`);
    } catch (error) {
      console.error('Failed to index chunks:', error);
      throw error;
    }
  }
  
  /**
   * 生成文本嵌入向量
   * @param text 输入文本
   * @returns 嵌入向量
   */
  protected async generateEmbedding(text: string): Promise<number[]> {
    if (!this.llm.embed) {
      throw new Error('LLM provider does not support embedding generation');
    }
    
    return await this.llm.embed(text);
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
${results.map((r, i) => `[${i + 1}] ${r.chunk.content}`).join('\n\n')}

Answer:`.trim();
  }
} 