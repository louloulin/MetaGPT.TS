/**
 * Distributed Knowledge Graph System
 * 
 * This module implements a distributed knowledge graph that can be shared and synchronized
 * across multiple nodes in the MetaGPT network. It uses the actor system for communication
 * and the P2P network for data distribution.
 */

import { z } from 'zod';
import { Actor } from '../actor/actor';
import type { BaseActorMessage, BaseMessageHandler } from '../actor/types';
import { logger } from '../utils/logger';
import { KGIndexManager } from './kg-index';

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
  source: z.string(),
  target: z.string(),
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

export interface KGMessage extends BaseActorMessage {
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

/**
 * Manages a local partition of the distributed knowledge graph
 */
export class KnowledgeGraphManager extends Actor {
  private nodes: Map<string, KnowledgeNode>;
  private edges: Map<string, KnowledgeEdge>;
  private lastSyncTimestamp: number;
  private readonly indexManager: KGIndexManager;

  constructor() {
    super('knowledge_graph_manager');
    this.nodes = new Map();
    this.edges = new Map();
    this.lastSyncTimestamp = Date.now();
    this.indexManager = new KGIndexManager();

    // Register message handlers
    this.registerHandler(KGMessageType.ADD_NODE, this.handleAddNode.bind(this) as BaseMessageHandler);
    this.registerHandler(KGMessageType.UPDATE_NODE, this.handleUpdateNode.bind(this) as BaseMessageHandler);
    this.registerHandler(KGMessageType.DELETE_NODE, this.handleDeleteNode.bind(this) as BaseMessageHandler);
    this.registerHandler(KGMessageType.ADD_EDGE, this.handleAddEdge.bind(this) as BaseMessageHandler);
    this.registerHandler(KGMessageType.UPDATE_EDGE, this.handleUpdateEdge.bind(this) as BaseMessageHandler);
    this.registerHandler(KGMessageType.DELETE_EDGE, this.handleDeleteEdge.bind(this) as BaseMessageHandler);
    this.registerHandler(KGMessageType.SYNC_REQUEST, this.handleSyncRequest.bind(this) as BaseMessageHandler);
    this.registerHandler(KGMessageType.SYNC_RESPONSE, this.handleSyncResponse.bind(this) as BaseMessageHandler);
  }

  // Node operations
  private async handleAddNode(message: KGMessage): Promise<void> {
    const { node } = message.payload;
    if (!node) return;

    try {
      const validNode = KnowledgeNodeSchema.parse(node);
      this.nodes.set(validNode.id, validNode);
      this.indexManager.indexNode(validNode);
      logger.info(`Added node: ${validNode.id}`);
      await this.broadcastChange(message);
    } catch (error) {
      logger.error(`Failed to add node: ${error}`);
    }
  }

  private async handleUpdateNode(message: KGMessage): Promise<void> {
    const { node } = message.payload;
    if (!node) return;

    try {
      const validNode = KnowledgeNodeSchema.parse(node);
      if (this.nodes.has(validNode.id)) {
        const existingNode = this.nodes.get(validNode.id)!;
        if (validNode.version > existingNode.version) {
          this.indexManager.removeNodeIndex(validNode.id);
          this.nodes.set(validNode.id, validNode);
          this.indexManager.indexNode(validNode);
          logger.info(`Updated node: ${validNode.id}`);
          await this.broadcastChange(message);
        }
      }
    } catch (error) {
      logger.error(`Failed to update node: ${error}`);
    }
  }

  private async handleDeleteNode(message: KGMessage): Promise<void> {
    const { node } = message.payload;
    if (!node) return;

    if (this.nodes.has(node.id)) {
      this.indexManager.removeNodeIndex(node.id);
      this.nodes.delete(node.id);
      // Also delete connected edges
      for (const [edgeId, edge] of this.edges) {
        if (edge.source === node.id || edge.target === node.id) {
          this.indexManager.removeEdgeIndex(edgeId);
          this.edges.delete(edgeId);
        }
      }
      logger.info(`Deleted node: ${node.id}`);
      await this.broadcastChange(message);
    }
  }

  // Edge operations
  private async handleAddEdge(message: KGMessage): Promise<void> {
    const { edge } = message.payload;
    if (!edge) return;

    try {
      const validEdge = KnowledgeEdgeSchema.parse(edge);
      if (this.nodes.has(validEdge.source) && this.nodes.has(validEdge.target)) {
        this.edges.set(validEdge.id, validEdge);
        this.indexManager.indexEdge(validEdge);
        logger.info(`Added edge: ${validEdge.id}`);
        await this.broadcastChange(message);
      }
    } catch (error) {
      logger.error(`Failed to add edge: ${error}`);
    }
  }

  private async handleUpdateEdge(message: KGMessage): Promise<void> {
    const { edge } = message.payload;
    if (!edge) return;

    try {
      const validEdge = KnowledgeEdgeSchema.parse(edge);
      if (this.edges.has(validEdge.id)) {
        const existingEdge = this.edges.get(validEdge.id)!;
        if (validEdge.version > existingEdge.version) {
          this.indexManager.removeEdgeIndex(validEdge.id);
          this.edges.set(validEdge.id, validEdge);
          this.indexManager.indexEdge(validEdge);
          logger.info(`Updated edge: ${validEdge.id}`);
          await this.broadcastChange(message);
        }
      }
    } catch (error) {
      logger.error(`Failed to update edge: ${error}`);
    }
  }

  private async handleDeleteEdge(message: KGMessage): Promise<void> {
    const { edge } = message.payload;
    if (!edge) return;

    if (this.edges.has(edge.id)) {
      this.indexManager.removeEdgeIndex(edge.id);
      this.edges.delete(edge.id);
      logger.info(`Deleted edge: ${edge.id}`);
      await this.broadcastChange(message);
    }
  }

  // Synchronization
  private async handleSyncRequest(message: KGMessage): Promise<void> {
    const syncData = {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      timestamp: Date.now(),
    };

    await this.send({
      ...message,
      type: KGMessageType.SYNC_RESPONSE,
      to: message.from,
      from: this.id,
      payload: { syncData },
    });
  }

  private async handleSyncResponse(message: KGMessage): Promise<void> {
    const { syncData } = message.payload;
    if (!syncData) return;

    if (syncData.timestamp > this.lastSyncTimestamp) {
      // Merge received nodes
      for (const node of syncData.nodes) {
        const existingNode = this.nodes.get(node.id);
        if (!existingNode || node.version > existingNode.version) {
          this.nodes.set(node.id, node);
        }
      }

      // Merge received edges
      for (const edge of syncData.edges) {
        const existingEdge = this.edges.get(edge.id);
        if (!existingEdge || edge.version > existingEdge.version) {
          this.edges.set(edge.id, edge);
        }
      }

      this.lastSyncTimestamp = syncData.timestamp;
      logger.info(`Synchronized with peer ${message.from}`);
    }
  }

  // Helper methods
  private async broadcastChange(message: KGMessage): Promise<void> {
    // Broadcast the change to all connected peers
    // This will be implemented using the P2P network layer
    // TODO: Implement actual broadcasting logic
  }

  // Public API
  public async addNode(node: Omit<KnowledgeNode, 'created' | 'updated' | 'version'>): Promise<void> {
    const now = Date.now();
    const fullNode: KnowledgeNode = {
      ...node,
      created: now,
      updated: now,
      version: 1,
    };

    await this.handleAddNode({
      type: KGMessageType.ADD_NODE,
      from: this.id,
      to: 'broadcast',
      payload: { node: fullNode },
    });
  }

  public async addEdge(edge: Omit<KnowledgeEdge, 'created' | 'updated' | 'version'>): Promise<void> {
    const now = Date.now();
    const fullEdge: KnowledgeEdge = {
      ...edge,
      created: now,
      updated: now,
      version: 1,
    };

    await this.handleAddEdge({
      type: KGMessageType.ADD_EDGE,
      from: this.id,
      to: 'broadcast',
      payload: { edge: fullEdge },
    });
  }

  public async requestSync(): Promise<void> {
    await this.send({
      type: KGMessageType.SYNC_REQUEST,
      from: this.id,
      to: 'broadcast',
      payload: {},
    });
  }

  // Query methods
  public getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  public getEdge(id: string): KnowledgeEdge | undefined {
    return this.edges.get(id);
  }

  public getConnectedNodes(nodeId: string): KnowledgeNode[] {
    const connectedNodes: KnowledgeNode[] = [];
    for (const edge of this.edges.values()) {
      if (edge.source === nodeId && this.nodes.has(edge.target)) {
        connectedNodes.push(this.nodes.get(edge.target)!);
      } else if (edge.target === nodeId && this.nodes.has(edge.source)) {
        connectedNodes.push(this.nodes.get(edge.source)!);
      }
    }
    return connectedNodes;
  }

  public queryNodesByType(type: string): KnowledgeNode[] {
    const nodeIds = this.indexManager.queryByType(type);
    return Array.from(nodeIds)
      .map(id => this.nodes.get(id))
      .filter((node): node is KnowledgeNode => node !== undefined);
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