/**
 * Discovery Service for P2P Network
 * 
 * This module implements discovery mechanisms for P2P networks,
 * allowing actors to find and connect to other nodes in the network.
 */

import type { DiscoveryService, P2PNetwork } from './p2p-network';
import { logger } from '../utils/logger';

/**
 * Options for static list discovery
 */
export interface StaticDiscoveryOptions {
  /**
   * List of known seed nodes to connect to
   */
  seedNodes: string[];
  
  /**
   * Interval for discovery attempts in milliseconds
   */
  discoveryInterval?: number;
}

/**
 * Static list-based discovery service
 */
export class StaticDiscoveryService implements DiscoveryService {
  private options: Required<StaticDiscoveryOptions>;
  private network?: P2PNetwork;
  private running: boolean = false;
  private discoveryTimer?: NodeJS.Timeout;
  private localNodeId: string = '';
  private localAddress: string = '';

  /**
   * Create a static discovery service
   */
  constructor(options: StaticDiscoveryOptions) {
    this.options = {
      seedNodes: [...options.seedNodes],
      discoveryInterval: options.discoveryInterval ?? 60000, // 1 minute
    };
  }

  /**
   * Initialize the discovery service
   */
  public async initialize(network: P2PNetwork): Promise<void> {
    this.network = network;
    // Store node ID and address at initialization time
    if (network.getNodeId) {
      this.localNodeId = network.getNodeId();
    }
    if (network.getLocalAddress) {
      this.localAddress = network.getLocalAddress();
    }
  }

  /**
   * Start discovering peers
   */
  public async startDiscovery(): Promise<void> {
    if (this.running || !this.network) {
      return;
    }

    this.running = true;
    logger.info(`Starting static discovery with ${this.options.seedNodes.length} seed nodes`);

    // Try to connect to all seed nodes immediately
    await this.discoverPeers();

    // Schedule periodic discovery
    this.discoveryTimer = setInterval(() => {
      this.discoverPeers().catch(error => {
        logger.error('Error during peer discovery:', error);
      });
    }, this.options.discoveryInterval);
  }

  /**
   * Stop discovering peers
   */
  public async stopDiscovery(): Promise<void> {
    this.running = false;

    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = undefined;
    }

    logger.info('Static discovery stopped');
  }

  /**
   * Register as available for discovery
   */
  public async register(): Promise<void> {
    // No registration needed for static discovery
  }

  /**
   * Unregister from discovery
   */
  public async unregister(): Promise<void> {
    // No unregistration needed for static discovery
  }

  /**
   * Discover peers from the seed nodes
   */
  private async discoverPeers(): Promise<void> {
    if (!this.network) {
      return;
    }

    logger.debug('Starting peer discovery');

    // Create a discovery message
    const discoveryMessage = {
      id: `discovery-${Date.now()}`,
      from: this.localNodeId,
      to: '*',
      type: 'discovery',
      payload: {
        request: true,
        nodeId: this.localNodeId,
        address: this.localAddress,
      },
      timestamp: Date.now(),
    };

    // Try to connect to each seed node
    const connectPromises = this.options.seedNodes.map(async (nodeAddress) => {
      try {
        // Skip if this is our own address
        if (nodeAddress === this.localAddress) {
          return;
        }

        // Send discovery message
        if (this.network?.sendToNode) {
          await this.network.sendToNode(nodeAddress, discoveryMessage);
          logger.debug(`Sent discovery request to ${nodeAddress}`);
        }
      } catch (error) {
        logger.debug(`Failed to connect to seed node ${nodeAddress}:`, error);
      }
    });

    // Wait for all connection attempts to complete
    await Promise.all(connectPromises);

    // Log peer count if method exists
    if (this.network.getPeerCount) {
      logger.debug(`Completed peer discovery, found ${this.network.getPeerCount()} peers`);
    } else {
      logger.debug('Completed peer discovery');
    }
  }
} 