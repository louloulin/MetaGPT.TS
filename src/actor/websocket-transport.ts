/**
 * WebSocket Transport for P2P Network
 * 
 * This module implements a WebSocket-based transport for the P2P network,
 * allowing actors to communicate over WebSocket connections.
 */

import * as WebSocket from 'ws';
import { randomUUID } from 'crypto';
import http from 'http';
import type { AddressInfo } from 'net';
import type { NetworkTransport } from './p2p-network';
import { logger } from '../utils/logger';

interface WebSocketTransportOptions {
  /**
   * Port to listen on, default is 0 (random available port)
   */
  port?: number;

  /**
   * Host to bind to, default is localhost
   */
  host?: string;

  /**
   * Custom HTTP server to use, if provided port and host are ignored
   */
  server?: http.Server;

  /**
   * Path to listen on, default is /ws
   */
  path?: string;
}

/**
 * WebSocket transport for P2P network
 */
export class WebSocketTransport implements NetworkTransport {
  private options: Required<WebSocketTransportOptions>;
  private server?: http.Server;
  private wss?: WebSocket.Server;
  private clients: Map<string, WebSocket.WebSocket> = new Map();
  private messageHandler?: (from: string, data: Buffer) => void;
  private localAddress: string = '';
  private nodeId: string;

  /**
   * Create a WebSocket transport
   */
  constructor(nodeId: string = randomUUID(), options: WebSocketTransportOptions = {}) {
    this.nodeId = nodeId;
    this.options = {
      port: options.port ?? 0,
      host: options.host ?? 'localhost',
      server: options.server,
      path: options.path ?? '/ws',
    };
  }

  /**
   * Initialize the transport
   */
  public async initialize(): Promise<void> {
    if (this.wss) {
      return;
    }

    if (this.options.server) {
      // Use provided HTTP server
      this.server = this.options.server;
      this.wss = new WebSocket.Server({
        server: this.server,
        path: this.options.path,
      });
    } else {
      // Create new HTTP server
      this.server = http.createServer();
      this.wss = new WebSocket.Server({
        server: this.server,
        path: this.options.path,
      });

      await new Promise<void>((resolve) => {
        if (!this.server) return;
        this.server.listen(this.options.port, this.options.host, () => {
          if (!this.server) return;
          const addr = this.server.address() as AddressInfo;
          this.localAddress = `ws://${this.options.host}:${addr.port}${this.options.path}`;
          logger.info(`WebSocket transport listening on ${this.localAddress}`);
          resolve();
        });
      });
    }

    this.wss.on('connection', (ws: WebSocket.WebSocket, req: http.IncomingMessage) => this.handleConnection(ws, req));
    this.wss.on('error', (error: Error) => {
      logger.error('WebSocket server error:', error);
    });
  }

  /**
   * Send a message to a remote node
   */
  public async sendMessage(nodeAddress: string, message: Buffer): Promise<void> {
    // If we have a direct connection to this address, use it
    const client = this.clients.get(nodeAddress);
    if (client && client.readyState === WebSocket.WebSocket.OPEN) {
      client.send(message);
      return;
    }

    // Otherwise, create a new connection
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket.WebSocket(nodeAddress);

        const cleanup = () => {
          ws.removeAllListeners();
          try {
            ws.terminate();
          } catch (e) {
            // Ignore terminate errors
          }
        };

        ws.on('error', (error: Error) => {
          cleanup();
          reject(new Error(`WebSocket connection error to ${nodeAddress}: ${error.message}`));
        });

        ws.on('open', () => {
          ws.send(message, (error?: Error) => {
            if (error) {
              cleanup();
              reject(new Error(`WebSocket send error to ${nodeAddress}: ${error.message}`));
              return;
            }

            // Wait a bit before closing to ensure the message is sent
            setTimeout(() => {
              cleanup();
              resolve();
            }, 100);
          });
        });
      } catch (error) {
        reject(new Error(`WebSocket connection error to ${nodeAddress}: ${(error as Error).message}`));
      }
    });
  }

  /**
   * Start listening for incoming messages
   */
  public async startListening(handler: (from: string, data: Buffer) => void): Promise<void> {
    this.messageHandler = handler;
  }

  /**
   * Stop listening for incoming messages
   */
  public async stopListening(): Promise<void> {
    this.messageHandler = undefined;

    // Close all client connections
    for (const client of this.clients.values()) {
      try {
        client.terminate();
      } catch (e) {
        // Ignore terminate errors
      }
    }
    this.clients.clear();

    // Close the WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        if (!this.wss) {
          resolve();
          return;
        }
        this.wss.close(() => {
          resolve();
        });
      });
      this.wss = undefined;
    }

    // Close the HTTP server if we created it
    if (this.server && !this.options.server) {
      await new Promise<void>((resolve) => {
        if (!this.server) {
          resolve();
          return;
        }
        this.server.close(() => {
          resolve();
        });
      });
      this.server = undefined;
    }

    logger.info('WebSocket transport stopped');
  }

  /**
   * Get the local node address
   */
  public getLocalAddress(): string {
    return this.localAddress;
  }

  /**
   * Handle a new WebSocket connection
   */
  private handleConnection(ws: WebSocket.WebSocket, req: http.IncomingMessage): void {
    const clientAddress = req.headers['x-forwarded-for'] || 
                         req.socket.remoteAddress || 
                         'unknown';
    
    const connectionId = `${clientAddress}:${req.socket.remotePort}`;
    logger.debug(`New WebSocket connection from ${connectionId}`);

    // Store the client connection
    this.clients.set(connectionId, ws);

    const cleanup = () => {
      this.clients.delete(connectionId);
      ws.removeAllListeners();
      try {
        ws.terminate();
      } catch (e) {
        // Ignore terminate errors
      }
      logger.debug(`WebSocket connection closed from ${connectionId}`);
    };

    ws.on('message', (data: WebSocket.Data) => {
      try {
        if (this.messageHandler) {
          // Parse the client address from the connection identifier
          this.messageHandler(connectionId, Buffer.isBuffer(data) ? data : Buffer.from(data as any));
        }
      } catch (error) {
        logger.error(`Error handling WebSocket message from ${connectionId}:`, error);
      }
    });

    ws.on('close', cleanup);
    ws.on('error', (error: Error) => {
      logger.error(`WebSocket connection error from ${connectionId}:`, error);
      cleanup();
    });
  }
} 