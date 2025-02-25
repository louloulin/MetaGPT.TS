import { WebSocketServer as WSServer } from 'ws';
import type { Message } from '../types/message';
import {
  WebSocketMessageSchema,
  WebSocketMessageType,
} from './types';
import type {
  WebSocketMessage,
  WebSocketServer,
  WebSocketServerOptions,
} from './types';

/**
 * WebSocket server implementation with client management and broadcasting support
 * 
 * Features:
 * - Client connection management
 * - Message validation using Zod schema
 * - Broadcasting to all connected clients
 * - Automatic cleanup of disconnected clients
 * - Error handling and event callbacks
 */
export class WebSocketServerImpl implements WebSocketServer {
  private wss: WSServer | null = null;
  private clients: Set<WebSocket> = new Set();

  /**
   * Create a new WebSocket server instance
   * @param options - Configuration options for the server
   */
  constructor(private options: WebSocketServerOptions) {}

  /**
   * Start the WebSocket server and begin accepting connections
   * @throws Error if server fails to start
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WSServer({
          port: this.options.port,
          host: this.options.host,
          path: this.options.path,
        });

        // Handle new client connections
        this.wss.on('connection', (client: WebSocket) => {
          this.clients.add(client);
          this.options.onConnection?.(client);

          // Handle incoming messages with validation
          client.on('message', async (data: string) => {
            try {
              const message = WebSocketMessageSchema.parse(JSON.parse(data));
              this.options.onMessage?.(message, client);
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : String(error);
              this.options.onError?.(new Error(`Invalid message format: ${message}`));
            }
          });

          // Remove client on disconnection
          client.on('close', () => {
            this.clients.delete(client);
          });

          // Handle client errors and cleanup
          client.on('error', (error: Error) => {
            this.options.onError?.(error);
            this.clients.delete(client);
          });
        });

        // Handle server errors
        this.wss.on('error', (error: Error) => {
          this.options.onError?.(error);
          reject(error);
        });

        // Server is ready to accept connections
        this.wss.on('listening', () => {
          resolve();
        });
      } catch (error: unknown) {
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error(String(error)));
        }
      }
    });
  }

  /**
   * Stop the WebSocket server and close all client connections
   * @throws Error if server fails to stop cleanly
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }

      this.wss.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.wss = null;
          this.clients.clear();
          resolve();
        }
      });
    });
  }

  /**
   * Broadcast a message to all connected clients
   * @param message - Message to broadcast (either Message or WebSocketMessage format)
   * Automatically removes disconnected clients during broadcast
   */
  public async broadcast(message: Message | WebSocketMessage): Promise<void> {
    const wsMessage = 'type' in message ? message : {
      type: WebSocketMessageType.MESSAGE,
      payload: message,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    };

    const data = JSON.stringify(wsMessage);
    const deadClients = new Set<WebSocket>();

    // Send message to all connected clients
    for (const client of this.clients) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        } else {
          deadClients.add(client);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.options.onError?.(new Error(`Failed to send message to client: ${message}`));
        deadClients.add(client);
      }
    }

    // Clean up dead clients
    for (const client of deadClients) {
      this.clients.delete(client);
    }
  }

  /**
   * Get array of all currently connected clients
   * @returns Array of WebSocket client instances
   */
  public getClients(): WebSocket[] {
    return Array.from(this.clients);
  }

  /**
   * Check if server is currently running
   * @returns true if server is running, false otherwise
   */
  public isRunning(): boolean {
    return this.wss !== null;
  }
} 