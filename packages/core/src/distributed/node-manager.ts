/**
 * @module NodeManager
 * @category Distributed
 * 
 * Node discovery and management for distributed system
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { MessageBroker, MessageType, MessagePriority, type Message } from './message-broker';
import { logger } from '../utils/logger';

/**
 * Node status enum
 */
export enum NodeStatus {
  STARTING = 'starting',
  ACTIVE = 'active',
  BUSY = 'busy',
  DRAINING = 'draining',
  INACTIVE = 'inactive',
  ERROR = 'error'
}

/**
 * Node capabilities interface
 */
export interface NodeCapabilities {
  maxConcurrentTasks: number;
  supportedTaskTypes: string[];
  resources: {
    cpu: number;
    memory: number;
    gpu?: number;
  };
  constraints?: Record<string, any>;
}

/**
 * Node information interface
 */
export interface NodeInfo {
  id: string;
  host: string;
  port: number;
  status: NodeStatus;
  capabilities: NodeCapabilities;
  currentLoad: {
    tasks: number;
    cpu: number;
    memory: number;
    gpu?: number;
  };
  lastHeartbeat: number;
  metadata?: Record<string, any>;
}

/**
 * Node manager options interface
 */
export interface NodeManagerOptions {
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  cleanupInterval?: number;
  discoveryBroadcastInterval?: number;
}

/**
 * Node manager for distributed system
 */
export class NodeManager extends EventEmitter {
  private nodes: Map<string, NodeInfo>;
  private messageBroker: MessageBroker;
  private nodeId: string;
  private options: Required<NodeManagerOptions>;
  private heartbeatTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private discoveryTimer?: NodeJS.Timeout;

  constructor(
    messageBroker: MessageBroker,
    nodeInfo: Partial<NodeInfo>,
    options: NodeManagerOptions = {}
  ) {
    super();
    this.nodes = new Map();
    this.messageBroker = messageBroker;
    this.nodeId = nodeInfo.id ?? uuidv4();

    // Set default options
    this.options = {
      heartbeatInterval: options.heartbeatInterval ?? 5000,
      heartbeatTimeout: options.heartbeatTimeout ?? 15000,
      cleanupInterval: options.cleanupInterval ?? 30000,
      discoveryBroadcastInterval: options.discoveryBroadcastInterval ?? 10000
    };

    // Register this node
    this.nodes.set(this.nodeId, {
      id: this.nodeId,
      host: nodeInfo.host ?? 'localhost',
      port: nodeInfo.port ?? 0,
      status: NodeStatus.STARTING,
      capabilities: nodeInfo.capabilities ?? {
        maxConcurrentTasks: 10,
        supportedTaskTypes: ['default'],
        resources: {
          cpu: 1,
          memory: 1024
        }
      },
      currentLoad: {
        tasks: 0,
        cpu: 0,
        memory: 0
      },
      lastHeartbeat: Date.now(),
      metadata: nodeInfo.metadata
    });

    // Subscribe to node-related messages
    this.setupMessageHandlers();

    // Start timers
    this.startTimers();
  }

  /**
   * Set up message handlers
   */
  private setupMessageHandlers(): void {
    // Handle node discovery messages
    this.messageBroker.subscribe(MessageType.NODE_DISCOVERY, async (message: Message) => {
      const nodeInfo = message.payload as NodeInfo;
      if (nodeInfo.id !== this.nodeId) {
        this.updateNode(nodeInfo);
      }
    });

    // Handle heartbeat messages
    this.messageBroker.subscribe(MessageType.HEARTBEAT, async (message: Message) => {
      const { nodeId, status, currentLoad } = message.payload;
      const node = this.nodes.get(nodeId);
      if (node) {
        node.status = status;
        node.currentLoad = currentLoad;
        node.lastHeartbeat = Date.now();
        this.emit('nodeUpdated', node);
      }
    });
  }

  /**
   * Start management timers
   */
  private startTimers(): void {
    // Start heartbeat timer
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.options.heartbeatInterval);

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveNodes();
    }, this.options.cleanupInterval);

    // Start discovery broadcast timer
    this.discoveryTimer = setInterval(() => {
      this.broadcastDiscovery();
    }, this.options.discoveryBroadcastInterval);
  }

  /**
   * Stop management timers
   */
  private stopTimers(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.discoveryTimer) clearInterval(this.discoveryTimer);
  }

  /**
   * Send heartbeat message
   */
  private async sendHeartbeat(): Promise<void> {
    const node = this.nodes.get(this.nodeId);
    if (!node) return;

    try {
      await this.messageBroker.publish({
        type: MessageType.HEARTBEAT,
        sender: this.nodeId,
        priority: MessagePriority.LOW,
        payload: {
          nodeId: this.nodeId,
          status: node.status,
          currentLoad: node.currentLoad
        }
      });
    } catch (error) {
      logger.error(`[NodeManager] Failed to send heartbeat: ${(error as Error).message}`);
    }
  }

  /**
   * Broadcast node discovery message
   */
  private async broadcastDiscovery(): Promise<void> {
    const node = this.nodes.get(this.nodeId);
    if (!node) return;

    try {
      await this.messageBroker.publish({
        type: MessageType.NODE_DISCOVERY,
        sender: this.nodeId,
        priority: MessagePriority.NORMAL,
        payload: node
      });
    } catch (error) {
      logger.error(`[NodeManager] Failed to broadcast discovery: ${(error as Error).message}`);
    }
  }

  /**
   * Clean up inactive nodes
   */
  private cleanupInactiveNodes(): void {
    const now = Date.now();
    for (const [nodeId, node] of this.nodes.entries()) {
      if (nodeId !== this.nodeId && now - node.lastHeartbeat > this.options.heartbeatTimeout) {
        logger.warn(`[NodeManager] Node ${nodeId} is inactive, removing`);
        this.nodes.delete(nodeId);
        this.emit('nodeRemoved', node);
      }
    }
  }

  /**
   * Update node information
   */
  private updateNode(nodeInfo: NodeInfo): void {
    const existingNode = this.nodes.get(nodeInfo.id);
    if (existingNode) {
      Object.assign(existingNode, nodeInfo);
      this.emit('nodeUpdated', existingNode);
    } else {
      this.nodes.set(nodeInfo.id, nodeInfo);
      this.emit('nodeAdded', nodeInfo);
    }
  }

  /**
   * Get all active nodes
   */
  public getActiveNodes(): NodeInfo[] {
    const now = Date.now();
    return Array.from(this.nodes.values()).filter(
      node => now - node.lastHeartbeat <= this.options.heartbeatTimeout
    );
  }

  /**
   * Get node by ID
   */
  public getNode(nodeId: string): NodeInfo | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Update node status
   */
  public async updateStatus(status: NodeStatus): Promise<void> {
    const node = this.nodes.get(this.nodeId);
    if (node) {
      node.status = status;
      this.emit('nodeUpdated', node);
      await this.sendHeartbeat();
    }
  }

  /**
   * Update node load
   */
  public async updateLoad(load: Partial<NodeInfo['currentLoad']>): Promise<void> {
    const node = this.nodes.get(this.nodeId);
    if (node) {
      node.currentLoad = { ...node.currentLoad, ...load };
      this.emit('nodeUpdated', node);
      await this.sendHeartbeat();
    }
  }

  /**
   * Find nodes by capabilities
   */
  public findNodesByCapabilities(requirements: Partial<NodeCapabilities>): NodeInfo[] {
    return this.getActiveNodes().filter(node => {
      // Check task type support
      if (requirements.supportedTaskTypes?.length) {
        if (!requirements.supportedTaskTypes.every(type =>
          node.capabilities.supportedTaskTypes.includes(type)
        )) {
          return false;
        }
      }

      // Check resource availability
      if (requirements.resources) {
        const { cpu, memory, gpu } = requirements.resources;
        if (cpu && node.currentLoad.cpu + cpu > node.capabilities.resources.cpu) return false;
        if (memory && node.currentLoad.memory + memory > node.capabilities.resources.memory) return false;
        if (gpu && node.capabilities.resources.gpu &&
            node.currentLoad.gpu! + gpu > node.capabilities.resources.gpu) {
          return false;
        }
      }

      // Check constraints
      if (requirements.constraints) {
        for (const [key, value] of Object.entries(requirements.constraints)) {
          if (node.capabilities.constraints?.[key] !== value) return false;
        }
      }

      return true;
    });
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.stopTimers();
    this.nodes.clear();
    this.removeAllListeners();
  }
} 