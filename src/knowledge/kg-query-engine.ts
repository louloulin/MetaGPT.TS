/**
 * Knowledge Graph Query Engine
 * 
 * Provides advanced querying and reasoning capabilities for the knowledge graph.
 * Supports path finding, pattern matching, and inference based on graph structure.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { KnowledgeGraphManager, type KnowledgeNode, type KnowledgeEdge } from './distributed-kg';
import type { LLMProvider } from '../types/llm';

/**
 * Represents a path in the knowledge graph
 */
export interface KGPath {
  /**
   * The nodes in the path
   */
  nodes: KnowledgeNode[];
  
  /**
   * The edges in the path
   */
  edges: KnowledgeEdge[];
  
  /**
   * The confidence score of the path
   */
  confidence: number;
}

/**
 * Represents the result of a knowledge graph query
 */
export interface KGQueryResult {
  /**
   * The answer to the query
   */
  answer: string;
  
  /**
   * The relevant nodes for the query
   */
  relevantNodes: string[];
  
  /**
   * The relevant edges for the query
   */
  relevantEdges: string[];
  
  /**
   * The reasoning process used to answer the query
   */
  reasoning?: string;
}

/**
 * Represents the result of a knowledge inference
 */
export interface KGInferenceResult {
  /**
   * The inferred knowledge
   */
  inference: string;
  
  /**
   * The confidence score of the inference
   */
  confidence: number;
  
  /**
   * New nodes inferred from the knowledge graph
   */
  newNodes: KnowledgeNode[];
  
  /**
   * New edges inferred from the knowledge graph
   */
  newEdges: KnowledgeEdge[];
}

/**
 * Configuration options for the knowledge graph query engine
 */
export interface KGQueryEngineOptions {
  /**
   * Maximum path length for path finding queries
   */
  maxPathLength: number;
  
  /**
   * Maximum number of paths to return
   */
  maxPaths: number;
  
  /**
   * Whether to use LLM for reasoning
   */
  useLLMForReasoning: boolean;
  
  /**
   * Default prompt template for reasoning
   */
  reasoningPrompt?: string;
}

/**
 * Default options for the knowledge graph query engine
 */
const DEFAULT_OPTIONS: KGQueryEngineOptions = {
  maxPathLength: 3,
  maxPaths: 5,
  useLLMForReasoning: true,
};

/**
 * Default prompt template for reasoning
 */
const DEFAULT_REASONING_PROMPT = `
You are analyzing a knowledge graph to answer a question. 
The nodes and edges from the graph are listed below:

Nodes:
{{nodes}}

Edges:
{{edges}}

Question: {{query}}

Based on the knowledge graph, please analyze the information and provide:
1. A detailed answer to the question
2. The reasoning process used to arrive at the answer
3. Any limitations or uncertainties in the answer

Provide your response in JSON format with the following structure:
{
  "answer": "the detailed answer to the question",
  "reasoning": "step-by-step reasoning process used to arrive at the answer",
  "confidence": 0.95 // a number between 0 and 1 indicating confidence in the answer
}
`;

/**
 * Default prompt template for inference
 */
const DEFAULT_INFERENCE_PROMPT = `
You are analyzing a knowledge graph to infer new knowledge.
The question is: {{query}}

The nodes and edges from the graph are listed below:

Nodes:
{{nodes}}

Edges:
{{edges}}

Based on the knowledge graph and the question, please infer new knowledge that isn't explicitly stated 
but can be reasonably deduced. Provide your response in JSON format with the following structure:
{
  "inference": "the inferred knowledge as a detailed explanation",
  "confidence": 0.85, // a number between 0 and 1 indicating confidence in the inference
  "newNodes": [
    {
      "id": "unique-id-1",
      "type": "entity type (e.g., Person, Organization, Concept)",
      "properties": {
        "name": "entity name",
        "property1": "value1"
      }
    }
  ],
  "newEdges": [
    {
      "id": "unique-id-2",
      "sourceId": "source-node-id",
      "targetId": "target-node-id",
      "type": "relation type (e.g., worksFor, hasProperty)",
      "properties": {
        "property1": "value1"
      }
    }
  ]
}
`;

/**
 * Knowledge Graph Query Engine
 * 
 * Provides advanced querying and reasoning capabilities for the knowledge graph.
 */
export class KGQueryEngine {
  private options: KGQueryEngineOptions;
  private llmProvider?: LLMProvider;
  
  /**
   * Creates a new KGQueryEngine
   * 
   * @param options - Configuration options for the query engine
   * @param llmProvider - The LLM provider for reasoning
   */
  constructor(options: Partial<KGQueryEngineOptions> & { llmProvider?: LLMProvider }) {
    const { llmProvider, ...restOptions } = options;
    this.options = { ...DEFAULT_OPTIONS, ...restOptions };
    this.llmProvider = llmProvider;
    
    // Validate options
    if (this.options.useLLMForReasoning && !this.llmProvider) {
      logger.warn('LLM reasoning is enabled but no LLM provider was specified. Disabling LLM reasoning.');
      this.options.useLLMForReasoning = false;
    } else if (this.llmProvider) {
      // 验证 LLMProvider 是否有必要的 generate 方法
      if (typeof this.llmProvider.generate !== 'function') {
        logger.warn('The provided LLM provider does not implement the required generate method. Disabling LLM reasoning.');
        this.options.useLLMForReasoning = false;
        this.llmProvider = undefined;
      }
    }
  }
  
  /**
   * Finds paths between two nodes in the knowledge graph
   * 
   * @param kgManager - The knowledge graph manager
   * @param startNodeId - The ID of the start node
   * @param endNodeId - The ID of the end node
   * @param relationTypes - Optional array of relation types to filter paths
   * @returns A promise that resolves to an array of paths
   */
  public async findPaths(
    kgManager: KnowledgeGraphManager,
    startNodeId: string,
    endNodeId: string,
    relationTypes?: string[]
  ): Promise<KGPath[]> {
    try {
      // Validate input
      const startNode = kgManager.getNode(startNodeId);
      const endNode = kgManager.getNode(endNodeId);
      
      if (!startNode) {
        throw new Error(`Start node with ID ${startNodeId} not found`);
      }
      
      if (!endNode) {
        throw new Error(`End node with ID ${endNodeId} not found`);
      }
      
      // Find paths using BFS
      const paths = this.bfsPathFinding(kgManager, startNodeId, endNodeId, relationTypes);
      
      // Sort paths by confidence and limit to maxPaths
      return paths
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.options.maxPaths);
    } catch (error) {
      logger.error('Error finding paths:', error);
      return [];
    }
  }
  
  /**
   * Queries the knowledge graph using natural language
   * 
   * @param kgManager - The knowledge graph manager
   * @param query - The natural language query
   * @returns A promise that resolves to a query result
   */
  public async query(
    kgManager: KnowledgeGraphManager,
    query: string
  ): Promise<KGQueryResult> {
    try {
      // Extract entities from the query
      const queryEntities = await this.extractQueryEntities(query);
      
      // Find relevant nodes based on entity mentions
      const relevantNodeIds: string[] = [];
      const relevantNodes: KnowledgeNode[] = [];
      const relevantEdges: KnowledgeEdge[] = [];
      
      // 获取所有节点 - 使用类型过滤和属性搜索
      let allNodes: KnowledgeNode[] = [];
      
      // 尝试使用实体名称搜索节点
      for (const entity of queryEntities) {
        const matchingNodes = kgManager.searchNodes(entity);
        allNodes = [...allNodes, ...matchingNodes];
      }
      
      // 如果搜索没有返回结果，尝试按类型获取节点
      if (allNodes.length === 0) {
        for (const entity of queryEntities) {
          const typeNodes = kgManager.queryNodesByType(entity);
          allNodes = [...allNodes, ...typeNodes];
        }
      }
      
      // Find nodes that match the query entities
      for (const node of allNodes) {
        const nodeName = node.properties.name as string || '';
        const nodeType = node.type;
        
        // Check if the node name or type matches any query entity
        const nameMatches = queryEntities.some((entity: string) => 
          nodeName.toLowerCase().includes(entity.toLowerCase()));
        
        const typeMatches = queryEntities.some((entity: string) => 
          nodeType.toLowerCase().includes(entity.toLowerCase()));
        
        if (nameMatches || typeMatches) {
          // 避免重复添加
          if (!relevantNodeIds.includes(node.id)) {
            relevantNodeIds.push(node.id);
            relevantNodes.push(node);
          }
        }
      }
      
      // 获取所有边 - 遍历节点获取连接的边
      for (const nodeId of relevantNodeIds) {
        // 收集与节点连接的所有节点
        const connectedNodes = kgManager.getConnectedNodes(nodeId);
        
        // 将连接的节点添加到相关节点列表中
        for (const connectedNode of connectedNodes) {
          if (!relevantNodeIds.includes(connectedNode.id)) {
            relevantNodeIds.push(connectedNode.id);
            relevantNodes.push(connectedNode);
          }
        }
      }
      
      // 现在收集与相关节点关联的边
      for (let i = 0; i < relevantNodeIds.length; i++) {
        for (let j = i + 1; j < relevantNodeIds.length; j++) {
          const sourceId = relevantNodeIds[i];
          const targetId = relevantNodeIds[j];
          
          // 检查节点之间是否有边
          // 由于没有直接的方法获取两个节点之间的边，我们需要间接方式处理
          const connectedNodes = kgManager.getConnectedNodes(sourceId);
          
          // 如果目标节点在源节点的连接节点中，那么它们之间有边
          if (connectedNodes.some(node => node.id === targetId)) {
            // 注意：此方法不能获取确切的边对象，只能确定存在连接
            // 在真实实现中，需要扩展 KnowledgeGraphManager 提供这样的方法
            // 这里我们创建一个模拟的边
            const edgeId = `${sourceId}-to-${targetId}`;
            relevantEdges.push({
              id: edgeId,
              sourceId: sourceId,
              targetId: targetId,
              type: 'connected',
              properties: {},
              created: Date.now(),
              updated: Date.now(),
              version: 1
            });
          }
        }
      }
      
      // If no relevant nodes were found, return an empty result
      if (relevantNodes.length === 0) {
        return {
          answer: "I couldn't find any relevant information in the knowledge graph to answer this question.",
          relevantNodes: [],
          relevantEdges: [],
        };
      }
      
      // Generate reasoning using LLM
      let reasoning: string | undefined;
      let answer = "Based on the knowledge graph, I found some relevant information but need more context to provide a specific answer.";
      
      if (this.options.useLLMForReasoning && this.llmProvider) {
        const reasoningResult = await this.generateReasoning(query, relevantNodes, relevantEdges);
        
        if (reasoningResult) {
          try {
            const jsonMatch = reasoningResult.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              reasoning = parsed.reasoning;
              answer = parsed.answer;
            } else {
              // If no JSON found, use the whole response as the answer
              answer = reasoningResult;
            }
          } catch (parseError) {
            logger.warn('Error parsing reasoning result:', parseError);
            answer = reasoningResult;
          }
        }
      } else {
        // Simple answer without LLM reasoning
        answer = `Found ${relevantNodes.length} relevant nodes and ${relevantEdges.length} relevant edges in the knowledge graph.`;
      }
      
      return {
        answer,
        relevantNodes: relevantNodeIds,
        relevantEdges: relevantEdges.map(edge => edge.id),
        reasoning,
      };
    } catch (error) {
      logger.error('Error querying knowledge graph:', error);
      return {
        answer: "An error occurred while querying the knowledge graph.",
        relevantNodes: [],
        relevantEdges: [],
      };
    }
  }
  
  /**
   * Performs pattern matching on the knowledge graph
   * 
   * @param kgManager - The knowledge graph manager
   * @param pattern - The pattern to match
   * @returns A promise that resolves to an array of matches
   */
  public async matchPattern(
    kgManager: KnowledgeGraphManager,
    pattern: {
      nodePatterns: Array<{ type?: string; properties?: Record<string, any> }>;
      edgePatterns: Array<{
        sourceIndex: number;
        targetIndex: number;
        type?: string;
        properties?: Record<string, any>;
      }>;
    }
  ): Promise<Array<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }>> {
    try {
      const { nodePatterns, edgePatterns } = pattern;
      
      // 收集匹配每个模式的节点
      const candidateNodeSets: KnowledgeNode[][] = [];
      
      for (const nodePattern of nodePatterns) {
        let matchingNodes: KnowledgeNode[] = [];
        
        // 按类型过滤
        if (nodePattern.type) {
          matchingNodes = kgManager.queryNodesByType(nodePattern.type);
        }
        
        // 按属性过滤
        if (nodePattern.properties && matchingNodes.length === 0) {
          // 简单处理：只使用第一个属性进行查询
          const propEntries = Object.entries(nodePattern.properties);
          if (propEntries.length > 0) {
            const [key, value] = propEntries[0];
            matchingNodes = kgManager.queryNodesByProperty([key], value);
          }
        }
        
        // 如果仍然没有匹配的节点，获取全部节点然后手动过滤
        if (matchingNodes.length === 0) {
          // 这是一个简单实现，实际系统应该有更高效的方法
          for (const entity of Object.values(nodePattern.properties || {})) {
            if (typeof entity === 'string') {
              const nodes = kgManager.searchNodes(entity);
              matchingNodes = [...matchingNodes, ...nodes];
            }
          }
        }
        
        // 手动过滤所有属性
        if (nodePattern.properties) {
          matchingNodes = matchingNodes.filter((node: KnowledgeNode) => {
            for (const [key, value] of Object.entries(nodePattern.properties || {})) {
              if (node.properties[key] !== value) {
                return false;
              }
            }
            return true;
          });
        }
        
        candidateNodeSets.push(matchingNodes);
      }
      
      // Generate all combinations of nodes
      const nodeCombinations = this.generateCombinations(candidateNodeSets);
      
      // Filter combinations based on edge patterns
      const matches: Array<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> = [];
      
      for (const nodeCombination of nodeCombinations) {
        // Skip combinations with duplicate nodes
        const nodeIds = nodeCombination.map(node => node.id);
        if (new Set(nodeIds).size !== nodeIds.length) {
          continue;
        }
        
        let allEdgePatternsSatisfied = true;
        const matchedEdges: KnowledgeEdge[] = [];
        
        // Check each edge pattern
        for (const edgePattern of edgePatterns) {
          const { sourceIndex, targetIndex } = edgePattern;
          
          // Get source and target node IDs
          const sourceId = nodeCombination[sourceIndex].id;
          const targetId = nodeCombination[targetIndex].id;
          
          // 检查节点之间是否有符合模式的边
          const sourceNode = kgManager.getNode(sourceId);
          if (!sourceNode) continue;
          
          const connectedNodes = kgManager.getConnectedNodes(sourceId);
          const isConnected = connectedNodes.some(node => node.id === targetId);
          
          if (!isConnected) {
            allEdgePatternsSatisfied = false;
            break;
          }
          
          // 创建一个模拟的边，因为我们没有直接方法获取实际的边
          const edgeId = `${sourceId}-to-${targetId}`;
          const mockEdge: KnowledgeEdge = {
            id: edgeId,
            sourceId: sourceId,
            targetId: targetId,
            type: edgePattern.type || 'connected',
            properties: edgePattern.properties || {},
            created: Date.now(),
            updated: Date.now(),
            version: 1
          };
          
          matchedEdges.push(mockEdge);
        }
        
        if (allEdgePatternsSatisfied) {
          matches.push({
            nodes: nodeCombination,
            edges: matchedEdges,
          });
        }
      }
      
      return matches;
    } catch (error) {
      logger.error('Error matching pattern:', error);
      return [];
    }
  }
  
  /**
   * Infers new knowledge from the knowledge graph
   * 
   * @param kgManager - The knowledge graph manager
   * @param query - The query to guide inference
   * @returns A promise that resolves to an inference result
   */
  public async inferNewKnowledge(
    kgManager: KnowledgeGraphManager,
    query: string
  ): Promise<KGInferenceResult> {
    try {
      // This method requires an LLM provider
      if (!this.options.useLLMForReasoning || !this.llmProvider) {
        throw new Error('LLM reasoning is required for inference');
      }
      
      // Extract entities from the query
      const queryEntities = await this.extractQueryEntities(query);
      
      // Find relevant nodes and edges
      const relevantNodes: KnowledgeNode[] = [];
      const relevantEdges: KnowledgeEdge[] = [];
      const relevantNodeIds: Set<string> = new Set();
      
      // 使用搜索和类型查询获取相关节点
      for (const entity of queryEntities) {
        // 尝试搜索实体
        const searchResults = kgManager.searchNodes(entity);
        for (const node of searchResults) {
          if (!relevantNodeIds.has(node.id)) {
            relevantNodeIds.add(node.id);
            relevantNodes.push(node);
          }
        }
        
        // 尝试按类型查询
        const typeResults = kgManager.queryNodesByType(entity);
        for (const node of typeResults) {
          if (!relevantNodeIds.has(node.id)) {
            relevantNodeIds.add(node.id);
            relevantNodes.push(node);
          }
        }
      }
      
      // 获取连接的节点
      for (const nodeId of Array.from(relevantNodeIds)) {
        const connectedNodes = kgManager.getConnectedNodes(nodeId);
        for (const node of connectedNodes) {
          if (!relevantNodeIds.has(node.id)) {
            relevantNodeIds.add(node.id);
            relevantNodes.push(node);
          }
        }
      }
      
      // 创建边的模拟数据
      // 在实际系统中，应该扩展 KnowledgeGraphManager 提供获取边的方法
      for (let i = 0; i < relevantNodes.length; i++) {
        for (let j = i + 1; j < relevantNodes.length; j++) {
          const sourceId = relevantNodes[i].id;
          const targetId = relevantNodes[j].id;
          
          // 检查节点之间是否有连接
          const connectedNodes = kgManager.getConnectedNodes(sourceId);
          if (connectedNodes.some(node => node.id === targetId)) {
            const edgeId = `${sourceId}-to-${targetId}`;
            relevantEdges.push({
              id: edgeId,
              sourceId: sourceId,
              targetId: targetId,
              type: 'connected',
              properties: {},
              created: Date.now(),
              updated: Date.now(),
              version: 1
            });
          }
        }
      }
      
      // If no relevant nodes were found, return an empty result
      if (relevantNodes.length === 0) {
        return {
          inference: "I couldn't find any relevant information in the knowledge graph to make an inference.",
          confidence: 0,
          newNodes: [],
          newEdges: [],
        };
      }
      
      // Generate inference using LLM
      const inferenceResult = await this.generateInference(query, relevantNodes, relevantEdges);
      
      if (!inferenceResult) {
        return {
          inference: "I couldn't generate an inference from the knowledge graph.",
          confidence: 0,
          newNodes: [],
          newEdges: [],
        };
      }
      
      try {
        // Parse the inference result
        const jsonMatch = inferenceResult.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return {
            inference: inferenceResult,
            confidence: 0.5,
            newNodes: [],
            newEdges: [],
          };
        }
        
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Process new nodes
        const newNodes: KnowledgeNode[] = (parsed.newNodes || []).map((node: any) => ({
          id: node.id || uuidv4(),
          type: node.type || 'Concept',
          properties: node.properties || {},
          created: Date.now(),
          updated: Date.now(),
          version: 1,
        }));
        
        // Process new edges
        const newEdges: KnowledgeEdge[] = (parsed.newEdges || []).map((edge: any) => ({
          id: edge.id || uuidv4(),
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          type: edge.type || 'hasRelation',
          properties: edge.properties || {},
          created: Date.now(),
          updated: Date.now(),
          version: 1,
        }));
        
        return {
          inference: parsed.inference || inferenceResult,
          confidence: parsed.confidence || 0.5,
          newNodes,
          newEdges,
        };
      } catch (parseError) {
        logger.warn('Error parsing inference result:', parseError);
        return {
          inference: inferenceResult,
          confidence: 0.5,
          newNodes: [],
          newEdges: [],
        };
      }
    } catch (error) {
      logger.error('Error inferring new knowledge:', error);
      return {
        inference: "An error occurred while inferring new knowledge.",
        confidence: 0,
        newNodes: [],
        newEdges: [],
      };
    }
  }
  
  /**
   * Extracts entities from a query
   * 
   * @param query - The query to extract entities from
   * @returns A promise that resolves to an array of entity names
   */
  private async extractQueryEntities(query: string): Promise<string[]> {
    try {
      // If no LLM provider is available, use a simple approach
      if (!this.llmProvider) {
        // Split the query into words and filter out common words
        const commonWords = new Set([
          'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with',
          'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between',
          'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among',
          'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
          'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might',
          'must', 'can', 'could',
        ]);
        
        return query
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
          .split(/\s+/) // Split by whitespace
          .filter(word => word.length > 1 && !commonWords.has(word));
      }
      
      // Use LLM to extract entities
      const prompt = `
        Extract the main entities from the following query. These are the key nouns or named entities
        that the query is asking about. Return only a comma-separated list of entities.
        
        Query: ${query}
        
        Entities:
      `;
      
      const response = await this.llmProvider.generate(prompt, {
        temperature: 0.3, // 低温度以获得更确定性的回答
      });
      
      // Parse the response
      return response
        .split(',')
        .map(entity => entity.trim())
        .filter(entity => entity.length > 0);
    } catch (error) {
      logger.warn('Error extracting query entities:', error);
      // Fallback to returning the query itself
      return [query];
    }
  }
  
  /**
   * Generates reasoning using LLM
   * 
   * @param query - The query to reason about
   * @param nodes - The relevant nodes
   * @param edges - The relevant edges
   * @returns A promise that resolves to the reasoning result
   */
  private async generateReasoning(
    query: string,
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[]
  ): Promise<string | undefined> {
    try {
      if (!this.llmProvider) {
        return undefined;
      }
      
      // Format nodes for the prompt
      const nodesText = nodes.map(node => {
        const name = node.properties.name ? `name: ${node.properties.name}, ` : '';
        const propertiesText = Object.entries(node.properties)
          .filter(([key]) => key !== 'name')
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        
        return `- ${node.id} (${node.type}): ${name}${propertiesText}`;
      }).join('\n');
      
      // Format edges for the prompt
      const edgesText = edges.map(edge => {
        const propertiesText = Object.entries(edge.properties)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        
        return `- ${edge.sourceId} -[${edge.type}]-> ${edge.targetId} ${propertiesText ? `(${propertiesText})` : ''}`;
      }).join('\n');
      
      // Create the prompt
      const prompt = (this.options.reasoningPrompt || DEFAULT_REASONING_PROMPT)
        .replace('{{query}}', query)
        .replace('{{nodes}}', nodesText)
        .replace('{{edges}}', edgesText);
      
      // Generate reasoning
      return await this.llmProvider.generate(prompt, {
        temperature: 0.7,
        maxTokens: 2000
      });
    } catch (error) {
      logger.warn('Error generating reasoning:', error);
      return undefined;
    }
  }
  
  /**
   * Generates inference using LLM
   * 
   * @param query - The query to guide inference
   * @param nodes - The relevant nodes
   * @param edges - The relevant edges
   * @returns A promise that resolves to the inference result
   */
  private async generateInference(
    query: string,
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[]
  ): Promise<string | undefined> {
    try {
      if (!this.llmProvider) {
        return undefined;
      }
      
      // Format nodes for the prompt
      const nodesText = nodes.map(node => {
        const name = node.properties.name ? `name: ${node.properties.name}, ` : '';
        const propertiesText = Object.entries(node.properties)
          .filter(([key]) => key !== 'name')
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        
        return `- ${node.id} (${node.type}): ${name}${propertiesText}`;
      }).join('\n');
      
      // Format edges for the prompt
      const edgesText = edges.map(edge => {
        const propertiesText = Object.entries(edge.properties)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        
        return `- ${edge.sourceId} -[${edge.type}]-> ${edge.targetId} ${propertiesText ? `(${propertiesText})` : ''}`;
      }).join('\n');
      
      // Create the prompt
      const prompt = DEFAULT_INFERENCE_PROMPT
        .replace('{{query}}', query)
        .replace('{{nodes}}', nodesText)
        .replace('{{edges}}', edgesText);
      
      // Generate inference
      return await this.llmProvider.generate(prompt, {
        temperature: 0.8,
        maxTokens: 2000
      });
    } catch (error) {
      logger.warn('Error generating inference:', error);
      return undefined;
    }
  }
  
  /**
   * Finds paths between two nodes using BFS
   * 
   * @param kgManager - The knowledge graph manager
   * @param startNodeId - The ID of the start node
   * @param endNodeId - The ID of the end node
   * @param relationTypes - Optional array of relation types to filter paths
   * @returns An array of paths
   */
  private bfsPathFinding(
    kgManager: KnowledgeGraphManager,
    startNodeId: string,
    endNodeId: string,
    relationTypes?: string[]
  ): KGPath[] {
    const paths: KGPath[] = [];
    const visited = new Set<string>();
    const queue: Array<{
      currentNodeId: string;
      path: Array<KnowledgeNode | KnowledgeEdge>;
      pathNodeIds: Set<string>;
    }> = [];
    
    // Get the start node
    const startNode = kgManager.getNode(startNodeId);
    if (!startNode) {
      return [];
    }
    
    // Initialize the queue with the start node
    queue.push({
      currentNodeId: startNodeId,
      path: [startNode],
      pathNodeIds: new Set([startNodeId]),
    });
    
    visited.add(startNodeId);
    
    while (queue.length > 0) {
      const { currentNodeId, path, pathNodeIds } = queue.shift()!;
      
      // If we've reached the maximum path length, skip this path
      if (path.filter(item => 'type' in item && 'properties' in item).length > this.options.maxPathLength) {
        continue;
      }
      
      // If we've reached the end node, add the path to the results
      if (currentNodeId === endNodeId) {
        // Calculate path confidence
        const edgeConfidences = path
          .filter(item => 'sourceId' in item && 'targetId' in item)
          .map(item => (item as KnowledgeEdge).properties.confidence as number || 0.5);
        
        const confidence = edgeConfidences.length > 0
          ? edgeConfidences.reduce((sum, conf) => sum + conf, 0) / edgeConfidences.length
          : 1;
        
        // Extract nodes and edges from the path
        const nodes: KnowledgeNode[] = [];
        const edges: KnowledgeEdge[] = [];
        
        for (const item of path) {
          if ('type' in item && 'properties' in item && !('sourceId' in item)) {
            nodes.push(item as KnowledgeNode);
          } else if ('sourceId' in item && 'targetId' in item) {
            edges.push(item as KnowledgeEdge);
          }
        }
        
        paths.push({ nodes, edges, confidence });
        
        // Skip to the next path
        continue;
      }
      
      // 获取所有连接的节点
      const connectedNodes = kgManager.getConnectedNodes(currentNodeId);
      
      // 将所有连接的节点添加到队列
      for (const connectedNode of connectedNodes) {
        // 跳过已经在路径中的节点
        if (pathNodeIds.has(connectedNode.id)) {
          continue;
        }
        
        // 创建一个模拟的边对象
        const mockEdge: KnowledgeEdge = {
          id: `${currentNodeId}-to-${connectedNode.id}`,
          sourceId: currentNodeId,
          targetId: connectedNode.id,
          type: 'connected', // 这里没有实际类型信息
          properties: {},
          created: Date.now(),
          updated: Date.now(),
          version: 1
        };
        
        // 如果指定了边类型，跳过不匹配的边
        if (relationTypes && !relationTypes.includes(mockEdge.type)) {
          continue;
        }
        
        // 创建新路径
        const newPath = [...path, mockEdge, connectedNode];
        const newPathNodeIds = new Set(pathNodeIds);
        newPathNodeIds.add(connectedNode.id);
        
        // 添加到队列
        queue.push({
          currentNodeId: connectedNode.id,
          path: newPath,
          pathNodeIds: newPathNodeIds,
        });
        
        visited.add(connectedNode.id);
      }
    }
    
    return paths;
  }
  
  /**
   * Generates all combinations of elements from arrays
   * 
   * @param arrays - The arrays to generate combinations from
   * @returns An array of combinations
   */
  private generateCombinations<T>(arrays: T[][]): T[][] {
    const result: T[][] = [];
    
    // Helper function to generate combinations recursively
    const generate = (current: T[], index: number) => {
      if (index === arrays.length) {
        result.push([...current]);
        return;
      }
      
      for (const item of arrays[index]) {
        current.push(item);
        generate(current, index + 1);
        current.pop();
      }
    };
    
    generate([], 0);
    return result;
  }
} 