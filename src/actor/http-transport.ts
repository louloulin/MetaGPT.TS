/**
 * HTTP Transport for P2P Network
 * 
 * This module implements an HTTP-based transport for the P2P network,
 * allowing actors to communicate over HTTP connections.
 */

import http from 'http';
import https from 'https';
import { randomUUID } from 'crypto';
import type { AddressInfo } from 'net';
import type { NetworkTransport } from './p2p-network';
import { logger } from '../utils/logger';
import { URL } from 'url';

interface HttpTransportOptions {
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
   * Path prefix to use for requests, default is /p2p
   */
  pathPrefix?: string;

  /**
   * Whether to use HTTPS for outgoing requests
   */
  useHttps?: boolean;

  /**
   * HTTP request timeout in milliseconds
   */
  requestTimeout?: number;
}

/**
 * HTTP transport for P2P network
 */
export class HttpTransport implements NetworkTransport {
  private options: Required<HttpTransportOptions>;
  private server?: http.Server;
  private messageHandler?: (from: string, data: Buffer) => void;
  private localAddress: string = '';
  private nodeId: string;
  private running: boolean = false;

  /**
   * Create an HTTP transport
   */
  constructor(nodeId: string = randomUUID(), options: HttpTransportOptions = {}) {
    this.nodeId = nodeId;
    this.options = {
      port: options.port ?? 0,
      host: options.host ?? 'localhost',
      server: options.server,
      pathPrefix: options.pathPrefix ?? '/p2p',
      useHttps: options.useHttps ?? false,
      requestTimeout: options.requestTimeout ?? 30000,
    };
  }

  /**
   * Initialize the transport
   */
  public async initialize(): Promise<void> {
    if (this.server) {
      return;
    }

    if (this.options.server) {
      // Use provided HTTP server
      this.server = this.options.server;
      this.setupRequestHandler();
      // Get address info from the server
      const addr = this.server.address() as AddressInfo;
      if (addr) {
        const protocol = this.options.useHttps ? 'https' : 'http';
        this.localAddress = `${protocol}://${this.options.host}:${addr.port}${this.options.pathPrefix}`;
      } else {
        // Server not listening yet, use configured values
        const protocol = this.options.useHttps ? 'https' : 'http';
        this.localAddress = `${protocol}://${this.options.host}:${this.options.port}${this.options.pathPrefix}`;
      }
    } else {
      // Create new HTTP server
      this.server = http.createServer();
      this.setupRequestHandler();

      // Start the server
      await new Promise<void>((resolve) => {
        if (!this.server) {
          resolve();
          return;
        }
        this.server.listen(this.options.port, this.options.host, () => {
          if (!this.server) {
            resolve();
            return;
          }
          const addr = this.server.address() as AddressInfo;
          const protocol = this.options.useHttps ? 'https' : 'http';
          this.localAddress = `${protocol}://${this.options.host}:${addr.port}${this.options.pathPrefix}`;
          logger.info(`HTTP transport listening on ${this.localAddress}`);
          resolve();
        });
      });
    }

    this.running = true;
  }

  /**
   * Send a message to a remote node
   */
  public async sendMessage(nodeAddress: string, message: Buffer): Promise<void> {
    if (!this.running) {
      throw new Error('HTTP transport is not running');
    }

    return new Promise<void>((resolve, reject) => {
      try {
        // Parse the address
        const url = new URL(nodeAddress);
        const isHttps = url.protocol === 'https:';
        
        // Prepare the request options
        const options = {
          method: 'POST',
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': message.length,
            'X-Node-ID': this.nodeId,
            'X-Node-Address': this.localAddress,
          },
          timeout: this.options.requestTimeout,
        };

        // Create the request
        const req = (isHttps ? https : http).request(options, (res) => {
          // Check response status
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP transport error: ${res.statusCode} ${res.statusMessage}`));
            return;
          }

          // Collect response data (if any)
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            resolve();
          });
        });

        // Handle request errors
        req.on('error', (error) => {
          reject(new Error(`HTTP transport error to ${nodeAddress}: ${error.message}`));
        });

        // Handle timeout
        req.on('timeout', () => {
          req.destroy();
          reject(new Error(`HTTP transport timeout to ${nodeAddress}`));
        });

        // Send the data
        req.write(message);
        req.end();
      } catch (error) {
        reject(new Error(`HTTP transport error to ${nodeAddress}: ${(error as Error).message}`));
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
    this.running = false;

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

    logger.info('HTTP transport stopped');
  }

  /**
   * Get the local node address
   */
  public getLocalAddress(): string {
    return this.localAddress;
  }

  /**
   * Set up HTTP request handler
   */
  private setupRequestHandler(): void {
    if (!this.server) {
      return;
    }

    this.server.on('request', (req, res) => {
      // Check if the request is for our P2P endpoint
      if (req.url?.startsWith(this.options.pathPrefix) && req.method === 'POST') {
        // Get client information
        const nodeId = req.headers['x-node-id'] as string || 'unknown';
        const nodeAddress = req.headers['x-node-address'] as string || 'unknown';
        const clientAddress = `${req.socket.remoteAddress}:${req.socket.remotePort}`;

        // Collect request data
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
          const data = Buffer.concat(chunks);
          
          // Call the message handler if set
          if (this.messageHandler) {
            try {
              this.messageHandler(nodeAddress || clientAddress, data);
              // Send success response
              res.statusCode = 200;
              res.end();
            } catch (error) {
              logger.error(`Error handling HTTP message from ${nodeId} at ${nodeAddress}:`, error);
              res.statusCode = 500;
              res.end('Internal error');
            }
          } else {
            // No handler set, return error
            res.statusCode = 503;
            res.end('Service unavailable');
          }
        });
      } else {
        // Not a P2P endpoint request
        res.statusCode = 404;
        res.end('Not found');
      }
    });
  }
} 