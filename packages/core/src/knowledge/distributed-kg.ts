/**
 * Distributed Knowledge Graph System
 * 
 * This module implements a distributed knowledge graph that can be shared and synchronized
 * across multiple nodes in the MetaGPT network.
 */

import { z } from 'zod';
import { logger } from '../utils/logger';
import { KGIndexManager } from './kg-index';
import { v4 as uuidv4 } from 'uuid';

// Schema definitions for knowledge graph entities
export const KnowledgeNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  properties: z.record(z.unknown()),
  created: z.number(),
  updated: z.number(),
  version: z.number(),
});

export const KnowledgeEdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.string(),
  properties: z.record(z.unknown()),
  created: z.number(),
  updated: z.number(),
  version: z.number(),
});

export type KnowledgeNode = z.infer<typeof KnowledgeNodeSchema>;
export type KnowledgeEdge = z.infer<typeof KnowledgeEdgeSchema>;

// Message types for knowledge graph operations
export enum KGMessageType {
  ADD_NODE = 'ADD_NODE',
  UPDATE_NODE = 'UPDATE_NODE',
  DELETE_NODE = 'DELETE_NODE',
  ADD_EDGE = 'ADD_EDGE',
  UPDATE_EDGE = 'UPDATE_EDGE',
  DELETE_EDGE = 'DELETE_EDGE',
  SYNC_REQUEST = 'SYNC_REQUEST',
  SYNC_RESPONSE = 'SYNC_RESPONSE',
}

// Message interface for knowledge graph operations
export interface KGMessage {
  type: KGMessageType;
  payload: {
    node?: KnowledgeNode;
    edge?: KnowledgeEdge;
    syncData?: {
      nodes: KnowledgeNode[];
      edges: KnowledgeEdge[];
      timestamp: number;
    };
  };
}

type MessageHandler = (message: KGMessage) => Promise<void>;

/**
 * Knowledge Graph Manager
 * Manages the distributed knowledge graph and handles operations
 */
export class KnowledgeGraphManager {
  private nodes: Map<string, KnowledgeNode>;
  private edges: Map<string, KnowledgeEdge>;
  private lastSyncTimestamp: number;
  private readonly indexManager: KGIndexManager;
  private readonly id: string;
  private messageHandlers: Map<KGMessageType, MessageHandler>;

  constructor() {
    this.id = uuidv4();
    this.nodes = new Map<string, KnowledgeNode>();
    this.edges = new Map<string, KnowledgeEdge>();
    this.lastSyncTimestamp = Date.now();
    this.indexManager = new KGIndexManager();
    this.messageHandlers = new Map<KGMessageType, MessageHandler>();

    // Register message handlers
    this.messageHandlers.set(KGMessageType.ADD_NODE, this.handleAddNode.bind(this));
    this.messageHandlers.set(KGMessageType.UPDATE_NODE, this.handleUpdateNode.bind(this));
    this.messageHandlers.set(KGMessageType.DELETE_NODE, this.handleDeleteNode.bind(this));
    this.messageHandlers.set(KGMessageType.ADD_EDGE, this.handleAddEdge.bind(this));
    this.messageHandlers.set(KGMessageType.UPDATE_EDGE, this.handleUpdateEdge.bind(this));
    this.messageHandlers.set(KGMessageType.DELETE_EDGE, this.handleDeleteEdge.bind(this));
    this.messageHandlers.set(KGMessageType.SYNC_REQUEST, this.handleSyncRequest.bind(this));
    this.messageHandlers.set(KGMessageType.SYNC_RESPONSE, this.handleSyncResponse.bind(this));
  }

  // 处理接收到的消息
  public async processMessage(message: KGMessage): Promise<void> {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      await handler(message);
    } else {
      logger.warn(`No handler registered for message type: ${message.type}`);
    }
  }

  // Node operations
  private async handleAddNode(message: KGMessage): Promise<void> {
    if (!message.payload.node) {
      logger.error('Add node message missing node payload');
      return;
    }

    const node = message.payload.node;
    
    if (this.nodes.has(node.id)) {
      logger.warn(`Node already exists: ${node.id}`);
      return;
    }

    this.nodes.set(node.id, node);
    await this.indexManager.indexNode(node);
    logger.info(`Added node: ${node.id}`);
  }

  private async handleUpdateNode(message: KGMessage): Promise<void> {
    if (!message.payload.node) {
      logger.error('Update node message missing node payload');
      return;
    }

    const updatedNode = message.payload.node;
    const existingNode = this.nodes.get(updatedNode.id);
    
    if (!existingNode) {
      logger.warn(`Cannot update non-existent node: ${updatedNode.id}`);
      return;
    }

    if (existingNode.version >= updatedNode.version) {
      logger.warn(`Ignoring older or same version update for node: ${updatedNode.id}`);
      return;
    }

    this.nodes.set(updatedNode.id, updatedNode);
    await this.indexManager.indexNode(updatedNode);
    logger.info(`Updated node: ${updatedNode.id}`);
  }

  private async handleDeleteNode(message: KGMessage): Promise<void> {
    if (!message.payload.node) {
      logger.error('Delete node message missing node payload');
      return;
    }

    const nodeId = message.payload.node.id;
    
    if (!this.nodes.has(nodeId)) {
      logger.warn(`Cannot delete non-existent node: ${nodeId}`);
      return;
    }

    // Delete all connected edges
    const edgesToDelete: KnowledgeEdge[] = [];
    this.edges.forEach(edge => {
      if (edge.sourceId === nodeId || edge.targetId === nodeId) {
        edgesToDelete.push(edge);
      }
    });

    for (const edge of edgesToDelete) {
      this.edges.delete(edge.id);
      await this.indexManager.removeEdgeIndex(edge.id);
    }

    this.nodes.delete(nodeId);
    await this.indexManager.removeNodeIndex(nodeId);
    logger.info(`Deleted node: ${nodeId}`);
  }

  private async handleAddEdge(message: KGMessage): Promise<void> {
    if (!message.payload.edge) {
      logger.error('Add edge message missing edge payload');
      return;
    }

    const edge = message.payload.edge;
    
    if (this.edges.has(edge.id)) {
      logger.warn(`Edge already exists: ${edge.id}`);
      return;
    }

    // Verify that source and target nodes exist
    if (!this.nodes.has(edge.sourceId)) {
      logger.warn(`Edge source node does not exist: ${edge.sourceId}`);
      return;
    }

    if (!this.nodes.has(edge.targetId)) {
      logger.warn(`Edge target node does not exist: ${edge.targetId}`);
      return;
    }

    this.edges.set(edge.id, edge);
    await this.indexManager.indexEdge(edge);
    logger.info(`Added edge: ${edge.id}`);
  }

  private async handleUpdateEdge(message: KGMessage): Promise<void> {
    if (!message.payload.edge) {
      logger.error('Update edge message missing edge payload');
      return;
    }

    const updatedEdge = message.payload.edge;
    const existingEdge = this.edges.get(updatedEdge.id);
    
    if (!existingEdge) {
      logger.warn(`Cannot update non-existent edge: ${updatedEdge.id}`);
      return;
    }

    if (existingEdge.version >= updatedEdge.version) {
      logger.warn(`Ignoring older or same version update for edge: ${updatedEdge.id}`);
      return;
    }

    // Verify that source and target nodes exist
    if (!this.nodes.has(updatedEdge.sourceId)) {
      logger.warn(`Edge source node does not exist: ${updatedEdge.sourceId}`);
      return;
    }

    if (!this.nodes.has(updatedEdge.targetId)) {
      logger.warn(`Edge target node does not exist: ${updatedEdge.targetId}`);
      return;
    }

    this.edges.set(updatedEdge.id, updatedEdge);
    await this.indexManager.indexEdge(updatedEdge);
    logger.info(`Updated edge: ${updatedEdge.id}`);
  }

  private async handleDeleteEdge(message: KGMessage): Promise<void> {
    if (!message.payload.edge) {
      logger.error('Delete edge message missing edge payload');
      return;
    }

    const edgeId = message.payload.edge.id;
    
    if (!this.edges.has(edgeId)) {
      logger.warn(`Cannot delete non-existent edge: ${edgeId}`);
      return;
    }

    this.edges.delete(edgeId);
    await this.indexManager.removeEdgeIndex(edgeId);
    logger.info(`Deleted edge: ${edgeId}`);
  }

  private async handleSyncRequest(message: KGMessage): Promise<void> {
    logger.info(`Received sync request`);
    
    const syncData = {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      timestamp: Date.now(),
    };

    // 这里需要外部发送消息的机制
    logger.info(`Prepared sync response with ${syncData.nodes.length} nodes and ${syncData.edges.length} edges`);
    
    // 触发同步响应事件而不是直接发送
    this.triggerEvent(KGMessageType.SYNC_RESPONSE, { syncData });
  }

  private async handleSyncResponse(message: KGMessage): Promise<void> {
    if (!message.payload.syncData) {
      logger.error('Sync response missing sync data');
      return;
    }

    const { nodes, edges, timestamp } = message.payload.syncData;
    
    if (timestamp <= this.lastSyncTimestamp) {
      logger.warn('Ignoring outdated sync data');
      return;
    }

    // Process nodes
    for (const node of nodes) {
      const existingNode = this.nodes.get(node.id);
      if (!existingNode || existingNode.version < node.version) {
        // 确保我们创建一个深拷贝，而不是仅仅引用原始节点
        const nodeToStore = {
          ...node,
          properties: { ...node.properties }
        };
        this.nodes.set(node.id, nodeToStore);
        await this.indexManager.indexNode(nodeToStore);
        logger.info(`Synced node: ${node.id} with version ${node.version}`);
      }
    }

    // Process edges
    for (const edge of edges) {
      const existingEdge = this.edges.get(edge.id);
      if (!existingEdge || existingEdge.version < edge.version) {
        // 确保我们创建一个深拷贝，而不是仅仅引用原始边
        const edgeToStore = {
          ...edge,
          properties: { ...edge.properties }
        };
        this.edges.set(edge.id, edgeToStore);
        await this.indexManager.indexEdge(edgeToStore);
      }
    }

    this.lastSyncTimestamp = timestamp;
    logger.info(`Synchronized with peer, received ${nodes.length} nodes and ${edges.length} edges`);
  }

  // Event broadcasting mechanism
  public triggerEvent(type: KGMessageType, payload: any): void {
    logger.info(`Triggered event: ${type}`);
    // 这里可以集成事件发布系统或消息队列
  }

  // Public API
  public async addNode(node: Omit<KnowledgeNode, 'created' | 'updated' | 'version'>): Promise<void> {
    const timestamp = Date.now();
    const fullNode: KnowledgeNode = {
      ...node,
      created: timestamp,
      updated: timestamp,
      version: 1,
    };

    await this.handleAddNode({
      type: KGMessageType.ADD_NODE,
      payload: { node: fullNode },
    });
    
    // 触发事件通知其他组件
    this.triggerEvent(KGMessageType.ADD_NODE, { node: fullNode });
  }

  public async addEdge(edge: Omit<KnowledgeEdge, 'created' | 'updated' | 'version'>): Promise<void> {
    const timestamp = Date.now();
    const fullEdge: KnowledgeEdge = {
      ...edge,
      created: timestamp,
      updated: timestamp,
      version: 1,
    };

    await this.handleAddEdge({
      type: KGMessageType.ADD_EDGE,
      payload: { edge: fullEdge },
    });
    
    // 触发事件通知其他组件
    this.triggerEvent(KGMessageType.ADD_EDGE, { edge: fullEdge });
  }

  public async requestSync(): Promise<void> {
    this.triggerEvent(KGMessageType.SYNC_REQUEST, {});
  }

  public getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  public getEdge(id: string): KnowledgeEdge | undefined {
    return this.edges.get(id);
  }

  public getConnectedNodes(nodeId: string): KnowledgeNode[] {
    const connectedNodes: KnowledgeNode[] = [];
    
    this.edges.forEach(edge => {
      if (edge.sourceId === nodeId) {
        const targetNode = this.nodes.get(edge.targetId);
        if (targetNode) {
          connectedNodes.push(targetNode);
        }
      } else if (edge.targetId === nodeId) {
        const sourceNode = this.nodes.get(edge.sourceId);
        if (sourceNode) {
          connectedNodes.push(sourceNode);
        }
      }
    });
    
    return connectedNodes;
  }

  public queryNodesByType(type: string): KnowledgeNode[] {
    return Array.from(this.nodes.values()).filter(node => node.type === type);
  }

  public queryNodesByProperty(propertyPath: string[], value: any): KnowledgeNode[] {
    const nodeIds = this.indexManager.queryByProperty(propertyPath, value);
    return Array.from(nodeIds)
      .map(id => this.nodes.get(id))
      .filter((node): node is KnowledgeNode => node !== undefined);
  }

  public searchNodes(query: string): KnowledgeNode[] {
    const nodeIds = this.indexManager.searchText(query);
    return Array.from(nodeIds)
      .map(id => this.nodes.get(id))
      .filter((node): node is KnowledgeNode => node !== undefined);
  }
} 