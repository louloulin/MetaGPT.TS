# MetaGPT-TS 知识图谱系统

MetaGPT-TS 知识图谱系统是一个强大的知识表示和推理框架，旨在帮助智能体构建、管理和利用结构化知识。本系统支持实体关系抽取、知识图谱查询、推理和可视化等功能。

## 核心功能

- **分布式知识图谱**：支持跨多个节点共享和同步知识图谱
- **实体关系抽取**：从文本中提取实体、关系和三元组
- **知识图谱查询**：支持路径查找、模式匹配和自然语言查询
- **知识推理**：基于现有知识推断新的知识
- **知识图谱可视化**：支持多种可视化格式，包括D3.js、Cytoscape.js、GraphViz和JSON-LD

## 系统架构

知识图谱系统由以下核心组件组成：

1. **KnowledgeGraphManager**：管理知识图谱的节点和边，支持分布式操作
2. **KGIndexManager**：索引管理器，提供高效的图查询支持
3. **EntityRelationExtractor**：从文本中提取实体、关系和三元组
4. **KGQueryEngine**：提供高级查询和推理功能
5. **KGVisualizer**：将知识图谱转换为各种可视化格式

## 快速开始

### 安装

知识图谱系统是MetaGPT-TS的一部分，无需单独安装。

### 基本用法

```typescript
import { KnowledgeGraphManager } from '../knowledge/distributed-kg';
import { EntityRelationExtractor } from '../knowledge/entity-relation-extractor';
import { KGQueryEngine } from '../knowledge/kg-query-engine';
import { KGVisualizer } from '../knowledge/kg-visualizer';
import { OpenAIProvider } from '../llm/openai-provider';

// 初始化LLM提供者
const llmProvider = new OpenAIProvider({
  apiKey: 'your-api-key',
  defaultModel: 'gpt-4-turbo',
});

// 初始化知识图谱管理器
const kgManager = new KnowledgeGraphManager();

// 初始化实体关系抽取器
const entityExtractor = new EntityRelationExtractor({
  llmProvider,
  confidenceThreshold: 0.7,
});

// 初始化查询引擎
const queryEngine = new KGQueryEngine({
  llmProvider,
  maxPathLength: 3,
});

// 初始化可视化工具
const visualizer = new KGVisualizer();

// 从文本中提取知识
const text = 'Apple Inc. is a technology company headquartered in Cupertino, California.';
const extractionResult = await entityExtractor.extractTriples(text);

// 将提取的知识添加到图谱
const { nodes, edges } = entityExtractor.convertToKnowledgeGraph(
  extractionResult.entities,
  extractionResult.relations
);

nodes.forEach(node => kgManager.addNode(node));
edges.forEach(edge => kgManager.addEdge(edge));

// 查询知识图谱
const queryResult = await queryEngine.query(kgManager, "Where is Apple headquartered?");
console.log(queryResult.answer);

// 可视化知识图谱
const allNodes = kgManager.getAllNodes();
const allEdges = kgManager.getAllEdges();
const d3Format = visualizer.toD3Format(allNodes, allEdges);
```

## 详细组件说明

### KnowledgeGraphManager

分布式知识图谱管理器，负责管理知识图谱的节点和边，支持跨多个节点共享和同步知识。

```typescript
// 创建知识图谱管理器
const kgManager = new KnowledgeGraphManager();

// 添加节点
const node = {
  id: 'apple-inc',
  type: 'Organization',
  properties: {
    name: 'Apple Inc.',
    founded: 1976,
  },
};
kgManager.addNode(node);

// 添加边
const edge = {
  id: 'apple-hq-relation',
  sourceId: 'apple-inc',
  targetId: 'cupertino',
  type: 'headquarteredIn',
  properties: {
    since: 1977,
  },
};
kgManager.addEdge(edge);

// 获取节点和边
const retrievedNode = kgManager.getNode('apple-inc');
const retrievedEdge = kgManager.getEdge('apple-hq-relation');

// 获取所有节点和边
const allNodes = kgManager.getAllNodes();
const allEdges = kgManager.getAllEdges();

// 获取节点和边的数量
const nodeCount = kgManager.getNodeCount();
const edgeCount = kgManager.getEdgeCount();
```

### EntityRelationExtractor

从文本中提取实体、关系和三元组，并将其转换为知识图谱节点和边。

```typescript
// 创建实体关系抽取器
const entityExtractor = new EntityRelationExtractor({
  llmProvider,
  confidenceThreshold: 0.7,
  maxEntities: 10,
  maxRelations: 15,
});

// 从文本中提取三元组
const text = 'Apple Inc. is a technology company headquartered in Cupertino, California.';
const extractionResult = await entityExtractor.extractTriples(text);

// 提取的实体
console.log(extractionResult.entities);
// 提取的关系
console.log(extractionResult.relations);
// 提取的三元组
console.log(extractionResult.triples);

// 将提取的知识转换为知识图谱节点和边
const { nodes, edges } = entityExtractor.convertToKnowledgeGraph(
  extractionResult.entities,
  extractionResult.relations
);
```

### KGQueryEngine

提供高级查询和推理功能，包括路径查找、模式匹配、自然语言查询和知识推理。

```typescript
// 创建查询引擎
const queryEngine = new KGQueryEngine({
  llmProvider,
  maxPathLength: 3,
  maxPaths: 5,
  useLLMForReasoning: true,
});

// 查找两个节点之间的路径
const paths = await queryEngine.findPaths(kgManager, 'apple-inc', 'tim-cook');

// 自然语言查询
const queryResult = await queryEngine.query(kgManager, "Who is the CEO of Apple?");
console.log(queryResult.answer);
console.log(queryResult.relevantNodes);

// 推理新知识
const inferenceResult = await queryEngine.inferNewKnowledge(
  kgManager,
  "What products might Apple develop?"
);
console.log(inferenceResult.inference);
console.log(inferenceResult.confidence);
console.log(inferenceResult.newNodes);
console.log(inferenceResult.newEdges);
```

### KGVisualizer

将知识图谱转换为各种可视化格式，包括通用格式、D3.js、Cytoscape.js、GraphViz和JSON-LD。

```typescript
// 创建可视化工具
const visualizer = new KGVisualizer({
  nodeColorMap: {
    Person: '#ff7f0e',
    Organization: '#1f77b4',
    Location: '#2ca02c',
  },
});

// 获取所有节点和边
const allNodes = kgManager.getAllNodes();
const allEdges = kgManager.getAllEdges();

// 转换为通用可视化格式
const visGraph = visualizer.toVisGraph(allNodes, allEdges);

// 转换为D3.js格式
const d3Format = visualizer.toD3Format(allNodes, allEdges);

// 转换为Cytoscape.js格式
const cytoscapeFormat = visualizer.toCytoscapeFormat(allNodes, allEdges);

// 转换为GraphViz DOT格式
const dotFormat = visualizer.toDotFormat(allNodes, allEdges);

// 转换为JSON-LD格式
const jsonLdFormat = visualizer.toJsonLd(allNodes, allEdges);
```

## 高级用例

### 构建领域知识图谱

```typescript
// 从多个文档中提取知识
const documents = [
  '文档1内容...',
  '文档2内容...',
  '文档3内容...',
];

// 初始化知识图谱
const kgManager = new KnowledgeGraphManager();
const entityExtractor = new EntityRelationExtractor({ llmProvider });

// 处理每个文档
for (const doc of documents) {
  const extractionResult = await entityExtractor.extractTriples(doc);
  const { nodes, edges } = entityExtractor.convertToKnowledgeGraph(
    extractionResult.entities,
    extractionResult.relations
  );
  
  // 添加到知识图谱
  nodes.forEach(node => kgManager.addNode(node));
  edges.forEach(edge => kgManager.addEdge(edge));
}

// 保存知识图谱
const allNodes = kgManager.getAllNodes();
const allEdges = kgManager.getAllEdges();
const jsonLdFormat = visualizer.toJsonLd(allNodes, allEdges);
fs.writeFileSync('domain-knowledge.json', JSON.stringify(jsonLdFormat, null, 2));
```

### 知识图谱增强的问答

```typescript
// 初始化组件
const kgManager = new KnowledgeGraphManager();
const queryEngine = new KGQueryEngine({ llmProvider });

// 加载预先构建的知识图谱
const knowledgeData = JSON.parse(fs.readFileSync('domain-knowledge.json', 'utf-8'));
// 将知识数据转换为节点和边并添加到图谱

// 执行知识增强的问答
async function answerQuestion(question) {
  // 查询知识图谱
  const queryResult = await queryEngine.query(kgManager, question);
  
  // 使用查询结果增强LLM回答
  const prompt = `
    Question: ${question}
    
    Relevant knowledge:
    ${JSON.stringify(queryResult.relevantNodes, null, 2)}
    
    Please answer the question based on the relevant knowledge.
  `;
  
  const answer = await llmProvider.generateText(prompt);
  return answer;
}

// 使用
const answer = await answerQuestion("What products does Apple make?");
console.log(answer);
```

## 最佳实践

1. **设置合适的置信度阈值**：在实体关系抽取中，调整`confidenceThreshold`以平衡精度和召回率。
2. **分批处理大文本**：对于长文档，将其分成较小的段落进行处理，然后合并结果。
3. **定期同步分布式知识图谱**：如果使用分布式功能，确保定期同步节点之间的知识。
4. **使用自定义颜色映射**：为不同类型的节点和边设置不同的颜色，以提高可视化效果。
5. **结合LLM推理**：对于复杂查询，启用`useLLMForReasoning`选项以获得更好的结果。

## 限制和注意事项

- 实体关系抽取的质量依赖于底层LLM的能力。
- 大型知识图谱可能需要优化索引和查询策略。
- 分布式同步可能会在网络不稳定时遇到挑战。

## 未来计划

- 支持更多知识图谱格式和标准
- 增强推理能力，支持更复杂的逻辑推理
- 改进实体链接和消歧功能
- 集成更多可视化库和工具
- 支持时态知识和不确定性表示 