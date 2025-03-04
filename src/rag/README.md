# MetaGPT-TS RAG 系统

MetaGPT-TS 提供了两种 RAG（检索增强生成）实现，满足不同的使用场景：

## 1. EnhancedRAG

基于 LlamaIndex 的增强型 RAG 系统，提供强大的向量搜索能力。

### 特点

- 基于 LlamaIndex 构建，支持高级向量搜索
- 集成各种向量数据库（例如 Pinecone、Milvus 等）
- 提供完整的文档处理和分块策略
- 支持混合检索方法，结合语义和关键词搜索
- 高级重排序功能提高检索精确度

### 局限性

- 依赖 OpenAI API 进行嵌入生成
- 需要 API 密钥和外部服务
- 资源消耗较高

### 使用示例

```typescript
import { EnhancedRAG } from '../src/rag/enhanced-rag';
import { createLLMProvider } from './llm-provider';

// 创建 RAG 系统
const rag = new EnhancedRAG(createLLMProvider(
  '你是一位RAG助手...'
), {
  topK: 3,
  chunkSize: 1000,
  chunkOverlap: 200,
});

// 添加文档
await rag.addDocuments([
  {
    content: '文档内容...',
    metadata: { 
      source: 'example-docs',
      category: 'tutorial',
      level: 'beginner'
    }
  }
]);

// 生成回答
const result = await rag.generateWithResults('查询问题...');
```

## 2. CustomRAG

轻量级 RAG 实现，不依赖外部 API，完全使用用户提供的 LLM 提供者。

### 特点

- 零外部依赖，不需要 OpenAI API 密钥
- 简单高效的关键词检索算法
- 支持丰富的元数据过滤功能
- 内存占用低，适合资源受限环境
- 易于定制和扩展

### 使用示例

```typescript
import { CustomRAG } from '../src/rag/custom-rag';
import { createLLMProvider } from './llm-provider';

// 创建 CustomRAG 实例
const rag = new CustomRAG(createLLMProvider('系统提示...'), {
  topK: 3
});

// 添加文档
await rag.addDocuments([{
  content: '文档内容...',
  metadata: { 
    category: 'tutorial',
    level: 'beginner'
  }
}]);

// 基本查询
const result1 = await rag.generateWithResults('查询问题...');

// 使用元数据过滤
const result2 = await rag.generateWithResults('查询问题...', {
  filter: (doc) => doc.metadata.level === 'beginner'
});
```

## 功能比较

| 功能 | EnhancedRAG | CustomRAG |
|------|------------|-----------|
| 向量搜索 | ✅ | ❌ |
| 关键词搜索 | ✅ | ✅ |
| 元数据过滤 | ✅ | ✅ |
| OpenAI 依赖 | 是 | 否 |
| 内存效率 | 中等 | 高 |
| 适用场景 | 需要高精度检索 | 资源受限环境、无API密钥场景 |

## 最佳实践

1. **选择合适的 RAG 实现**
   - 如果有 OpenAI API 密钥并需要高精度向量搜索，选择 EnhancedRAG
   - 如果需要轻量级实现或没有外部API密钥，选择 CustomRAG

2. **优化文档结构**
   - 添加丰富的元数据标记，便于过滤和组织
   - 保持文档内容简洁、聚焦特定主题

3. **有效使用过滤器**
   - 使用元数据过滤缩小搜索范围，提高相关性
   - 根据查询内容动态调整过滤条件 