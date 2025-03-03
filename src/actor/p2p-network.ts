/**
 * P2P Network Layer for Distributed Actors
 * 
 * This module provides a peer-to-peer networking layer for distributed actor systems.
 * It enables actors to communicate across machine boundaries in a decentralized way.
 */

import { EventEmitter } from 'events';
import type { ActorMessage } from './actor';
import { ActorSystem } from './actor';
import { logger } from '../utils/logger';

/**
 * Node information in the P2P network
 */
export interface PeerNodeInfo {
  /**
   * Unique node identifier
   */
  id: string;
  
  /**
   * Node address (e.g., IP:port or URL)
   */
  address: string;
  
  /**
   * Optional node metadata
   */
  metadata?: Record<string, any>;
  
  /**
   * Last seen timestamp
   */
  lastSeen: number;
}

/**
 * Network transport interface for sending and receiving messages
 */
export interface NetworkTransport {
  /**
   * Initialize the transport
   */
  initialize(): Promise<void>;
  
  /**
   * Send a message to a remote node
   */
  sendMessage(nodeAddress: string, message: Buffer): Promise<void>;
  
  /**
   * Start listening for incoming messages
   */
  startListening(handler: (from: string, data: Buffer) => void): Promise<void>;
  
  /**
   * Stop listening for incoming messages
   */
  stopListening(): Promise<void>;
  
  /**
   * Get the local node address
   */
  getLocalAddress(): string;
}

/**
 * Options for the P2P network
 */
export interface P2PNetworkOptions {
  /**
   * Network transport to use
   */
  transport: NetworkTransport;
  
  /**
   * Node discovery mechanism
   */
  discovery?: DiscoveryService;
  
  /**
   * Message serialization/deserialization
   */
  serializer?: MessageSerializer;
  
  /**
   * Heartbeat interval in milliseconds
   */
  heartbeatInterval?: number;
  
  /**
   * Node timeout in milliseconds
   */
  nodeTimeout?: number;
}

/**
 * Service for discovering peers in the network
 */
export interface DiscoveryService {
  /**
   * Initialize the discovery service
   */
  initialize(network: P2PNetwork): Promise<void>;
  
  /**
   * Start discovering peers
   */
  startDiscovery(): Promise<void>;
  
  /**
   * Stop discovering peers
   */
  stopDiscovery(): Promise<void>;
  
  /**
   * Register as available for discovery
   */
  register(): Promise<void>;
  
  /**
   * Unregister from discovery
   */
  unregister(): Promise<void>;
}

/**
 * Message serializer for network transport
 */
export interface MessageSerializer {
  /**
   * Serialize a message to Buffer
   */
  serialize<T>(message: ActorMessage<T>): Buffer;
  
  /**
   * Deserialize a message from Buffer
   */
  deserialize<T>(data: Buffer): ActorMessage<T>;
}

/**
 * Default JSON message serializer
 */
export class JSONMessageSerializer implements MessageSerializer {
  serialize<T>(message: ActorMessage<T>): Buffer {
    return Buffer.from(JSON.stringify(message), 'utf-8');
  }
  
  deserialize<T>(data: Buffer): ActorMessage<T> {
    return JSON.parse(data.toString('utf-8')) as ActorMessage<T>;
  }
}

/**
 * P2P Network for distributed actor systems
 */
export class P2PNetwork {
  private static instance: P2PNetwork;
  private nodeId: string;
  private transport: NetworkTransport;
  private discovery?: DiscoveryService;
  private serializer: MessageSerializer;
  private peers: Map<string, PeerNodeInfo> = new Map();
  private actorSystem: ActorSystem;
  private eventEmitter: EventEmitter = new EventEmitter();
  private heartbeatInterval: number;
  private nodeTimeout: number;
  private heartbeatTimer?: NodeJS.Timeout;
  private initialized: boolean = false;
  private running: boolean = false;
  
  /**
   * Create a P2P network instance
   */
  private constructor(nodeId: string, options: P2PNetworkOptions) {
    this.nodeId = nodeId;
    this.transport = options.transport;
    this.discovery = options.discovery;
    this.serializer = options.serializer || new JSONMessageSerializer();
    this.actorSystem = ActorSystem.getInstance();
    this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
    this.nodeTimeout = options.nodeTimeout || 90000; // 90 seconds
  }
  
  /**
   * Get or create the singleton instance
   */
  public static getInstance(nodeId?: string, options?: P2PNetworkOptions): P2PNetwork {
    if (!P2PNetwork.instance) {
      if (!nodeId || !options) {
        throw new Error('Node ID and options must be provided when creating the P2P network');
      }
      P2PNetwork.instance = new P2PNetwork(nodeId, options);
    }
    return P2PNetwork.instance;
  }
  
  /**
   * Initialize the network
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    logger.info(`Initializing P2P network for node ${this.nodeId}`);
    
    // Initialize transport
    await this.transport.initialize();
    
    // Initialize discovery if available
    if (this.discovery) {
      await this.discovery.initialize(this);
    }
    
    // Set up message handler
    await this.transport.startListening((from, data) => {
      this.handleIncomingMessage(from, data);
    });
    
    this.initialized = true;
    logger.info(`P2P network initialized with address ${this.transport.getLocalAddress()}`);
  }
  
  /**
   * Start the network
   */
  public async start(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.running) {
      return;
    }
    
    logger.info(`Starting P2P network for node ${this.nodeId}`);
    
    // Start discovery if available
    if (this.discovery) {
      await this.discovery.startDiscovery();
      await this.discovery.register();
    }
    
    // Start heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
      this.cleanupStaleNodes();
    }, this.heartbeatInterval);
    
    this.running = true;
    logger.info('P2P network started');
  }
  
  /**
   * Stop the network
   */
  public async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    
    logger.info(`Stopping P2P network for node ${this.nodeId}`);
    
    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    
    // Stop discovery if available
    if (this.discovery) {
      await this.discovery.unregister();
      await this.discovery.stopDiscovery();
    }
    
    // Stop listening for messages
    await this.transport.stopListening();
    
    this.running = false;
    logger.info('P2P network stopped');
  }
  
  /**
   * Send a message to a remote node
   */
  public async sendToNode<T>(nodeId: string, message: ActorMessage<T>): Promise<void> {
    if (!this.running) {
      throw new Error('P2P network is not running');
    }
    
    const peerNode = this.peers.get(nodeId);
    if (!peerNode) {
      throw new Error(`Unknown peer node: ${nodeId}`);
    }
    
    const serializedMessage = this.serializer.serialize(message);
    logger.debug(`Sending message to node ${nodeId} at ${peerNode.address}`, {
      messageType: message.type,
      messageId: message.id,
    });
    
    await this.transport.sendMessage(peerNode.address, serializedMessage);
  }
  
  /**
   * Add a peer to the network
   */
  public addPeer(peer: PeerNodeInfo): void {
    if (peer.id === this.nodeId) {
      // Don't add self as peer
      return;
    }
    
    const existing = this.peers.get(peer.id);
    if (!existing || existing.lastSeen < peer.lastSeen) {
      this.peers.set(peer.id, peer);
      
      if (!existing) {
        logger.info(`Added new peer: ${peer.id} at ${peer.address}`);
        this.eventEmitter.emit('peer:added', peer);
      } else {
        logger.debug(`Updated peer: ${peer.id} at ${peer.address}`);
        this.eventEmitter.emit('peer:updated', peer);
      }
    }
  }
  
  /**
   * Remove a peer from the network
   */
  public removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.peers.delete(peerId);
      logger.info(`Removed peer: ${peerId}`);
      this.eventEmitter.emit('peer:removed', peer);
    }
  }
  
  /**
   * Get all peers
   */
  public getPeers(): PeerNodeInfo[] {
    return Array.from(this.peers.values());
  }
  
  /**
   * Get peer by ID
   */
  public getPeer(peerId: string): PeerNodeInfo | undefined {
    return this.peers.get(peerId);
  }
  
  /**
   * Get number of peers
   */
  public getPeerCount(): number {
    return this.peers.size;
  }
  
  /**
   * Get node ID
   */
  public getNodeId(): string {
    return this.nodeId;
  }
  
  /**
   * Handle an incoming message
   */
  private async handleIncomingMessage(from: string, data: Buffer): Promise<void> {
    try {
      const message = this.serializer.deserialize(data);
      
      // Update peer last seen timestamp
      const fromNodeId = this.getNodeIdFromAddress(from);
      if (fromNodeId) {
        const peer = this.peers.get(fromNodeId);
        if (peer) {
          peer.lastSeen = Date.now();
          this.peers.set(fromNodeId, peer);
        }
      }
      
      logger.debug(`Received message from ${from}`, {
        messageType: message.type,
        messageId: message.id,
      });
      
      if (message.type === 'heartbeat') {
        // Handle heartbeat message
        this.handleHeartbeat(message);
        return;
      }
      
      if (message.type === 'discovery') {
        // Handle discovery message
        this.handleDiscovery(message);
        return;
      }
      
      // Deliver actor message to the local actor system
      await this.actorSystem.deliverMessage(message);
    } catch (error) {
      logger.error(`Error handling incoming message from ${from}:`, error);
    }
  }
  
  /**
   * Handle a heartbeat message
   */
  private handleHeartbeat(message: ActorMessage<any>): void {
    const { from, payload } = message;
    
    // Update peer information
    this.addPeer({
      id: from,
      address: payload.address,
      metadata: payload.metadata,
      lastSeen: Date.now(),
    });
  }
  
  /**
   * Handle a discovery message
   */
  private handleDiscovery(message: ActorMessage<any>): void {
    const { from, payload } = message;
    
    if (payload.request) {
      // This is a discovery request, respond with our peers
      const response: ActorMessage<any> = {
        id: Date.now().toString(),
        from: this.nodeId,
        to: from,
        type: 'discovery',
        payload: {
          request: false,
          nodes: Array.from(this.peers.values()),
          nodeId: this.nodeId,
          address: this.transport.getLocalAddress(),
        },
        timestamp: Date.now(),
      };
      
      // Find the sender's address
      const peerNode = this.peers.get(from);
      if (peerNode) {
        this.transport.sendMessage(peerNode.address, this.serializer.serialize(response))
          .catch(error => logger.error(`Error sending discovery response:`, error));
      }
    } else {
      // This is a discovery response, add the peers
      const { nodes, nodeId, address } = payload;
      
      // Add the responding node
      this.addPeer({
        id: nodeId,
        address,
        lastSeen: Date.now(),
      });
      
      // Add all the nodes it knows about
      if (Array.isArray(nodes)) {
        for (const node of nodes) {
          this.addPeer(node);
        }
      }
    }
  }
  
  /**
   * Send a heartbeat to all peers
   */
  private sendHeartbeat(): void {
    if (!this.running || this.peers.size === 0) {
      return;
    }
    
    const heartbeat: ActorMessage<any> = {
      id: Date.now().toString(),
      from: this.nodeId,
      to: '*',
      type: 'heartbeat',
      payload: {
        nodeId: this.nodeId,
        address: this.transport.getLocalAddress(),
        peerCount: this.peers.size,
      },
      timestamp: Date.now(),
    };
    
    const serializedHeartbeat = this.serializer.serialize(heartbeat);
    
    // Send to all peers
    for (const peer of this.peers.values()) {
      this.transport.sendMessage(peer.address, serializedHeartbeat)
        .catch(error => logger.error(`Error sending heartbeat to ${peer.id}:`, error));
    }
  }
  
  /**
   * Clean up stale nodes
   */
  private cleanupStaleNodes(): void {
    const now = Date.now();
    const staleThreshold = now - this.nodeTimeout;
    
    for (const [nodeId, peer] of this.peers.entries()) {
      if (peer.lastSeen < staleThreshold) {
        this.removePeer(nodeId);
      }
    }
  }
  
  /**
   * Get node ID from address
   */
  private getNodeIdFromAddress(address: string): string | undefined {
    for (const [nodeId, peer] of this.peers.entries()) {
      if (peer.address === address) {
        return nodeId;
      }
    }
    return undefined;
  }
  
  /**
   * Subscribe to network events
   */
  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }
  
  /**
   * Unsubscribe from network events
   */
  public off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }
} 